// The only child process Inkan ever spawns: git, with a fixed argument
// array. Never `shell: true`, never a user-supplied command string.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

function run(args, { cwd, env }) {
  return spawnSync('git', args, { cwd, env, encoding: 'utf8' });
}

/** The full sha `ref` resolves to, or null if it does not resolve here. */
export function revParse(cwd, ref) {
  const result = run(['rev-parse', ref], { cwd, env: process.env });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

/** The HEAD sha, or null outside a worktree or before the first commit. */
export function head(cwd) {
  return revParse(cwd, 'HEAD');
}

export function isWorktree(cwd) {
  const result = run(['rev-parse', '--is-inside-work-tree'], { cwd, env: process.env });
  return result.status === 0 && result.stdout.trim() === 'true';
}

/** The abbreviated form of `sha`, or `sha` itself if git cannot shorten it. */
export function shortSha(cwd, sha) {
  const result = run(['rev-parse', '--short', sha], { cwd, env: process.env });
  return result.status === 0 ? result.stdout.trim() : sha;
}

/** Values of `commit`'s `Inkan-Outcome` trailers, in order; empty if none or if `commit` does not resolve. */
export function trailerValues(cwd, commit) {
  const result = run(['log', '-1', '--format=%(trailers:key=Inkan-Outcome,valueonly)', commit], { cwd, env: process.env });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter((line) => line.length > 0);
}

/** The content of `filePath` as it exists in `commit`'s tree, or null if it is not there. */
export function showFile(cwd, commit, filePath) {
  const result = run(['show', `${commit}:${filePath}`], { cwd, env: process.env });
  return result.status === 0 ? result.stdout : null;
}

/** Whether `recordedTree` matches `commit`'s tree, `.inkan/outcomes` excluded. */
export function treeMatchesCommit(cwd, recordedTree, commit) {
  const result = run(
    ['diff-tree', '-r', '--quiet', recordedTree, `${commit}^{tree}`, '--', '.', ':(exclude).inkan/outcomes'],
    { cwd, env: process.env }
  );
  return result.status === 0;
}

/**
 * The tree hash of the working tree, `.inkan/outcomes` excluded, via the
 * temporary-index recipe from DESIGN.md. Returns null outside a worktree.
 * The temporary index file is always cleaned up.
 */
export function treeHash(cwd) {
  if (!isWorktree(cwd)) return null;
  const tmp = path.join(os.tmpdir(), `inkan-index-${process.pid}-${crypto.randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  try {
    let result = run(['read-tree', '--empty'], { cwd, env });
    if (result.status !== 0) throw new Error(`git read-tree failed: ${result.stderr}`);
    result = run(['add', '-A', '--', '.', ':(exclude).inkan/outcomes'], { cwd, env });
    if (result.status !== 0) throw new Error(`git add failed: ${result.stderr}`);
    result = run(['write-tree'], { cwd, env });
    if (result.status !== 0) throw new Error(`git write-tree failed: ${result.stderr}`);
    return result.stdout.trim();
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // already gone
    }
  }
}
