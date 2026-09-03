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

/** The HEAD sha, or null outside a worktree or before the first commit. */
export function head(cwd) {
  const result = run(['rev-parse', 'HEAD'], { cwd, env: process.env });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

export function isWorktree(cwd) {
  const result = run(['rev-parse', '--is-inside-work-tree'], { cwd, env: process.env });
  return result.status === 0 && result.stdout.trim() === 'true';
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
