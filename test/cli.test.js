import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const INKAN = path.join(here, '..', 'bin', 'inkan.js');
const INK = path.join(here, '..', 'bin', 'ink.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-cli-'));
}

function run(bin, args, cwd) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
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

function normalize(output) {
  return output
    .replace(/\d{4}-\d{2}-\d{2}-(?:\d{4}-)?[0-9a-z]{4}/g, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<TS>')
    .replace(/Initialized Inkan in .*/g, 'Initialized Inkan in <DIR>');
}

test('help is printed for a bare invocation and for help/--help/-h', () => {
  const dir = tmpDir();
  const bare = run(INKAN, [], dir);
  const help = run(INKAN, ['help'], dir);
  const dashDash = run(INKAN, ['--help'], dir);
  const dashH = run(INKAN, ['-h'], dir);
  assert.equal(bare.status, 0);
  assert.match(bare.stdout, /Usage: inkan <command>/);
  assert.equal(bare.stdout, help.stdout);
  assert.equal(bare.stdout, dashDash.stdout);
  assert.equal(bare.stdout, dashH.stdout);
});

test('--version and -v print the package version', () => {
  const dir = tmpDir();
  const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
  const long = run(INKAN, ['--version'], dir);
  const short = run(INKAN, ['-v'], dir);
  assert.equal(long.stdout.trim(), pkg.version);
  assert.equal(short.stdout.trim(), pkg.version);
  assert.equal(long.status, 0);
});

test('an unknown command exits 1 with a message on stderr', () => {
  const dir = tmpDir();
  const result = run(INKAN, ['bogus'], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command/);
  assert.equal(result.stdout, '');
});

test('status outside an Inkan repository exits 1', () => {
  const dir = tmpDir();
  const result = run(INKAN, ['status'], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run "inkan init"/);
});

test('status on an initialized repo with nothing open exits 0', () => {
  const dir = tmpDir();
  run(INKAN, ['init'], dir);
  const result = run(INKAN, ['status'], dir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'no outcome open');
});

test('full begin/amend/end/status/log flow through the CLI', () => {
  const dir = tmpDir();
  assert.equal(run(INKAN, ['init'], dir).status, 0);

  const begin = run(INKAN, ['begin', 'Ship it', '--accept', 'one', '--accept', 'two'], dir);
  assert.equal(begin.status, 0);
  const id = begin.stdout.trim();
  assert.match(id, /^\d{4}-\d{2}-\d{2}-\d{4}-[0-9a-z]{4}$/);

  const amend = run(INKAN, ['amend', '--reason', 'scope grew', 'more work', '--accept', 'three'], dir);
  assert.equal(amend.status, 0);
  assert.match(amend.stdout.trim(), /^[0-9a-f]{64}$/);

  const status = run(INKAN, ['status'], dir);
  assert.equal(status.status, 0);
  assert.match(status.stdout, new RegExp(`\\[${id}\\] open`));
  assert.match(status.stdout, /3\. three/);
  assert.match(status.stdout, /amend .*: scope grew/);

  const missingDisposition = run(INKAN, ['end', '--met', '1', '--note', 'x'], dir);
  assert.equal(missingDisposition.status, 1);
  assert.match(missingDisposition.stderr, /needs a disposition/);

  const end = run(INKAN, ['end', '--met', '1', '--met', '2', '--unmet', '3: later', '--note', 'partially shipped'], dir);
  assert.equal(end.status, 0);
  const [firstLine, secondLine] = end.stdout.trim().split('\n');
  assert.equal(firstLine, `${id} partial`);
  assert.equal(secondLine, `Inkan-Outcome: ${id}`);

  const log = run(INKAN, ['log'], dir);
  assert.equal(log.status, 0);
  assert.match(log.stdout, new RegExp(`^${id}\\s+partial\\s+Ship it\\s+\\(2/3 met\\)$`, 'm'));

  const logId = run(INKAN, ['log', id], dir);
  assert.equal(logId.status, 0);
  assert.match(logId.stdout, /status: partial/);
  assert.match(logId.stdout, /note: partially shipped/);
  assert.match(logId.stdout, /3\. three \(unmet: later\)/);

  const afterClose = run(INKAN, ['end', id, '--met', '1', '--note', 'again'], dir);
  assert.equal(afterClose.status, 1);
  assert.match(afterClose.stderr, /is closed; new work is a new outcome/);
});

test('inkan and ink produce identical output for the same command sequence', () => {
  const dirA = tmpDir();
  const dirB = tmpDir();

  const steps = (bin, dir) => {
    const out = [];
    out.push(run(bin, ['init'], dir).stdout);
    out.push(run(bin, ['begin', 'Ship it', '--accept', 'one', '--accept', 'two', '--lane', 'core'], dir).stdout);
    out.push(run(bin, ['status'], dir).stdout);
    out.push(run(bin, ['end', '--met', '1', '--met', '2', '--note', 'done'], dir).stdout);
    out.push(run(bin, ['log'], dir).stdout);
    return out.map(normalize).join('\n---\n');
  };

  const fromInkan = steps(INKAN, dirA);
  const fromInk = steps(INK, dirB);
  assert.equal(fromInkan, fromInk);
});

test('check and doctor exit codes through the binary', () => {
  const dir = tmpDir();
  gitInit(dir);
  run(INKAN, ['init'], dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
  commitAll(dir, 'init');

  const noTrailer = run(INKAN, ['check'], dir);
  assert.equal(noTrailer.status, 2);
  assert.match(noTrailer.stdout, /no Inkan-Outcome trailer/);

  const id = run(INKAN, ['begin', 'Ship it', '--accept', 'a'], dir).stdout.trim();
  run(INKAN, ['end', '--met', '1', '--note', 'done'], dir);
  commitAll(dir, `feat: ship it\n\nInkan-Outcome: ${id}`);

  const consistent = run(INKAN, ['check'], dir);
  assert.equal(consistent.status, 0);
  assert.match(consistent.stdout, /\nconsistent\n$/);

  const cleanDoctor = run(INKAN, ['doctor'], dir);
  assert.equal(cleanDoctor.status, 0);
  assert.equal(cleanDoctor.stdout.trim(), 'ok: 1 outcomes, 0 decisions');

  // A source file changed after `end`, then committed: check reports a tree mismatch.
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed after end');
  commitAll(dir, `chore: change a.txt\n\nInkan-Outcome: ${id}`);
  const mismatch = run(INKAN, ['check'], dir);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stdout, /\nmismatch\n/);

  // A corrupt outcome file on disk: doctor reports it and exits 1.
  fs.appendFileSync(path.join(dir, '.inkan', 'outcomes', `${id}.jsonl`), 'not json\n');
  const brokenDoctor = run(INKAN, ['doctor'], dir);
  assert.equal(brokenDoctor.status, 1);
  assert.match(brokenDoctor.stdout, /not valid JSON/);
});

test('decision add/show/list/update through the CLI, and amend accepts a legacy id positional', () => {
  const dir = tmpDir();
  run(INKAN, ['init'], dir);

  const add = run(INKAN, ['decision', 'add', 'Pick a database', '--context', 'ctx', '--decision', 'dec'], dir);
  assert.equal(add.status, 0);
  assert.match(add.stdout.trim(), /0001-pick-a-database\.md$/);

  const show = run(INKAN, ['decision', 'show', '1'], dir);
  assert.match(show.stdout, /^# 1\. Pick a database/);

  const list = run(INKAN, ['decision', 'list'], dir);
  assert.equal(list.stdout.trim(), '0001  accepted  Pick a database');

  const update = run(INKAN, ['decision', 'update', '1', '--status', 'superseded', '--reason', 'why'], dir);
  assert.equal(update.stdout.trim(), '0001 accepted -> superseded');

  // A legacy `YYYY-MM-DD-xxxx` id must still be usable as the `amend` id
  // positional, not mistaken for the free-text addition.
  const legacyId = '2026-01-01-zzzz';
  const event = { v: 1, type: 'begin', id: legacyId, ts: '2026-01-01T00:00:00.000Z', outcome: 'x', criteria: ['a'], decisions: [], lane: null, head: null };
  fs.writeFileSync(path.join(dir, '.inkan', 'outcomes', `${legacyId}.jsonl`), `${JSON.stringify(event)}\n`);
  const amend = run(INKAN, ['amend', legacyId, '--reason', 'why'], dir);
  assert.equal(amend.status, 0);
});
