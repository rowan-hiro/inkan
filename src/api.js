// The library layer. One function per command, each taking a plain options
// object plus `root`, returning a plain serializable result or throwing
// InkanError with a user-facing message. Nothing here reads process.argv or
// writes to stdout; src/cli.js is the only thing that parses and prints.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { fold, computeContractHash } from './fold.js';
import * as git from './git.js';
import * as decisions from './decisions.js';

export class InkanError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InkanError';
  }
}

// Bundled skill directory, whether running from source or an installed package.
const SKILL_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'use-inkan');

const DECISION_ID_RE = /^\d{4}$/;
const LANG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

function resolveRoot(root) {
  const found = store.findRoot(root);
  if (!found) throw new InkanError('not an Inkan repository (no .inkan found); run "inkan init" first');
  return found;
}

function loadRecord(root, id) {
  let events;
  try {
    events = store.readOutcomeEvents(root, id);
  } catch (err) {
    if (err.code === 'ENOENT') throw new InkanError(`unknown outcome "${id}"`);
    throw err;
  }
  return fold(events, store.outcomeFile(root, id));
}

function allRecords(root) {
  return store.listOutcomeIds(root).map((id) => loadRecord(root, id));
}

function openRecords(root) {
  return allRecords(root).filter((r) => !r.closed);
}

/** The decision file whose filename starts with `<id>-`, or null. */
function findDecisionFile(root, id) {
  const dir = store.decisionsDir(root);
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((name) => name.startsWith(`${id}-`) && name.endsWith('.md'));
  return match ? path.join(dir, match) : null;
}

function validateDecisionIds(root, ids) {
  for (const id of ids) {
    if (!DECISION_ID_RE.test(id)) throw new InkanError(`malformed decision id "${id}" (expected four digits)`);
    if (!findDecisionFile(root, id)) throw new InkanError(`unknown decision "${id}"; add it first with "inkan decision add"`);
  }
}

/** Resolves `2`, `02`, or `0002` to the file whose name starts with the canonical id. */
function requireDecisionFile(root, rawId) {
  if (!/^\d{1,4}$/.test(String(rawId))) throw new InkanError(`malformed decision id "${rawId}" (expected digits, e.g. 2, 02, or 0002)`);
  const id = String(Number(rawId)).padStart(4, '0');
  const file = findDecisionFile(root, id);
  if (!file) throw new InkanError(`unknown decision "${id}"`);
  return { id, file };
}

/** `{ id, status }` for each linked decision id, `status: null` when the file is missing. */
function resolveDecisionLinks(root, ids) {
  return ids.map((id) => {
    const file = findDecisionFile(root, id);
    if (!file) return { id, status: null };
    return { id, status: decisions.parse(fs.readFileSync(file, 'utf8'), file).status };
  });
}

function requireStatus(status) {
  const normalized = String(status).toLowerCase();
  if (!decisions.STATUSES.includes(normalized)) throw new InkanError(`malformed status "${status}" (expected one of ${decisions.STATUSES.join(', ')})`);
  return normalized;
}

/** The single open outcome, or null; refuses ambiguity naming `flagHint` in the message. */
function singleOpenOrNull(root, flagHint) {
  const open = openRecords(root);
  if (open.length > 1) {
    throw new InkanError(`more than one outcome is open (${open.map((r) => r.id).join(', ')}); specify which with ${flagHint}`);
  }
  return open[0] ?? null;
}

/** The single open outcome, or the one named by `id`. Refuses ambiguity. */
function resolveTarget(root, id) {
  if (id) {
    const record = loadRecord(root, id);
    if (record.closed) throw new InkanError(`outcome "${id}" is closed; new work is a new outcome`);
    return record;
  }
  const open = singleOpenOrNull(root, 'an id');
  if (!open) throw new InkanError('no outcome is open');
  return open;
}

