import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as api from '../src/api.js';
import * as store from '../src/store.js';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-doctor-'));
  api.init({ root });
  return root;
}

test('doctor reports ok when everything folds and parses cleanly', () => {
  const root = repo();
  api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  api.begin({ root, outcome: 'x', accept: ['a'], decision: ['0001'] });
  api.end({ root, met: ['1'], note: 'done' });
  assert.deepEqual(api.doctor({ root }), { outcomeCount: 1, decisionCount: 1, problems: [] });
});

test('doctor reports a corrupt outcome file without crashing', () => {
  const root = repo();
  const id = '2026-01-01-0000-aaaa';
  store.createOutcomeFile(root, id, {
    v: 1, type: 'begin', id, ts: '2026-01-01T00:00:00.000Z', outcome: 'x', criteria: ['a'], decisions: [], lane: null, head: null,
  });
  store.appendEvent(root, id, {
    v: 1, type: 'end', id, ts: '2026-01-01T00:00:01.000Z', status: 'completed',
    dispositions: [{ criterion: 1, met: true }], note: 'done', contractHash: 'not-the-real-hash', tree: null, head: null,
  });
  const result = api.doctor({ root });
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /^outcome 2026-01-01-0000-aaaa: .*contract hash does not match/);
  assert.match(result.problems[0], /\.inkan\/outcomes\/2026-01-01-0000-aaaa\.jsonl/);
  assert.equal(result.problems[0].includes(root), false);
});

test('doctor reports an outcome whose begin id does not match its file name', () => {
  const root = repo();
  const id = '2026-01-01-0000-bbbb';
  store.createOutcomeFile(root, id, {
    v: 1, type: 'begin', id: 'not-the-file-name', ts: '2026-01-01T00:00:00.000Z', outcome: 'x', criteria: [], decisions: [], lane: null, head: null,
  });
  const result = api.doctor({ root });
  assert.deepEqual(result.problems, [`outcome ${id}: begin id "not-the-file-name" does not match the file name`]);
});

test('doctor reports a decision file that fails to parse', () => {
  const root = repo();
  fs.mkdirSync(store.decisionsDir(root), { recursive: true });
  fs.writeFileSync(path.join(store.decisionsDir(root), '0001-broken.md'), 'not a madr file');
  const result = api.doctor({ root });
  assert.match(result.problems[0], /^decision 0001-broken\.md: \.inkan\/decisions\/0001-broken\.md: missing "# N\. Title" heading/);
  assert.equal(result.problems[0].includes(root), false);
});

test('doctor reports duplicate decision ids', () => {
  const root = repo();
  const { file } = api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  fs.copyFileSync(file, path.join(path.dirname(file), '0001-duplicate.md'));
  const result = api.doctor({ root });
  assert.equal(result.problems.length, 1);
  assert.equal(
    result.problems[0],
    'decision 0001: duplicate id (0001-duplicate.md, 0001-pick-a-database.md); name one record by its file name, ' +
      'and set decisionStart in .inkan/config.json to number new records apart'
  );
});

test('doctor reports a dangling decision link', () => {
  const root = repo();
  api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  const begun = api.begin({ root, outcome: 'x', accept: ['a'], decision: ['0001'] });
  api.end({ root, met: ['1'], note: 'done' });
  fs.rmSync(path.join(store.decisionsDir(root), '0001-pick-a-database.md'));
  const result = api.doctor({ root });
  assert.deepEqual(result.problems, [`outcome ${begun.id}: dangling decision link "0001-pick-a-database.md"`]);
});

test('doctor reports each duplicated decision id once, naming every file that carries it', () => {
  const root = repo();
  const { file } = api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  fs.copyFileSync(file, path.join(path.dirname(file), '0001-pick-a-queue.md'));
  fs.copyFileSync(file, path.join(path.dirname(file), '0001-pick-a-cache.md'));
  const result = api.doctor({ root });
  assert.equal(result.problems.length, 1);
  assert.match(
    result.problems[0],
    /^decision 0001: duplicate id \(0001-pick-a-cache\.md, 0001-pick-a-database\.md, 0001-pick-a-queue\.md\); /
  );
});

test('doctor reports a dangling link by id for an outcome that recorded no decision file', () => {
  const root = repo();
  const id = '2026-01-01-0000-cccc';
  store.createOutcomeFile(root, id, {
    v: 1, type: 'begin', id, ts: '2026-01-01T00:00:00.000Z', outcome: 'x', criteria: [], decisions: ['0009'], lane: null, head: null,
  });
  assert.deepEqual(api.doctor({ root }).problems, [`outcome ${id}: dangling decision link "0009"`]);
});

test('doctor accepts a link recorded by file while its id alone is shared, and still reports the shared id', () => {
  const root = repo();
  const { file } = api.decisionAdd({ root, title: 'Pick a database', context: 'ctx', decision: 'dec' });
  api.begin({ root, outcome: 'x', accept: ['a'], decision: ['0001'] });
  api.end({ root, met: ['1'], note: 'done' });
  fs.copyFileSync(file, path.join(path.dirname(file), '0001-pick-a-queue.md'));
  const result = api.doctor({ root });
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /^decision 0001: duplicate id/);
});
