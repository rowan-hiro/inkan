import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as api from '../src/api.js';
import * as store from '../src/store.js';
import { InkanError } from '../src/api.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-api-'));
}

function gitInit(dir) {
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function commitAll(dir, message) {
  spawnSync('git', ['add', '-A'], { cwd: dir });
  spawnSync('git', ['commit', '-q', '-m', message], { cwd: dir });
}

/** A ready-to-use Inkan repository, optionally backed by git. */
function repo({ withGit = false } = {}) {
  const root = tmpDir();
  if (withGit) gitInit(root);
  api.init({ root });
  return root;
}

// --- init ---------------------------------------------------------------

test('init creates storage dirs and writes AGENTS.md', () => {
  const root = tmpDir();
  const result = api.init({ root });
  assert.equal(result.changed, true);
  assert.ok(fs.existsSync(store.outcomesDir(root)));
  assert.ok(fs.existsSync(store.decisionsDir(root)));
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /^# Agent instructions/);
  assert.match(agents, /<!-- inkan -->/);
  assert.match(agents, /<!-- inkan-lang: en -->/);
});

test('init is idempotent', () => {
  const root = repo();
  const before = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const result = api.init({ root });
  assert.equal(result.changed, false);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), before);
});

test('init appends the block to an AGENTS.md that already has other content', () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# My project\n\nSome existing notes.\n');
  api.init({ root });
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Some existing notes\./);
  assert.match(agents, /<!-- inkan -->/);
});

test('init refuses a hand-edited block', () => {
  const root = repo();
  const agentsFile = path.join(root, 'AGENTS.md');
  const edited = fs.readFileSync(agentsFile, 'utf8').replace('Never report success', 'HAND EDITED');
  fs.writeFileSync(agentsFile, edited);
  assert.throws(() => api.init({ root }), /edited by hand/);
});

test('init rejects a malformed --lang', () => {
  const root = tmpDir();
  assert.throws(() => api.init({ root, lang: '!!!' }), InkanError);
});

test('init --lang upgrades only the language parts of an unmodified block', () => {
  const root = repo();
  const result = api.init({ root, lang: 'fr' });
  assert.equal(result.changed, true);
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /<!-- inkan-lang: fr -->/);
  assert.match(agents, /Write outcome prose in fr\./);
  // Re-running with the same lang is idempotent again.
  assert.equal(api.init({ root, lang: 'fr' }).changed, false);
});

test('init upgrades a block generated under an earlier protocol and still refuses hand edits', () => {
  for (const version of [1, 2, 3]) {
    const root = tmpDir();
    const agentsFile = path.join(root, 'AGENTS.md');
    const marker = new RegExp(`<!-- inkan-protocol: ${version} -->`);
    fs.writeFileSync(agentsFile, `# Agent instructions\n\n${api.protocolBlock('en', version)}\n`);
    assert.match(fs.readFileSync(agentsFile, 'utf8'), marker);
    const result = api.init({ root });
    assert.equal(result.changed, true);
    const agents = fs.readFileSync(agentsFile, 'utf8');
    assert.match(agents, /<!-- inkan-protocol: 4 -->/);
    assert.match(agents, /last paragraph of the message/);
    assert.match(agents, /belongs to another session/);
    assert.match(agents, /own git worktree/);
    assert.doesNotMatch(agents, marker);
    assert.equal(api.init({ root }).changed, false);
    // An earlier block with a hand edit is refused, not upgraded.
    const edited = api.protocolBlock('en', version).replace('Never report success', 'HAND EDITED');
    fs.writeFileSync(agentsFile, `# Agent instructions\n\n${edited}\n`);
    assert.throws(() => api.init({ root }), /edited by hand/);
  }
});

// --- begin ----------------------------------------------------------------

test('begin refuses outside an Inkan repository', () => {
  const root = tmpDir();
  assert.throws(() => api.begin({ root, outcome: 'x' }), /run "inkan init"/);
});

test('begin requires a non-empty outcome', () => {
  const root = repo();
  assert.throws(() => api.begin({ root, outcome: '  ' }), InkanError);
});