export function begin({ root, outcome, accept = [], decision = [], lane }) {
  const resolvedRoot = resolveRoot(root);
  if (!outcome || !outcome.trim()) throw new InkanError('an outcome is required');
  validateDecisionIds(resolvedRoot, decision);
  // Other open outcomes belong to whoever began them. They are reported,
  // never closed or otherwise touched here (decision 0013).
  const openAlongside = openRecords(resolvedRoot).map((r) => ({ id: r.id, outcome: r.outcome }));
  const head = git.head(resolvedRoot);
  const existingIds = store.listOutcomeIds(resolvedRoot);
  const resolvedLane = lane ?? null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = store.newOutcomeId(existingIds);
    const event = {
      v: 1,
      type: 'begin',
      id,
      ts: new Date().toISOString(),
      outcome,
      criteria: accept,
      decisions: decision,
      lane: resolvedLane,
      head,
    };
    try {
      store.createOutcomeFile(resolvedRoot, id, event);
      return { id, outcome, criteria: accept, decisions: decision, lane: resolvedLane, head, openAlongside };
    } catch (err) {
      existingIds.push(id);
      if (attempt === 4) throw err;
    }
  }
  /* unreachable */
}

export function amend({ root, id, reason, addition, accept = [], withdraw = [], decision = [] }) {
  const resolvedRoot = resolveRoot(root);
  if (!reason || !reason.trim()) throw new InkanError('amend requires --reason');
  validateDecisionIds(resolvedRoot, decision);
  const record = resolveTarget(resolvedRoot, id);

  const withdrawIndexes = withdraw.map((raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new InkanError(`malformed criterion index "${raw}"`);
    return n;
  });
  for (const n of withdrawIndexes) {
    const criterion = record.criteria[n - 1];
    if (!criterion || criterion.withdrawn) throw new InkanError(`cannot withdraw unknown or already-withdrawn criterion ${n}`);
  }
  const head = git.head(resolvedRoot);
  store.appendEvent(resolvedRoot, record.id, {
    v: 1,
    type: 'amend',
    id: record.id,
    ts: new Date().toISOString(),
    reason,
    addition: addition ?? null,
    criteria: accept,
    withdraw: withdrawIndexes,
    decisions: decision,
    head,
  });
  const updated = loadRecord(resolvedRoot, record.id);
  return { id: record.id, contractHash: computeContractHash(updated) };
}

const DISPOSITION_RE = /^(\d+)\s*(?::\s*([\s\S]*))?$/;

function parseDisposition(raw, met) {
  const match = String(raw).match(DISPOSITION_RE);
  if (!match) throw new InkanError(`malformed disposition "${raw}"`);
  const note = match[2] && match[2].trim().length > 0 ? match[2].trim() : undefined;
  return { criterion: Number(match[1]), met, note };
}

export function end({ root, id, met = [], unmet = [], status, note }) {
  const resolvedRoot = resolveRoot(root);
  if (!note || !note.trim()) throw new InkanError('end requires --note');
  if (status !== undefined && status !== 'abandoned') {
    throw new InkanError(`malformed status "${status}" (only "abandoned" may be set explicitly)`);
  }
  const record = resolveTarget(resolvedRoot, id);
  const seen = new Set();
  const dispositions = [];
  for (const raw of [...met.map((r) => [r, true]), ...unmet.map((r) => [r, false])]) {
    const d = parseDisposition(raw[0], raw[1]);
    if (seen.has(d.criterion)) throw new InkanError(`duplicate disposition for criterion ${d.criterion}`);
    seen.add(d.criterion);
    dispositions.push(d);
  }
  for (const d of dispositions) {
    const criterion = record.criteria[d.criterion - 1];
    if (!criterion) throw new InkanError(`unknown criterion ${d.criterion}`);
    if (criterion.withdrawn) throw new InkanError(`criterion ${d.criterion} was withdrawn`);
  }
  let finalStatus = status;
  if (finalStatus !== 'abandoned') {
    for (const c of record.criteria) {
      if (!c.withdrawn && !seen.has(c.index)) throw new InkanError(`criterion ${c.index} needs a disposition (--met or --unmet)`);
    }
    finalStatus = dispositions.some((d) => !d.met) ? 'partial' : 'completed';
  }
  const contractHash = computeContractHash(record);
  const tree = git.treeHash(resolvedRoot);
  const head = git.head(resolvedRoot);
  store.appendEvent(resolvedRoot, record.id, {
    v: 1,
    type: 'end',
    id: record.id,
    ts: new Date().toISOString(),
    status: finalStatus,
    dispositions,
    note,
    contractHash,
    tree,
    head,
  });

  return { id: record.id, status: finalStatus };
}

