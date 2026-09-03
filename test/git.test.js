import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as git from '../src/git.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-git-'));
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

test('outside a git repository, head/isWorktree/treeHash are all null/false', () => {
  const dir = tmpDir();
  assert.equal(git.head(dir), null);
  assert.equal(git.isWorktree(dir), false);
  assert.equal(git.treeHash(dir), null);
});

test('inside a fresh repo with no commits, head is null but treeHash works', () => {
  const dir = tmpDir();
  gitInit(dir);
  assert.equal(git.isWorktree(dir), true);
  assert.equal(git.head(dir), null);
  const hash = git.treeHash(dir);
  assert.match(hash, /^[0-9a-f]{40}$/);
});

test('head returns the current commit sha after a commit', () => {
  const dir = tmpDir();
  gitInit(dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
  commitAll(dir, 'first');
  const sha = git.head(dir);
  assert.match(sha, /^[0-9a-f]{40}$/);
});

test('treeHash excludes .inkan/outcomes but includes everything else', () => {
  const dir = tmpDir();
  gitInit(dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
  const before = git.treeHash(dir);

  fs.mkdirSync(path.join(dir, '.inkan', 'outcomes'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.inkan', 'outcomes', '2026-01-01-aaaa.jsonl'), '{}');
  const afterOutcome = git.treeHash(dir);
  assert.equal(afterOutcome, before, 'a new file under .inkan/outcomes must not change the tree hash');

  fs.writeFileSync(path.join(dir, 'b.txt'), 'world');
  const afterOther = git.treeHash(dir);
  assert.notEqual(afterOther, before, 'a new file elsewhere must change the tree hash');
});

test('treeHash does not leave a temporary index file behind', () => {
  const dir = tmpDir();
  gitInit(dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
  git.treeHash(dir);
  // Scoped to this process's own pid: node runs each test file in its own
  // process, and another file's concurrent treeHash call names its temp
  // file with a different pid, so this must not collide with that race.
  const leftovers = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith(`inkan-index-${process.pid}-`));
  assert.equal(leftovers.length, 0);
});