test('begin seals an outcome and records head', () => {
  const root = repo({ withGit: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'x');
  commitAll(root, 'first');
  const result = api.begin({ root, outcome: 'Ship it', accept: ['one', 'two'], lane: 'backend' });
  assert.match(result.id, /^\d{4}-\d{2}-\d{2}-\d{4}-[0-9a-z]{4}$/);
  assert.equal(result.lane, 'backend');
  assert.match(result.head, /^[0-9a-f]{40}$/);
});

test('begin without git records a null head', () => {
  const root = repo();
  const result = api.begin({ root, outcome: 'Ship it', accept: ['one'] });
  assert.equal(result.head, null);
});

test('begin allows another open outcome and names it without touching it', () => {
  const root = repo();
  const first = api.begin({ root, outcome: 'first', accept: ['a'] });
  const second = api.begin({ root, outcome: 'second', accept: ['b'] });
  assert.notEqual(second.id, first.id);
  assert.deepEqual(second.openAlongside, [{ id: first.id, outcome: 'first' }]);
  const open = api.status({ root }).open.map((r) => r.id).sort();
  assert.deepEqual(open, [first.id, second.id].sort());
  assert.equal(api.log({ root, id: first.id }).record.closed, false);
});

test('begin validates decision id format', () => {
  const root = repo();
  assert.throws(() => api.begin({ root, outcome: 'x', decision: ['12'] }), /malformed decision id/);
});

// --- amend ------------------------------------------------------------

test('amend requires a reason', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a'] });
  assert.throws(() => api.amend({ root, reason: '' }), /requires --reason/);
});

test('amend refuses when no outcome is open', () => {
  const root = repo();
  assert.throws(() => api.amend({ root, reason: 'why' }), /no outcome is open/);
});

test('amend refuses an ambiguous target and accepts an explicit id', () => {
  const root = repo();
  const a = api.begin({ root, outcome: 'a', accept: ['x'] });
  // Simulate a merge of two branches that each began an outcome: fabricate a
  // second open outcome file directly so its id is fixed.
  const bId = '2026-01-01-zzzz';
  store.createOutcomeFile(root, bId, {
    v: 1,
    type: 'begin',
    id: bId,
    ts: '2026-01-01T00:00:00.000Z',
    outcome: 'b',
    criteria: ['y'],
    decisions: [],
    lane: null,
    head: null,
  });

  assert.throws(() => api.amend({ root, reason: 'why' }), /more than one outcome is open/);
  const result = api.amend({ root, id: a.id, reason: 'why' });
  assert.equal(result.id, a.id);
});

test('amend appends criteria and changes the contract hash without touching the lane', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'], lane: 'backend' });
  const before = api.log({ root, id: begun.id }).record.contractHash;
  const amended = api.amend({ root, reason: 'scope grew', addition: 'more', accept: ['b'] });
  assert.notEqual(amended.contractHash, before);
  const record = api.log({ root, id: begun.id }).record;
  assert.equal(record.criteria.length, 2);
  assert.equal(record.lane, 'backend');
});

test('amend withdraw validates the index', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a', 'b'] });
  assert.throws(() => api.amend({ root, reason: 'x', withdraw: ['9'] }), /unknown or already-withdrawn/);
  api.amend({ root, reason: 'drop b', withdraw: ['2'] });
  assert.throws(() => api.amend({ root, reason: 'again', withdraw: ['2'] }), /unknown or already-withdrawn/);
});

test('amend refuses a closed outcome', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  assert.throws(() => api.amend({ root, id: begun.id, reason: 'x' }), /is closed; new work is a new outcome/);
});

// --- end ----------------------------------------------------------------

test('end requires a note', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a'] });
  assert.throws(() => api.end({ root, met: ['1'], note: '' }), /requires --note/);
});

test('end refuses an explicit status other than abandoned', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a'] });
  assert.throws(() => api.end({ root, status: 'completed', note: 'x' }), /malformed status/);
});

test('end refuses a missing disposition', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a', 'b'] });
  assert.throws(() => api.end({ root, met: ['1'], note: 'x' }), /criterion 2 needs a disposition/);
});

test('end derives completed when all live criteria are met', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a', 'b'] });
  const result = api.end({ root, met: ['1', '2'], note: 'all good' });
  assert.equal(result.status, 'completed');
  assert.equal(result.id, begun.id);
});

test('end derives partial when any live criterion is unmet, with a per-criterion note', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a', 'b'] });
  const result = api.end({ root, met: ['1'], unmet: ['2: follow-up later'], note: 'shipped part of it' });
  assert.equal(result.status, 'partial');
  const record = api.log({ root, id: result.id }).record;
  const two = record.dispositions.find((d) => d.criterion === 2);
  assert.equal(two.met, false);
  assert.equal(two.note, 'follow-up later');
});

test('end -s abandoned needs no dispositions', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a', 'b'] });
  const result = api.end({ root, status: 'abandoned', note: 'dropped' });
  assert.equal(result.status, 'abandoned');
  assert.equal(api.log({ root, id: begun.id }).record.dispositions.length, 0);
});