export function status({ root }) {
  const resolvedRoot = resolveRoot(root);
  const open = openRecords(resolvedRoot)
    .sort((a, b) => store.compareOutcomeIds(a.id, b.id))
    .map((r) => ({ ...r, decisionLinks: resolveDecisionLinks(resolvedRoot, r.decisions) }));
  return { open };
}

const LOG_STATUSES = new Set(['open', 'completed', 'partial', 'abandoned']);
const SINCE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

function parseSince(raw) {
  if (!SINCE_RE.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new InkanError(`malformed --since "${raw}" (expected an ISO date or datetime)`);
  }
  return Date.parse(raw);
}

/** Normalizes a decision id filter (accepts `2`, `02`, `0002`) without requiring the file to exist. */
function normalizeDecisionFilter(raw) {
  if (!/^\d{1,4}$/.test(String(raw))) throw new InkanError(`malformed decision id "${raw}" (expected digits, e.g. 2, 02, or 0002)`);
  return String(Number(raw)).padStart(4, '0');
}

function matchesGrep(record, re) {
  if (re.test(record.outcome)) return true;
  if (record.criteria.some((c) => re.test(c.text))) return true;
  if (record.amendments.some((a) => re.test(a.reason) || (a.addition && re.test(a.addition)))) return true;
  return record.closed && Boolean(record.note) && re.test(record.note);
}

export function log({ root, n, lane, since, grep, status, decision, id }) {
  const resolvedRoot = resolveRoot(root);
  if (id) {
    const record = loadRecord(resolvedRoot, id);
    return { record: { ...record, decisionLinks: resolveDecisionLinks(resolvedRoot, record.decisions) } };
  }
  const limit = n ?? 20;

  // Only these filters require reading past the newest few files; the plain
  // `-n` case sorts the directory listing and folds nothing else. See
  // decision 0009. listOutcomeIds already sorts
  // ascending by store.compareOutcomeIds, so reversing it is enough.
  const filtered = [lane, since, grep, status, decision].some((v) => v !== undefined);
  if (!filtered) {
    const ids = store.listOutcomeIds(resolvedRoot).reverse().slice(0, limit);
    return { records: ids.map((rid) => loadRecord(resolvedRoot, rid)) };
  }

  if (status !== undefined && !LOG_STATUSES.has(status)) {
    throw new InkanError(`malformed status "${status}" (expected one of ${[...LOG_STATUSES].join(', ')})`);
  }
  const sinceMs = since !== undefined ? parseSince(since) : null;
  const grepRe = grep !== undefined ? new RegExp(grep, 'i') : null;
  const decisionId = decision !== undefined ? normalizeDecisionFilter(decision) : null;

  let records = store.listOutcomeIds(resolvedRoot).reverse().map((rid) => loadRecord(resolvedRoot, rid));
  if (lane) records = records.filter((r) => r.lane === lane);
  if (sinceMs !== null) records = records.filter((r) => Date.parse(r.sealedAt) >= sinceMs);
  if (status !== undefined) records = records.filter((r) => (r.closed ? r.status : 'open') === status);
  if (decisionId) records = records.filter((r) => r.decisions.includes(decisionId));
  if (grepRe) records = records.filter((r) => matchesGrep(r, grepRe));
  return { records: records.slice(0, limit) };
}

