// Synthetic benchmark for the review-cost targets in decision 0009. Seeds a
// temporary repository with many closed outcomes, bypassing begin/end
// validation so the timings below measure only file I/O and folding on
// reads; by default seeding itself skips fsync too (see `seed`'s `durable`
// option), since nothing here is meant to survive the process. `seed` and
// `runChecks` are exported so the in-suite benchmark (test/bench.test.js)
// can run the same thing at a smaller scale. Not part of the package
// `files`; run as `node bench/history.js`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from '../src/store.js';
import { computeContractHash } from '../src/fold.js';
import * as api from '../src/api.js';

export const DEFAULT_COUNT = 10000;
const LANES = [null, 'backend', 'frontend', 'infra'];
const ID_ALPHABET = '0123456789bcdfghjkmnpqrstvwxyz';

function randomSuffix() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  return s;
}

/** Writes a whole outcome file's events in one plain, unfsynced write. Only
 * for seeding throwaway benchmark repositories: it skips the durability
 * `src/store.js` gives real outcome files, which is exactly the cost this
 * fast path exists to avoid. */
function writeOutcomeFast(root, id, events) {
  const content = events.map((e) => `${JSON.stringify(e)}\n`).join('');
  fs.writeFileSync(store.outcomeFile(root, id), content, 'utf8');
}

/** Seeds `root` with `count` closed outcomes, spread across two and a half
 * years, a few lanes, and a few amendments. `durable` (default false) picks
 * between two ways to write each outcome file: fsynced appends through
 * src/store.js (what a real `begin`/`amend`/`end` does), or one plain write
 * with no fsync at all, which suffices for a benchmark of reads and is far
 * faster to seed. */
export function seed(root, count, { durable = false } = {}) {
  fs.mkdirSync(store.outcomesDir(root), { recursive: true });
  fs.mkdirSync(store.decisionsDir(root), { recursive: true });
  const start = Date.UTC(2023, 0, 1);
  const span = Date.UTC(2026, 8, 1) - start;

  for (let i = 0; i < count; i++) {
    const iso = new Date(start + Math.floor((span * i) / count)).toISOString();
    const id = `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}-${randomSuffix()}`;
    const lane = LANES[i % LANES.length];
    const outcome = i % 137 === 0 ? `Improve account recovery ${i}` : `Ship synthetic outcome ${i}`;
    const criteria = [{ text: `criterion a for ${i}`, withdrawn: false }, { text: `criterion b for ${i}`, withdrawn: false }];
    const amendments = [];

    const beginEvent = {
      v: 1,
      type: 'begin',
      id,
      ts: iso,
      outcome,
      criteria: criteria.map((c) => c.text),
      decisions: [],
      lane,
      head: null,
    };

    let amendEvent = null;
    if (i % 11 === 0) {
      const addition = `follow-up criterion for ${i}`;
      amendments.push({ reason: `scope adjusted for ${i}`, addition });
      criteria.push({ text: addition, withdrawn: false });
      amendEvent = {
        v: 1,
        type: 'amend',
        id,
        ts: iso,
        reason: amendments[0].reason,
        addition,
        criteria: [addition],
        withdraw: [],
        decisions: [],
        head: null,
      };
    }

    const contractHash = computeContractHash({ outcome, criteria, decisions: [], amendments });
    const endEvent = {
      v: 1,
      type: 'end',
      id,
      ts: iso,
      status: 'completed',
      dispositions: criteria.map((c, idx) => ({ criterion: idx + 1, met: true })),
      note: `Closed synthetically for benchmarking (${i}).`,
      contractHash,
      tree: null,
      head: null,
    };

    if (durable) {
      store.createOutcomeFile(root, id, beginEvent);
      if (amendEvent) store.appendEvent(root, id, amendEvent);
      store.appendEvent(root, id, endEvent);
    } else {
      writeOutcomeFast(root, id, amendEvent ? [beginEvent, amendEvent, endEvent] : [beginEvent, endEvent]);
    }
  }
}

function timeCall(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

/** Runs the three timed calls against `root` and returns `[{ label, ms }]`; the
 * caller supplies its own targets, since the test suite runs a smaller `root`
 * against tighter ones than the full benchmark below. */
export function runChecks(root) {
  return [
    { label: 'log({ n: 3 })', ms: timeCall(() => api.log({ root, n: 3 })) },
    { label: "log({ grep: 'recovery' })", ms: timeCall(() => api.log({ root, grep: 'recovery' })) },
    { label: 'doctor()', ms: timeCall(() => api.doctor({ root })) },
  ];
}

const TARGETS_MS = { 'log({ n: 3 })': 50, "log({ grep: 'recovery' })": 1000, 'doctor()': 2000 };

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-bench-'));
  try {
    console.log(`seeding ${DEFAULT_COUNT} closed outcomes in ${root} ...`);
    seed(root, DEFAULT_COUNT);
    let failed = false;
    for (const { label, ms } of runChecks(root)) {
      const targetMs = TARGETS_MS[label];
      const met = ms <= targetMs;
      if (!met) failed = true;
      console.log(`${label}: ${ms.toFixed(1)} ms (target ${targetMs} ms) ${met ? 'OK' : 'MISSED'}`);
    }
    process.exitCode = failed ? 1 : 0;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Only run the benchmark when executed directly; the test suite imports
// `seed` and `runChecks` above for its own smaller-scale run.
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