test('end records tree and head, null without git', () => {
  const root = repo();
  api.begin({ root, outcome: 'x', accept: ['a'] });
  const result = api.end({ root, met: ['1'], note: 'done' });
  const record = api.log({ root, id: result.id }).record;
  assert.equal(record.tree, null);
  assert.equal(record.head, null);
});

test('end refuses a second close of the same outcome', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  assert.throws(() => api.end({ root, id: begun.id, met: ['1'], note: 'again' }), /is closed; new work is a new outcome/);
});

test('end resolves an ambiguous target by id', () => {
  const root = repo();
  const a = api.begin({ root, outcome: 'a', accept: ['x'] });
  const bId = '2026-01-01-zzzz';
  store.createOutcomeFile(root, bId, {
    v: 1,
    type: 'begin',
    id: bId,
    ts: '2026-01-01T00:00:00.000Z',
    outcome: 'b',
    criteria: ['y'],
    decisions: [],
    lane: null,
    head: null,
  });
  assert.throws(() => api.end({ root, met: ['1'], note: 'x' }), /more than one outcome is open/);
  const result = api.end({ root, id: a.id, met: ['1'], note: 'x' });
  assert.equal(result.id, a.id);
});

// --- status / log -------------------------------------------------------

test('status reports nothing open on a fresh repo', () => {
  const root = repo();
  assert.deepEqual(api.status({ root }).open, []);
});

test('status lists open outcomes with a live contract hash', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  const open = api.status({ root }).open;
  assert.equal(open.length, 1);
  assert.equal(open[0].id, begun.id);
  assert.ok(open[0].contractHash);
});

test('log sorts by id descending and respects -n', () => {
  // The id suffix is random (decision 0002), so same-day ids are not in creation
  // order; "newest first" is precise to the day and, within a day, to the id
  // sort order. This checks that actual, documented ordering.
  const root = repo();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const begun = api.begin({ root, outcome: `outcome ${i}`, accept: ['a'] });
    api.end({ root, met: ['1'], note: 'done' });
    ids.push(begun.id);
  }
  const expected = [...ids].sort().reverse();
  const all = api.log({ root }).records;
  assert.deepEqual(all.map((r) => r.id), expected);
  const limited = api.log({ root, n: 2 }).records;
  assert.deepEqual(limited.map((r) => r.id), expected.slice(0, 2));
});

test('log filters by lane', () => {
  const root = repo();
  api.begin({ root, outcome: 'a', accept: ['x'], lane: 'backend' });
  api.end({ root, met: ['1'], note: 'done' });
  api.begin({ root, outcome: 'b', accept: ['x'], lane: 'frontend' });
  api.end({ root, met: ['1'], note: 'done' });
  const backend = api.log({ root, lane: 'backend' }).records;
  assert.equal(backend.length, 1);
  assert.equal(backend[0].outcome, 'a');
});

test('log --since keeps records sealed on or after the given date', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'old one', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  const sealedAt = api.log({ root, id: begun.id }).record.sealedAt;
  const before = new Date(Date.parse(sealedAt) - 1000).toISOString();
  const after = new Date(Date.parse(sealedAt) + 1000).toISOString();
  assert.deepEqual(api.log({ root, since: before }).records.map((r) => r.id), [begun.id]);
  assert.deepEqual(api.log({ root, since: after }).records, []);
  assert.throws(() => api.log({ root, since: 'not-a-date' }), /malformed --since/);
});

test('log --grep matches the headline, criteria, amendments, and note, case-insensitively', () => {
  const root = repo();
  api.begin({ root, outcome: 'Ship account RECOVERY', accept: ['a'] });
  api.amend({ root, reason: 'scope grew', addition: 'Rate-limit requests' });
  api.end({ root, met: ['1'], note: 'shipped as scoped' });
  api.begin({ root, outcome: 'unrelated', accept: ['b'] });
  api.end({ root, met: ['1'], note: 'done' });

  assert.equal(api.log({ root, grep: 'recovery' }).records.length, 1);
  assert.equal(api.log({ root, grep: 'rate-limit' }).records.length, 1);
  assert.equal(api.log({ root, grep: 'scoped' }).records.length, 1);
  assert.equal(api.log({ root, grep: 'nowhere-to-be-found' }).records.length, 0);
});

