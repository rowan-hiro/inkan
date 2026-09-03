import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as api from '../src/api.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-check-'));
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

/** A git-backed Inkan repo with one file already committed. */
function repo() {
  const root = tmpDir();
  gitInit(root);
  api.init({ root });
  fs.writeFileSync(path.join(root, 'a.txt'), 'hello');
  commitAll(root, 'init');
  return root;
}

function outcomeFile(root, id) {
  return path.join(root, '.inkan', 'outcomes', `${id}.jsonl`);
}

function trailer(id) {
  return `Inkan-Outcome: ${id}\n`;
}

test('check reports consistent for a commit whose trailer matches what was recorded', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'Ship it', accept: ['a', 'b'] });
  api.end({ root, met: ['1', '2'], note: 'done' });
  commitAll(root, `feat: ship it\n\n${trailer(begun.id)}`);

  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.consistent, true);
  assert.deepEqual(result.reports[0].lines, [
    'outcome: present, closed (completed)',
    'hash: matches refold',
    'tree: matches commit tree',
  ]);
});

test('check reports no trailer on a commit that never named an outcome', () => {
  const root = repo();
  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.noTrailer, true);
});

test('check reports a missing outcome file', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  fs.rmSync(outcomeFile(root, begun.id));
  fs.writeFileSync(path.join(root, 'a.txt'), 'unrelated change so the commit is not empty');
  commitAll(root, `feat: oops\n\n${trailer(begun.id)}`);

  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.consistent, false);
  assert.deepEqual(result.reports[0].lines, ['outcome: missing from commit']);
});

test('check reports an outcome that is still open', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  commitAll(root, `feat: still open\n\n${trailer(begun.id)}`);

  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.consistent, false);
  assert.deepEqual(result.reports[0].lines, ['outcome: present, open']);
});

test('check reports a hash mismatch when a later commit tampers with committed criteria text', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  commitAll(root, `feat: ship\n\n${trailer(begun.id)}`);

  const file = outcomeFile(root, begun.id);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  lines[0].criteria = ['tampered'];
  fs.writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  commitAll(root, `chore: tamper with criteria text\n\n${trailer(begun.id)}`);

  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.consistent, false);
  assert.deepEqual(result.reports[0].lines, [
    'outcome: present, closed (completed)',
    'hash: does not match refold',
    'tree: matches commit tree',
  ]);
});

test('check reports a tree mismatch when a source file changes after end but before the commit', () => {
  const root = repo();
  const begun = api.begin({ root, outcome: 'x', accept: ['a'] });
  api.end({ root, met: ['1'], note: 'done' });
  fs.writeFileSync(path.join(root, 'a.txt'), 'changed after end');
  commitAll(root, `feat: ship\n\n${trailer(begun.id)}`);

  const result = api.check({ root, commit: 'HEAD' });
  assert.equal(result.consistent, false);
  assert.deepEqual(result.reports[0].lines, [
    'outcome: present, closed (completed)',
    'hash: matches refold',
    'tree: differs from commit tree',
  ]);
});
