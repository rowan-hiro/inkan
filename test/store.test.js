import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as store from '../src/store.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-store-'));
}

test('newOutcomeId has the right shape and alphabet', () => {
  for (let i = 0; i < 50; i++) {
    const id = store.newOutcomeId([]);
    assert.match(id, /^\d{4}-\d{2}-\d{2}-\d{4}-[0-9a-z]{4}$/);
    const suffix = id.slice(-4);
    for (const ch of suffix) assert.ok(!'aeiou'.includes(ch), `${id} contains a vowel`);
  }
});

test('newOutcomeId avoids ids already in use', () => {
  const sample = store.newOutcomeId([]);
  const taken = `${sample.slice(0, -4)}aaaa`; // same date-HHMM prefix, a suffix never produced ("a" is excluded)
  const id = store.newOutcomeId([taken]);
  assert.notEqual(id, taken);
});

test('ids with different date-HHMM prefixes sort chronologically as plain strings', () => {
  const earlier = '2026-09-03-0500-zzzz';
  const later = '2026-09-03-0501-aaaa';
  assert.ok(earlier < later, 'a later minute must sort after an earlier one regardless of the random suffix');
});

test('a legacy YYYY-MM-DD-xxxx id has the shape listOutcomeIds and readOutcomeEvents still accept', () => {
  const root = tmpDir();
  const legacyId = '2026-01-01-zzzz';
  store.createOutcomeFile(root, legacyId, { v: 1, type: 'begin', id: legacyId });
  assert.deepEqual(store.listOutcomeIds(root), [legacyId]);
  assert.deepEqual(store.readOutcomeEvents(root, legacyId), [{ v: 1, type: 'begin', id: legacyId }]);
});

test('findRoot walks up to the nearest .inkan directory', () => {
  const root = tmpDir();
  fs.mkdirSync(path.join(root, '.inkan'), { recursive: true });
  const nested = path.join(root, 'a', 'b', 'c');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(store.findRoot(nested), root);
  assert.equal(store.findRoot(root), root);
});

test('findRoot returns null when there is no .inkan anywhere above', () => {
  const root = tmpDir();
  assert.equal(store.findRoot(root), null);
});

test('listOutcomeIds sorts and only counts .jsonl files', () => {
  const root = tmpDir();
  const dir = store.outcomesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-01-02-aaaa.jsonl'), '');
  fs.writeFileSync(path.join(dir, '2026-01-01-bbbb.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'not-an-outcome.txt'), '');
  assert.deepEqual(store.listOutcomeIds(root), ['2026-01-01-bbbb', '2026-01-02-aaaa']);
});

test('listOutcomeIds sorts a legacy id as though its missing HHMM segment were 0000', () => {
  const root = tmpDir();
  const dir = store.outcomesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-09-03-0455-kk9j.jsonl'), '');
  fs.writeFileSync(path.join(dir, '2026-09-03-33cx.jsonl'), '');
  fs.writeFileSync(path.join(dir, '2026-09-03-72q6.jsonl'), '');
  assert.deepEqual(store.listOutcomeIds(root), ['2026-09-03-33cx', '2026-09-03-72q6', '2026-09-03-0455-kk9j']);
});

test('listOutcomeIds on a repo with no outcomes dir yet', () => {
  const root = tmpDir();
  assert.deepEqual(store.listOutcomeIds(root), []);
});

test('createOutcomeFile writes one line and fails if the file exists', () => {
  const root = tmpDir();
  const event = { v: 1, type: 'begin', id: '2026-01-01-aaaa' };
  store.createOutcomeFile(root, '2026-01-01-aaaa', event);
  const events = store.readOutcomeEvents(root, '2026-01-01-aaaa');
  assert.deepEqual(events, [event]);
  assert.throws(() => store.createOutcomeFile(root, '2026-01-01-aaaa', event));
});

test('appendEvent adds a line to an existing file', () => {
  const root = tmpDir();
  const id = '2026-01-01-aaaa';
  store.createOutcomeFile(root, id, { v: 1, type: 'begin', id });
  store.appendEvent(root, id, { v: 1, type: 'end', id });
  const events = store.readOutcomeEvents(root, id);
  assert.equal(events.length, 2);
  assert.equal(events[1].type, 'end');
});

test('readOutcomeEvents rejects a corrupt JSON line', () => {
  const root = tmpDir();
  const dir = store.outcomesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '2026-01-01-aaaa.jsonl'), '{"v":1}\nnot json\n');
  assert.throws(() => store.readOutcomeEvents(root, '2026-01-01-aaaa'), /not valid JSON/);
});