test('log --status filters by open or a closed status', () => {
  const root = repo();
  api.begin({ root, outcome: 'a', accept: ['x'] });
  api.end({ root, met: ['1'], note: 'done' });
  api.begin({ root, outcome: 'b', accept: ['x'] });
  assert.equal(api.log({ root, status: 'completed' }).records.length, 1);
  assert.equal(api.log({ root, status: 'open' }).records.length, 1);
  assert.equal(api.log({ root, status: 'abandoned' }).records.length, 0);
  assert.throws(() => api.log({ root, status: 'bogus' }), /malformed status/);
});

test('log --decision accepts 2, 02, or 0002 and filters by linked decisions', () => {
  const root = repo();
  api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  api.begin({ root, outcome: 'a', accept: ['x'], decision: ['0001'] });
  api.end({ root, met: ['1'], note: 'done' });
  api.begin({ root, outcome: 'b', accept: ['x'] });
  api.end({ root, met: ['1'], note: 'done' });
  assert.equal(api.log({ root, decision: '1' }).records.length, 1);
  assert.equal(api.log({ root, decision: '01' }).records.length, 1);
  assert.equal(api.log({ root, decision: '0001' }).records.length, 1);
});

test('log filters combine', () => {
  const root = repo();
  api.begin({ root, outcome: 'Ship account recovery', accept: ['a'], lane: 'backend' });
  api.end({ root, met: ['1'], note: 'done' });
  api.begin({ root, outcome: 'Ship account recovery too', accept: ['a'], lane: 'frontend' });
  api.end({ root, met: ['1'], note: 'done' });
  const records = api.log({ root, grep: 'recovery', lane: 'backend', status: 'completed' }).records;
  assert.equal(records.length, 1);
  assert.equal(records[0].outcome, 'Ship account recovery');
});

test('log <id> returns the full closed record', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'shipped' });
  const record = api.log({ root, id: begun.id }).record;
  assert.equal(record.closed, true);
  assert.equal(record.note, 'shipped');
  assert.equal(record.status, 'completed');
});

test('log rejects an unknown id', () => {
  const root = repo();
  assert.throws(() => api.log({ root, id: '2026-01-01-aaaa' }), /unknown outcome/);
});

// --- two worktrees of one repo -------------------------------------------

test('open outcomes are independent across two worktrees of one repo', () => {
  const main = tmpDir();
  gitInit(main);
  api.init({ root: main });
  // Empty directories are not tracked by git, so .inkan only shows up in a
  // clone or worktree once it holds a real, committed file.
  const seed = api.begin({ root: main, outcome: 'seed', accept: ['a'] });
  api.end({ root: main, met: ['1'], note: 'done' });
  commitAll(main, 'init');

  const second = path.join(path.dirname(main), `${path.basename(main)}-wt2`);
  const wt = spawnSync('git', ['worktree', 'add', '-q', '-b', 'feature', second], { cwd: main });
  assert.equal(wt.status, 0, wt.stderr?.toString());

  // The seeded, closed outcome is shared history, visible from both worktrees.
  assert.equal(api.log({ root: main }).records.length, 1);
  assert.equal(api.log({ root: second }).records.length, 1);

  const begunMain = api.begin({ root: main, outcome: 'main work', accept: ['a'] });
  assert.equal(api.status({ root: main }).open.length, 1);
  // The second worktree has its own working directory: the open outcome
  // sealed in `main` is untracked there and does not exist until committed.
  assert.equal(api.status({ root: second }).open.length, 0);

  const begunSecond = api.begin({ root: second, outcome: 'feature work', accept: ['b'] });
  assert.notEqual(begunMain.id, begunSecond.id);
  assert.notEqual(begunMain.id, seed.id);
  assert.equal(api.status({ root: main }).open.length, 1);
  assert.equal(api.status({ root: second }).open.length, 1);
});

// --- decisions ------------------------------------------------------------

test('decision add/show/list/update round-trip, and begin links a decision by status', () => {
  const root = repo();
  const added = api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'Use SQLite.' });
  assert.equal(added.id, '0001');
  assert.match(api.decisionShow({ root, id: '1' }).content, /^# 1\. Pick a database/);
  assert.deepEqual(api.decisionList({ root }).records.map((r) => [r.id, r.status]), [['0001', 'accepted']]);

  const begun = api.begin({ root, outcome: 'x', decision: ['0001'] });
  assert.deepEqual(begun.decisions, ['0001']);
  assert.deepEqual(api.status({ root }).open[0].decisionLinks, [{ id: '0001', status: 'accepted' }]);

  const updated = api.decisionUpdate({ root, id: '01', status: 'superseded', reason: 'no longer holds' });
  assert.deepEqual(updated, { id: '0001', from: 'accepted', to: 'superseded' });
  assert.deepEqual(api.status({ root }).open[0].decisionLinks, [{ id: '0001', status: 'superseded' }]);
  assert.deepEqual(api.decisionList({ root, status: 'superseded' }).records.map((r) => r.id), ['0001']);
});

