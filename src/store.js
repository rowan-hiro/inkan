// Storage primitives: seal root discovery, outcome id generation, and durable
// reads/writes of per-outcome event files. No knowledge of event semantics
// lives here; that is fold.js.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DIR_NAME = '.inkan';

/**
 * Walk up from `startDir` looking for a `.inkan` directory. Returns the
 * directory that contains it, or null if none is found before the
 * filesystem root.
 */
export function findRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, DIR_NAME))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function outcomesDir(root) {
  return path.join(root, DIR_NAME, 'outcomes');
}

export function decisionsDir(root) {
  return path.join(root, DIR_NAME, 'decisions');
}

export function outcomeFile(root, id) {
  return path.join(outcomesDir(root), `${id}.jsonl`);
}

// Crockford base32, lowercase, with the vowels (a, e) also removed on top of
// Crockford's own exclusions (i, l, o, u) so an id never spells a word.
const ID_ALPHABET = '0123456789bcdfghjkmnpqrstvwxyz';

/**
 * A fresh `YYYY-MM-DD-HHMM-xxxx` id (UTC date, UTC hour and minute, four
 * random base32 characters), sorting chronologically to the minute with
 * random tie-breaking. `existingIds` dodges same-minute collisions; a true
 * cross-clone collision is left for `doctor` (M3) to report. Readers also
 * accept the earlier `YYYY-MM-DD-xxxx` form (see OUTCOME_ID_RE in cli.js).
 */
export function newOutcomeId(existingIds = []) {
  const existing = new Set(existingIds);
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const hhmm = now.slice(11, 13) + now.slice(14, 16);
  for (;;) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += ID_ALPHABET[crypto.randomInt(ID_ALPHABET.length)];
    }
    const id = `${date}-${hhmm}-${suffix}`;
    if (!existing.has(id)) return id;
  }
}

export function listOutcomeIds(root) {
  const dir = outcomesDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => name.slice(0, -'.jsonl'.length))
    .sort();
}

export function readOutcomeEvents(root, id) {
  const file = outcomeFile(root, id);
  const raw = fs.readFileSync(file, 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`${file}:${i + 1}: not valid JSON`);
      }
    });
}

function fsyncDir(dir) {
  let fd;
  try {
    fd = fs.openSync(dir, 'r');
    fs.fsyncSync(fd);
  } catch (err) {
    // Some platforms refuse to open or fsync a directory; that is not fatal.
    if (!['EINVAL', 'ENOTSUP', 'EBADF', 'EPERM', 'EISDIR'].includes(err.code)) throw err;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Append one event line to an existing outcome file, fsynced before return. */
export function appendEvent(root, id, event) {
  const file = outcomeFile(root, id);
  const line = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8');
  const fd = fs.openSync(file, 'a');
  try {
    fs.writeSync(fd, line);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Create a new outcome file containing exactly one event, failing if the
 * file already exists. Writes to a temporary file first and fsyncs it, then
 * links it into place, so the target name never appears with partial
 * content.
 */
export function createOutcomeFile(root, id, event) {
  const dir = outcomesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const target = outcomeFile(root, id);
  const temp = path.join(dir, `.${id}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const line = `${JSON.stringify(event)}\n`;
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o644);
    fs.writeFileSync(fd, line, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.linkSync(temp, target);
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
    }
    try {
      fs.unlinkSync(temp);
    } catch {
      // already gone
    }
  }
  fsyncDir(dir);
}