// --- check / doctor ---------------------------------------------------------

const OUTCOME_FILE_PREFIX = '.inkan/outcomes/';

/** The four facts for one `Inkan-Outcome` trailer value, per decision 0006. */
function checkTrailer(root, sha, id) {
  const filePath = `${OUTCOME_FILE_PREFIX}${id}.jsonl`;
  const raw = git.showFile(root, sha, filePath);
  if (raw === null) return { id, lines: ['outcome: missing from commit'], ok: false };

  let events;
  try {
    events = store.parseOutcomeEvents(raw, `${sha}:${filePath}`);
  } catch (err) {
    const firstLine = String(err.message).split('\n')[0];
    return { id, lines: [`outcome: present, unreadable (${firstLine})`], ok: false };
  }
  const endEvent = events.find((e) => e && e.type === 'end');
  if (!endEvent) return { id, lines: ['outcome: present, open'], ok: false };

  let hashOk = true;
  try {
    fold(events, `${sha}:${filePath}`);
  } catch {
    hashOk = false;
  }
  const lines = [`outcome: present, closed (${endEvent.status})`, hashOk ? 'hash: matches refold' : 'hash: does not match refold'];

  let treeOk = true;
  if (endEvent.tree == null) {
    lines.push('tree: not recorded');
  } else if (git.treeMatchesCommit(root, endEvent.tree, sha)) {
    lines.push('tree: matches commit tree');
  } else {
    lines.push('tree: differs from commit tree');
    treeOk = false;
  }

  return { id, lines, ok: hashOk && treeOk };
}

/** Read-only report on whether a commit's `Inkan-Outcome` trailers stay faithful to what it recorded. */
export function check({ root, commit }) {
  const resolvedRoot = resolveRoot(root);
  const ref = commit ?? 'HEAD';
  const sha = git.revParse(resolvedRoot, ref);
  if (!sha) throw new InkanError(`unknown commit "${ref}"`);
  const shortSha = git.shortSha(resolvedRoot, sha);
  const trailerIds = git.trailerValues(resolvedRoot, sha);
  if (trailerIds.length === 0) return { shortSha, noTrailer: true };
  const reports = trailerIds.map((id) => checkTrailer(resolvedRoot, sha, id));
  return { shortSha, reports, consistent: reports.every((r) => r.ok) };
}

/** Read-only report: folds every outcome, parses every decision, and cross-checks ids and links. */
export function doctor({ root }) {
  const resolvedRoot = resolveRoot(root);
  const problems = [];

  const outcomeIds = store.listOutcomeIds(resolvedRoot);
  const records = [];
  for (const id of outcomeIds) {
    try {
      const events = store.readOutcomeEvents(resolvedRoot, id);
      if (events[0]?.id !== undefined && events[0].id !== id) {
        problems.push(`outcome ${id}: begin id "${events[0].id}" does not match the file name`);
      }
      records.push(fold(events, store.outcomeFile(resolvedRoot, id)));
    } catch (err) {
      problems.push(`outcome ${id}: ${err.message}`);
    }
  }

  const dir = store.decisionsDir(resolvedRoot);
  const decisionNames = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.md')) : [];
  const decisionOwners = new Map();
  for (const name of decisionNames) {
    const file = path.join(dir, name);
    try {
      const record = decisions.parse(fs.readFileSync(file, 'utf8'), file);
      const owner = decisionOwners.get(record.id);
      if (owner) problems.push(`decision ${record.id}: duplicate id (${owner}, ${name})`);
      else decisionOwners.set(record.id, name);
    } catch (err) {
      problems.push(`decision ${name}: ${err.message}`);
    }
  }

  for (const record of records) {
    for (const decisionId of record.decisions) {
      if (!decisionOwners.has(decisionId)) problems.push(`outcome ${record.id}: dangling decision link "${decisionId}"`);
    }
  }

  return { outcomeCount: outcomeIds.length, decisionCount: decisionNames.length, problems };
}

