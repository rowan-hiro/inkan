// MADR decision records under .inkan/decisions/NNNN-slug.md. `render` and
// `parse` are exact inverses for a well-formed file: every section is raw
// text, so reassembling them reproduces the original bytes. `appendHistory`
// is the only writer once a file exists, touching only Status and History.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { decisionsDir } from './store.js';

export const STATUSES = ['proposed', 'accepted', 'rejected', 'deferred', 'deprecated', 'superseded'];

const HEADINGS = [
  ['status', 'Status'],
  ['context', 'Context and Problem Statement'],
  ['drivers', 'Decision Drivers'],
  ['options', 'Considered Options'],
  ['outcome', 'Decision Outcome'],
  ['consequences', 'Consequences'],
  ['history', 'Decision History'],
];

function capitalizeStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/** Locate every `## Heading` line, in file order, with the offset where its body starts. */
function findHeadings(content) {
  const headingRe = /^## (.+?)\r?\n/gm;
  const found = [];
  let m;
  while ((m = headingRe.exec(content)) !== null) {
    found.push({ name: m[1], start: m.index, bodyStart: m.index + m[0].length });
  }
  return found;
}

/** Strip the blank-line padding a heading's body is wrapped in. */
function unwrap(raw) {
  let s = raw;
  if (s.startsWith('\n')) s = s.slice(1);
  if (s.endsWith('\n\n')) s = s.slice(0, -2);
  else if (s.endsWith('\n')) s = s.slice(0, -1);
  return s;
}

/** Parse one MADR record into `{ id, title, date, status, file, sections }`
 * (`sections` holds each heading's raw text). Throws naming `file` when a
 * heading is missing or the status token is unknown. */
export function parse(content, file) {
  const h1 = content.match(/^# (\d+)\.\s+(.+?)\r?\n/);
  if (!h1) throw new Error(`${file}: missing "# N. Title" heading`);
  const title = h1[2];
  const id = h1[1].padStart(4, '0');
  const dateMatch = content.match(/^Date:\s*(\S+)\s*$/m);
  if (!dateMatch) throw new Error(`${file}: missing "Date: YYYY-MM-DD" line`);
  const date = dateMatch[1];
  const found = findHeadings(content);
  const sections = {};
  let status;
  for (let i = 0; i < HEADINGS.length; i++) {
    const [key, name] = HEADINGS[i];
    const entry = found[i];
    if (!entry || entry.name !== name) {
      throw new Error(`${file}: missing required heading "## ${name}"`);
    }
    const bodyEnd = i + 1 < found.length ? found[i + 1].start : content.length;
    const body = unwrap(content.slice(entry.bodyStart, bodyEnd));
    if (key === 'status') {
      status = body.trim().toLowerCase();
      if (!STATUSES.includes(status)) throw new Error(`${file}: unknown status "${body.trim()}"`);
    } else {
      sections[key] = body;
    }
  }

  return { id, title, date, status, file, sections };
}

function wrap(raw, last) {
  if (raw === '') return '';
  return last ? `\n${raw}\n` : `\n${raw}\n\n`;
}

/** `* item1\n* item2...`, or `raw` itself if it is already a string (as `parse` returns it). */
function bullets(raw) {
  return Array.isArray(raw) ? raw.map((item) => `* ${item}`).join('\n') : raw ?? '';
}

/** Render `{ id, title, date, status, sections }` back into MADR text. Each
 * `sections` value is the raw per-heading text, or an array of bullet items. */
export function render({ id, title, date, status, sections = {} }) {
  let out = `# ${Number(id)}. ${title}\n\nDate: ${date}\n\n## Status\n${wrap(capitalizeStatus(status))}`;
  for (const [key, name] of HEADINGS.slice(1)) {
    out += `## ${name}\n${wrap(bullets(sections[key]), key === 'history')}`;
  }
  return out;
}

/** Every decision record under `.inkan/decisions/`, parsed and sorted by id. */
export function list(root) {
  const dir = decisionsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const file = path.join(dir, name);
      return parse(fs.readFileSync(file, 'utf8'), file);
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** One more than the highest decision id present, as a zero-padded string. */
export function nextId(root) {
  const max = list(root).reduce((acc, r) => Math.max(acc, Number(r.id)), 0);
  return String(max + 1).padStart(4, '0');
}

/** Lowercase, non-alphanumeric runs collapsed to one hyphen, trimmed, capped at 80 chars. */
export function slugify(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 80).replace(/-+$/, '');
}

function atomicWrite(file, content) {
  const dir = path.dirname(file);
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(temp, 'w', 0o644);
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
}

/** Append a dated history entry and set the new status; every other byte in
 * the file is preserved. `outcomeId` names the heading when given, else the
 * heading is a bare `### <ts>`. Returns the previous status. */
export function appendHistory(file, { ts, outcomeId, to, reason }) {
  const content = fs.readFileSync(file, 'utf8');
  const before = parse(content, file); // validates shape and the new status token below
  if (!STATUSES.includes(to)) throw new Error(`${file}: unknown status "${to}"`);
  const found = findHeadings(content);
  const statusEntry = found[0];
  const historyEntry = found[found.length - 1];
  const statusBodyEnd = found[1] ? found[1].start : content.length;
  const statusRaw = content.slice(statusEntry.bodyStart, statusBodyEnd);
  const token = statusRaw.match(/\S+/);
  const newStatusRaw =
    statusRaw.slice(0, token.index) + capitalizeStatus(to) + statusRaw.slice(token.index + token[0].length);
  const historyRaw = content.slice(historyEntry.bodyStart);
  const heading = outcomeId ? `### ${ts}, outcome ${outcomeId}` : `### ${ts}`;
  const newHistoryRaw = `${historyRaw}\n${heading}\n\nStatus: ${before.status} -> ${to}\n\n${reason}\n`;

  const newContent =
    content.slice(0, statusEntry.bodyStart) +
    newStatusRaw +
    content.slice(statusBodyEnd, historyEntry.bodyStart) +
    newHistoryRaw;

  atomicWrite(file, newContent);
  return before.status;
}
