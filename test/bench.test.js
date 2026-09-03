import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as api from '../src/api.js';
import { seed, runChecks } from '../bench/history.js';

// Enforces DESIGN.md's "Reviewing history at scale" targets in the suite
// itself, at a smaller scale than bench/history.js so it stays fast to run.
test('log -n 3, log --grep, and doctor stay under their targets at 2,000 outcomes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-bench-test-'));
  try {
    seed(root, 2000);
    api.doctor({ root }); // warm-up call, excluded from the measured timings below.
    const ms = Object.fromEntries(runChecks(root).map((r) => [r.label, r.ms]));
    assert.ok(ms['log({ n: 3 })'] < 50, `log -n 3 took ${ms['log({ n: 3 })']} ms`);
    assert.ok(ms["log({ grep: 'recovery' })"] < 500, `log --grep took ${ms["log({ grep: 'recovery' })"]} ms`);
    assert.ok(ms['doctor()'] < 1000, `doctor took ${ms['doctor()']} ms`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