// --- decisions ------------------------------------------------------------

export function decisionAdd({ root, title, context, decision, driver = [], option = [], consequence = [], status }) {
  const resolvedRoot = resolveRoot(root);
  if (!title || !title.trim()) throw new InkanError('decision add requires a title');
  if (!context || !context.trim()) throw new InkanError('decision add requires --context');
  if (!decision || !decision.trim()) throw new InkanError('decision add requires --decision');
  const resolvedStatus = requireStatus(status ?? 'accepted');
  const id = decisions.nextId(resolvedRoot);
  const dir = store.decisionsDir(resolvedRoot);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}-${decisions.slugify(title)}.md`);
  const date = new Date().toISOString().slice(0, 10);
  const sections = { context, drivers: driver, options: option, outcome: decision, consequences: consequence };
  const content = decisions.render({ id, title, date, status: resolvedStatus, sections });
  fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
  return { id, file };
}

export function decisionShow({ root, id }) {
  const resolvedRoot = resolveRoot(root);
  const { id: resolvedId, file } = requireDecisionFile(resolvedRoot, id);
  return { id: resolvedId, file, content: fs.readFileSync(file, 'utf8') };
}

export function decisionList({ root, status }) {
  const resolvedRoot = resolveRoot(root);
  let records = decisions.list(resolvedRoot);
  if (status !== undefined) {
    const normalized = requireStatus(status);
    records = records.filter((r) => r.status === normalized);
  }
  return { records };
}

export function decisionUpdate({ root, id, status, reason, outcome }) {
  const resolvedRoot = resolveRoot(root);
  if (status === undefined) throw new InkanError('decision update requires --status');
  const resolvedStatus = requireStatus(status);
  if (!reason || !reason.trim()) throw new InkanError('decision update requires --reason');
  const { id: resolvedId, file } = requireDecisionFile(resolvedRoot, id);
  let outcomeId;
  if (outcome !== undefined) {
    const record = loadRecord(resolvedRoot, outcome);
    if (record.closed) throw new InkanError(`outcome "${outcome}" is closed`);
    outcomeId = record.id;
  } else {
    outcomeId = singleOpenOrNull(resolvedRoot, '--outcome <id>')?.id;
  }
  const from = decisions.appendHistory(file, { ts: new Date().toISOString(), outcomeId, to: resolvedStatus, reason });
  return { id: resolvedId, from, to: resolvedStatus };
}

const AGENTS_FILENAME = 'AGENTS.md';
const CLAUDE_FILENAME = 'CLAUDE.md';
const START_MARKER = '<!-- inkan -->';
const END_MARKER = '<!-- /inkan -->';
const DEFAULT_LANG = 'en';

// Protocol 1, frozen verbatim so `init` can recognise a block it generated
// earlier and upgrade it. Never edit; a protocol change is a new version.
function protocolBlockV1(lang) {
  return `${START_MARKER}
<!-- inkan-protocol: 1 -->
<!-- inkan-lang: ${lang} -->

## Agent protocol: sealed outcomes

This repository uses Inkan (\`inkan\`, alias \`ink\`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not run tests and does not judge the result; the repository's own checks do that. Write outcome prose in ${lang}.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run \`inkan begin "<outcome>" --accept "<observable criterion>"\`. Repeat \`--accept\` per criterion. Add \`--decision <id>\` for each decision record this work is bound by. Add \`--lane <tag>\` only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run \`inkan amend --reason "<what changed>"\` with the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run \`inkan end --met <n>... [--unmet <n>...] --note "<what happened>"\`. Every criterion gets a disposition. Put the printed \`Inkan-Outcome: <id>\` trailer in the commit message that lands the work. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run \`inkan status\` and \`inkan log -n 3\`. The open outcome is the task; continue it. To stop it, close it with a note. Do not begin over it.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal.

Decision records live in \`.inkan/decisions/\`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run \`inkan decision update <id> --status <status> --reason "<what changed>"\` or add a new record that supersedes it.

Outcome log: \`.inkan/outcomes/<id>.jsonl\`, one append-only file per outcome. Commit \`.inkan/\` with the code. Do not edit these files by hand.
${END_MARKER}`;
}