test('begin and amend refuse an unknown decision id', () => {
  const root = repo();
  assert.throws(() => api.begin({ root, outcome: 'x', decision: ['0001'] }), /unknown decision "0001"/);
  api.begin({ root, outcome: 'x' });
  assert.throws(() => api.amend({ root, reason: 'why', decision: ['0001'] }), /unknown decision "0001"/);
});

test('status prints (missing) for a decision link whose file is gone', () => {
  const root = repo();
  const id = '2026-01-01-0000-dead';
  store.createOutcomeFile(root, id, {
    v: 1,
    type: 'begin',
    id,
    ts: '2026-01-01T00:00:00.000Z',
    outcome: 'x',
    criteria: ['a'],
    decisions: ['0009'],
    lane: null,
    head: null,
  });
  assert.deepEqual(api.status({ root }).open[0].decisionLinks, [{ id: '0009', status: null }]);
});

test('a legacy YYYY-MM-DD-xxxx outcome id still resolves', () => {
  const root = repo();
  const legacyId = '2026-01-01-zzzz';
  store.createOutcomeFile(root, legacyId, {
    v: 1,
    type: 'begin',
    id: legacyId,
    ts: '2026-01-01T00:00:00.000Z',
    outcome: 'legacy',
    criteria: ['a'],
    decisions: [],
    lane: null,
    head: null,
  });
  assert.equal(api.log({ root, id: legacyId }).record.outcome, 'legacy');
});

// --- skill install ----------------------------------------------------------

test('skill install copies the bundled skill and is idempotent', () => {
  const target = tmpDir();
  const dest = api.skillInstall({ target }).dest;
  assert.equal(dest, path.join(target, 'use-inkan'));
  assert.match(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8'), /^---\nname: use-inkan/);
  assert.doesNotThrow(() => api.skillInstall({ target }));
});

test('skill install refuses a destination that exists and differs, with no force flag', () => {
  const target = tmpDir();
  api.skillInstall({ target });
  fs.appendFileSync(path.join(target, 'use-inkan', 'SKILL.md'), '\ntampered\n');
  assert.throws(() => api.skillInstall({ target }), /already exists and differs/);
});

test('skill install defaults to .agents/skills under the Inkan root, --claude to .claude/skills', () => {
  const root = repo();
  const sub = path.join(root, 'src');
  fs.mkdirSync(sub);
  const dest = api.skillInstall({ root: sub }).dest;
  assert.equal(dest, path.join(root, '.agents', 'skills', 'use-inkan'));
  assert.ok(fs.existsSync(path.join(dest, 'SKILL.md')));
  const claudeDest = api.skillInstall({ root: sub, claude: true }).dest;
  assert.equal(claudeDest, path.join(root, '.claude', 'skills', 'use-inkan'));
  assert.ok(fs.existsSync(path.join(claudeDest, 'SKILL.md')));
});

test('skill install refuses --claude together with --target, and a default install outside a repository', () => {
  assert.throws(() => api.skillInstall({ root: tmpDir(), target: tmpDir(), claude: true }), /not both/);
  assert.throws(() => api.skillInstall({ root: tmpDir() }), /not an Inkan repository/);
});

// --- init --claude ----------------------------------------------------------

test('init --claude links CLAUDE.md to AGENTS.md and is idempotent', () => {
  const root = tmpDir();
  const first = api.init({ root, claude: true });
  assert.equal(first.changed, true);
  const claudeFile = path.join(root, 'CLAUDE.md');
  assert.ok(fs.lstatSync(claudeFile).isSymbolicLink());
  assert.equal(fs.readlinkSync(claudeFile), 'AGENTS.md');
  assert.equal(fs.readFileSync(claudeFile, 'utf8'), fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'));
  assert.equal(api.init({ root, claude: true }).changed, false);
  // Without the flag, init leaves CLAUDE.md alone and does not create one elsewhere.
  const plain = tmpDir();
  api.init({ root: plain });
  assert.ok(!fs.existsSync(path.join(plain, 'CLAUDE.md')));
});

test('init --claude refuses a CLAUDE.md that is not the symlink', () => {
  const root = tmpDir();
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# my own notes\n');
  assert.throws(() => api.init({ root, claude: true }), /not a symlink to AGENTS.md/);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), '# my own notes\n');
});
