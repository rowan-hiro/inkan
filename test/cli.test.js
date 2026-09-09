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
  assert.equal(end.stdout, `${id} partial\nInkan-Outcome: ${id}\n`);

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

test('check is absent and doctor remains an optional diagnostic', () => {
  const dir = tmpDir();
  run(INKAN, ['init'], dir);
  const help = run(INKAN, ['help'], dir);
  assert.doesNotMatch(help.stdout, /  check /);
  assert.match(help.stdout, /  doctor/);
  // Per-flag usage that protocol 7 no longer carries lives here.
  assert.match(help.stdout, /Repeat --accept once per/);
  assert.match(help.stdout, /Repeat --met or --unmet once/);
  assert.match(help.stdout, /every live criterion needs one/);
  const removed = run(INKAN, ['check'], dir);
  assert.equal(removed.status, 1);
  assert.match(removed.stderr, /unknown command "check"/);

  const id = run(INKAN, ['begin', 'Ship it', '--accept', 'a'], dir).stdout.trim();
  const ended = run(INKAN, ['end', '--met', '1', '--note', 'done'], dir);
  assert.equal(ended.status, 0);
  assert.equal(ended.stdout, `${id} completed\nInkan-Outcome: ${id}\n`);

  const cleanDoctor = run(INKAN, ['doctor'], dir);
  assert.equal(cleanDoctor.status, 0);
  assert.equal(cleanDoctor.stdout.trim(), 'ok: 1 outcomes, 0 decisions');

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

test('begin beside another open outcome prints the new id on stdout and names the other on stderr', () => {
  const dir = tmpDir();
  assert.equal(run(INKAN, ['init'], dir).status, 0);
  const first = run(INKAN, ['begin', 'First task', '--accept', 'a'], dir);
  assert.equal(first.stderr, '');
  const second = run(INKAN, ['begin', 'Second task', '--accept', 'b'], dir);
  assert.equal(second.status, 0);
  assert.match(second.stdout.trim(), /^\d{4}-\d{2}-\d{2}-\d{4}-[0-9a-z]{4}$/);
  assert.notEqual(second.stdout.trim(), first.stdout.trim());
  assert.match(second.stderr, new RegExp(`also open: ${first.stdout.trim()}  First task`));
  // The first outcome is untouched: still open, still the first line of status.
  const status = run(INKAN, ['status'], dir);
  assert.match(status.stdout, new RegExp(`\\[${first.stdout.trim()}\\] open`));
  assert.match(status.stdout, new RegExp(`\\[${second.stdout.trim()}\\] open`));
});