// Protocol 2, frozen verbatim for the same reason. Never edit.
function protocolBlockV2(lang) {
  return `${START_MARKER}
<!-- inkan-protocol: 2 -->
<!-- inkan-lang: ${lang} -->

## Agent protocol: sealed outcomes

This repository uses Inkan (\`inkan\`, alias \`ink\`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not run tests and does not judge the result; the repository's own checks do that. Write outcome prose in ${lang}.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run \`inkan begin "<outcome>" --accept "<observable criterion>"\`. Repeat \`--accept\` per criterion. Add \`--decision <id>\` for each decision record this work is bound by. Add \`--lane <tag>\` only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run \`inkan amend --reason "<what changed>"\` with the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run \`inkan end --met <n>... [--unmet <n>...] --note "<what happened>"\`. Every criterion gets a disposition. Put the printed \`Inkan-Outcome: <id>\` trailer in the commit message that lands the work: in the last paragraph of the message, next to any other trailers, with no blank line between them, because git reads trailers only from that final paragraph. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run \`inkan status\` and \`inkan log -n 3\`. The open outcome is the task; continue it. To stop it, close it with a note. Do not begin over it.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal.

Decision records live in \`.inkan/decisions/\`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run \`inkan decision update <id> --status <status> --reason "<what changed>"\` or add a new record that supersedes it.

Outcome log: \`.inkan/outcomes/<id>.jsonl\`, one append-only file per outcome. Commit \`.inkan/\` with the code. Do not edit these files by hand.
${END_MARKER}`;
}

// Protocol 3, frozen verbatim for the same reason. Never edit.
function protocolBlockV3(lang) {
  return `${START_MARKER}
<!-- inkan-protocol: 3 -->
<!-- inkan-lang: ${lang} -->

## Agent protocol: sealed outcomes

This repository uses Inkan (\`inkan\`, alias \`ink\`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not run tests and does not judge the result; the repository's own checks do that. Write outcome prose in ${lang}.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run \`inkan begin "<outcome>" --accept "<observable criterion>"\`. Repeat \`--accept\` per criterion. Add \`--decision <id>\` for each decision record this work is bound by. Add \`--lane <tag>\` only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run \`inkan amend --reason "<what changed>"\` with the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run \`inkan end --met <n>... [--unmet <n>...] --note "<what happened>"\`. Every criterion gets a disposition. Put the printed \`Inkan-Outcome: <id>\` trailer in the commit message that lands the work: in the last paragraph of the message, next to any other trailers, with no blank line between them, because git reads trailers only from that final paragraph. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run \`inkan status\` and \`inkan log -n 3\`. An open outcome that is the work you were asked to do is your task: continue it, or close it with a note. An open outcome that is not your work belongs to another session: leave it alone. Never close, amend, or abandon an outcome you did not work on, and do not judge why it is still open; begin your own outcome beside it.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal.

Decision records live in \`.inkan/decisions/\`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run \`inkan decision update <id> --status <status> --reason "<what changed>"\` or add a new record that supersedes it.

Outcome log: \`.inkan/outcomes/<id>.jsonl\`, one append-only file per outcome. Commit \`.inkan/\` with the code. Do not edit these files by hand.
${END_MARKER}`;
}

function protocolBlockV4(lang) {
  return `${START_MARKER}
<!-- inkan-protocol: 4 -->
<!-- inkan-lang: ${lang} -->

## Agent protocol: sealed outcomes

This repository uses Inkan (\`inkan\`, alias \`ink\`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not run tests and does not judge the result; the repository's own checks do that. Write outcome prose in ${lang}.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run \`inkan status\`; if it shows an open outcome that is not your work, follow rule 4 first. Then run \`inkan begin "<outcome>" --accept "<observable criterion>"\`. Repeat \`--accept\` per criterion. Add \`--decision <id>\` for each decision record this work is bound by. Add \`--lane <tag>\` only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run \`inkan amend --reason "<what changed>"\` with the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run \`inkan end --met <n>... [--unmet <n>...] --note "<what happened>"\`. Every criterion gets a disposition. Put the printed \`Inkan-Outcome: <id>\` trailer in the commit message that lands the work: in the last paragraph of the message, next to any other trailers, with no blank line between them, because git reads trailers only from that final paragraph. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run \`inkan status\` and \`inkan log -n 3\`. An open outcome that is the work you were asked to do is your task: continue it, or close it with a note. An open outcome that is not your work belongs to another session: leave it alone. Never close, amend, or abandon an outcome you did not work on, and do not judge why it is still open. Before beginning your own outcome beside it, stop and tell the person it is there, and ask whether your work should run in its own git worktree, because two sessions in one checkout record each other's files.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal.

Decision records live in \`.inkan/decisions/\`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run \`inkan decision update <id> --status <status> --reason "<what changed>"\` or add a new record that supersedes it.

Outcome log: \`.inkan/outcomes/<id>.jsonl\`, one append-only file per outcome. Commit \`.inkan/\` with the code. Do not edit these files by hand.
${END_MARKER}`;
}

const PROTOCOL_VERSION = 4;

/**
 * The managed block for `lang` at protocol `version`, current by default.
 * Earlier versions stay available verbatim so `init` can tell a block it
 * generated before from a hand edit (decision 0008).
 */
export function protocolBlock(lang, version = PROTOCOL_VERSION) {
  if (version === 1) return protocolBlockV1(lang);
  if (version === 2) return protocolBlockV2(lang);
  if (version === 3) return protocolBlockV3(lang);
  if (version === 4) return protocolBlockV4(lang);
  throw new InkanError(`unknown protocol version ${version}`);
}

/** Blocks compare equal ignoring only the parts `--lang` is allowed to change. */
function blockKey(block) {
  return block
    .replace(/<!-- inkan-lang: [^>]*-->/, '<!-- inkan-lang: LANG -->')
    .replace(/Write outcome prose in [^.]*\./, 'Write outcome prose in LANG.');
}

function extractBlock(content) {
  const start = content.indexOf(START_MARKER);
  if (start === -1) return null;
  const end = content.indexOf(END_MARKER, start);
  if (end === -1) throw new InkanError(`${AGENTS_FILENAME} has an unterminated inkan block`);
  const stop = end + END_MARKER.length;
  return { start, end: stop, text: content.slice(start, stop) };
}

export function init({ root, lang, claude = false }) {
  if (lang !== undefined && !LANG_RE.test(lang)) throw new InkanError(`malformed --lang "${lang}"`);

  const dir = path.resolve(root);
  const protocol = writeProtocol(dir, lang);
  const linked = claude ? linkClaudeFile(dir) : false;
  return {
    root: dir,
    agentsFile: protocol.agentsFile,
    changed: protocol.changed || linked,
    claudeFile: claude ? path.join(dir, CLAUDE_FILENAME) : null,
  };
}

/**
 * CLAUDE.md as a relative symlink to AGENTS.md, so Claude Code reads the one
 * policy rather than a copy (decision 0014). Returns whether anything
 * changed. An existing CLAUDE.md that is not that symlink is refused, never
 * replaced.
 */
function linkClaudeFile(dir) {
  const file = path.join(dir, CLAUDE_FILENAME);
  let stat = null;
  try {
    stat = fs.lstatSync(file);
  } catch {
    // absent
  }
  if (stat) {
    if (stat.isSymbolicLink() && fs.readlinkSync(file) === AGENTS_FILENAME) return false;
    throw new InkanError(`${CLAUDE_FILENAME} already exists and is not a symlink to ${AGENTS_FILENAME}; refusing to replace it`);
  }
  fs.symlinkSync(AGENTS_FILENAME, file);
  return true;
}

/** Write or upgrade the managed block; see decision 0008. */
function writeProtocol(dir, lang) {
  fs.mkdirSync(store.outcomesDir(dir), { recursive: true });
  fs.mkdirSync(store.decisionsDir(dir), { recursive: true });

  const agentsFile = path.join(dir, AGENTS_FILENAME);
  const existing = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf8') : null;

  if (existing === null) {
    fs.writeFileSync(agentsFile, `# Agent instructions\n\n${protocolBlock(lang ?? DEFAULT_LANG)}\n`, 'utf8');
    return { root: dir, agentsFile, changed: true };
  }

  const found = extractBlock(existing);
  if (!found) {
    const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(agentsFile, `${existing}${separator}${protocolBlock(lang ?? DEFAULT_LANG)}\n`, 'utf8');
    return { root: dir, agentsFile, changed: true };
  }

  const currentLang = found.text.match(/<!-- inkan-lang: ([^>]*)-->/);
  const resolvedLang = lang ?? (currentLang ? currentLang[1].trim() : DEFAULT_LANG);
  const generated = protocolBlock(resolvedLang);

  if (found.text === generated) return { root: dir, agentsFile, changed: false };
  // A block this tool generated under any protocol so far, differing at most
  // in language, is upgraded in place. Anything else was edited by hand.
  const foundKey = blockKey(found.text);
  let known = false;
  for (let v = 1; v <= PROTOCOL_VERSION; v += 1) {
    if (foundKey === blockKey(protocolBlock(resolvedLang, v))) known = true;
  }
  if (known) {
    const content = existing.slice(0, found.start) + generated + existing.slice(found.end);
    fs.writeFileSync(agentsFile, content, 'utf8');
    return { root: dir, agentsFile, changed: true };
  }
  throw new InkanError(`${AGENTS_FILENAME} inkan block was edited by hand; refusing to overwrite it`);
}

// --- skill install ----------------------------------------------------------

/** Every file under `dir`, as paths relative to `dir`, sorted. */
function listFilesRecursive(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...listFilesRecursive(full).map((f) => path.join(name, f)));
    else out.push(name);
  }
  return out.sort();
}

/** Whether `a` and `b` are directories with byte-identical file trees. */
function sameTree(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  const filesA = listFilesRecursive(a);
  const filesB = listFilesRecursive(b);
  if (filesA.length !== filesB.length || filesA.some((f, i) => f !== filesB[i])) return false;
  return filesA.every((rel) => fs.readFileSync(path.join(a, rel)).equals(fs.readFileSync(path.join(b, rel))));
}

/** Copies the bundled `skills/use-inkan/` to `<target>/use-inkan/`; refuses,
 * with no overwrite flag, when the destination exists and differs. */
export function skillInstall({ root, target, claude = false }) {
  if (target !== undefined && claude) throw new InkanError('skill install takes --claude or --target <dir>, not both');
  let base;
  if (target !== undefined) {
    if (!target.trim()) throw new InkanError('skill install --target needs a directory');
    base = path.resolve(target);
  } else {
    // The default and --claude are project installs under the Inkan root:
    // .agents/skills is what most hosts read, .claude/skills is Claude
    // Code's (decision 0014).
    base = path.join(resolveRoot(root), claude ? '.claude' : '.agents', 'skills');
  }
  const dest = path.join(base, 'use-inkan');
  if (fs.existsSync(dest)) {
    if (!sameTree(SKILL_SOURCE, dest)) {
      throw new InkanError(`${dest} already exists and differs from the bundled skill; remove it by hand first`);
    }
    return { dest };
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(SKILL_SOURCE, dest, { recursive: true });
  return { dest };
}
