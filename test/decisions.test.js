import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as decisions from '../src/decisions.js';
import * as store from '../src/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_DECISIONS_DIR = path.join(here, '..', '.inkan', 'decisions');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-decisions-'));
}

test('parse round-trips every shipped decision record byte for byte', () => {
  const names = fs.readdirSync(SHIPPED_DECISIONS_DIR).filter((n) => n.endsWith('.md'));
  assert.ok(names.length >= 2, "at least the two founding records");
  for (const name of names) {
    const file = path.join(SHIPPED_DECISIONS_DIR, name);
    const original = fs.readFileSync(file, 'utf8');
    const parsed = decisions.parse(original, file);
    assert.equal(decisions.render(parsed), original);
    assert.ok(decisions.STATUSES.includes(parsed.status));
    assert.match(parsed.id, /^\d{4}$/);
  }
});

test('add producing a file that parse reads back', () => {
  const root = tmpDir();
  const id = decisions.nextId(root);
  assert.equal(id, '0001');
  const dir = store.decisionsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}-${decisions.slugify('Pick a database')}.md`);
  const content = decisions.render({
    id,
    title: 'Pick a database',
    date: '2026-09-03',
    status: 'accepted',
    sections: {
      context: 'We need to store rows.',
      drivers: ['must be embeddable'],
      options: ['SQLite', 'Postgres'],
      outcome: 'Use SQLite.',
      consequences: ['no separate server process'],
      history: '',
    },
  });
  fs.writeFileSync(file, content, 'utf8');

  const parsed = decisions.parse(fs.readFileSync(file, 'utf8'), file);
  assert.equal(parsed.id, '0001');
  assert.equal(parsed.title, 'Pick a database');
  assert.ok(decisions.STATUSES.includes(parsed.status));
  assert.equal(parsed.sections.drivers, '* must be embeddable');
  assert.equal(parsed.sections.options, '* SQLite\n* Postgres');
  assert.equal(parsed.sections.outcome, 'Use SQLite.');
});

test('update preserves everything except Status and History byte for byte', () => {
  const root = tmpDir();
  const dir = store.decisionsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '0001-x.md');
  fs.writeFileSync(
    file,
    decisions.render({
      id: '0001',
      title: 'X',
      date: '2026-09-03',
      status: 'accepted',
      sections: { context: 'ctx', drivers: '* d1', options: '* o1\n* o2', outcome: 'out', consequences: '* c1', history: '' },
    }),
    'utf8'
  );

  const before = fs.readFileSync(file, 'utf8');
  const { history: beforeHistory, ...beforeRest } = decisions.parse(before, file).sections;

  const from = decisions.appendHistory(file, { ts: '2026-09-03T05:12:40.000Z', to: 'rejected', reason: 'no longer holds' });
  assert.equal(from, 'accepted');

  const after = fs.readFileSync(file, 'utf8');
  const afterParsed = decisions.parse(after, file);
  const { history: afterHistory, ...afterRest } = afterParsed.sections;
  assert.equal(afterParsed.status, 'rejected');
  assert.deepEqual(afterRest, beforeRest);
  assert.notEqual(afterHistory, beforeHistory);
  assert.equal(afterParsed.title, 'X');
  assert.equal(afterParsed.date, '2026-09-03');
  assert.match(after, /### 2026-09-03T05:12:40\.000Z\n\nStatus: accepted -> rejected\n\nno longer holds\n$/);
});

test('history heading names the outcome when given, and is bare without one', () => {
  const root = tmpDir();
  const dir = store.decisionsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '0001-x.md');
  fs.writeFileSync(
    file,
    decisions.render({
      id: '0001',
      title: 'X',
      date: '2026-09-03',
      status: 'accepted',
      sections: { context: 'ctx', drivers: '', options: '* o1', outcome: 'out', consequences: '* c1', history: '' },
    }),
    'utf8'
  );

  decisions.appendHistory(file, { ts: '2026-09-03T00:00:00.000Z', to: 'deferred', reason: 'first' });
  let content = fs.readFileSync(file, 'utf8');
  assert.match(content, /### 2026-09-03T00:00:00\.000Z\n\nStatus: accepted -> deferred/);

  decisions.appendHistory(file, {
    ts: '2026-09-04T00:00:00.000Z',
    outcomeId: '2026-09-03-1432-k7m2',
    to: 'accepted',
    reason: 'second',
  });
  content = fs.readFileSync(file, 'utf8');
  assert.match(content, /### 2026-09-04T00:00:00\.000Z, outcome 2026-09-03-1432-k7m2\n\nStatus: deferred -> accepted/);
});

test('list sorts by id and nextId is one more than the highest', () => {
  const root = tmpDir();
  const dir = store.decisionsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  for (const [id, title] of [['0002', 'B'], ['0001', 'A']]) {
    fs.writeFileSync(
      path.join(dir, `${id}-${decisions.slugify(title)}.md`),
      decisions.render({
        id,
        title,
        date: '2026-09-03',
        status: 'accepted',
        sections: { context: 'c', drivers: '', options: '* o', outcome: 'd', consequences: '* e', history: '' },
      }),
      'utf8'
    );
  }
  const records = decisions.list(root);
  assert.deepEqual(records.map((r) => r.id), ['0001', '0002']);
  assert.equal(decisions.nextId(root), '0003');
});

test('slugify lowercases, collapses non-alphanumerics, and caps at 80 characters', () => {
  assert.equal(decisions.slugify('One, Two!! Three'), 'one-two-three');
  assert.equal(decisions.slugify('--leading and trailing--'), 'leading-and-trailing');
  const long = decisions.slugify('a'.repeat(100));
  assert.ok(long.length <= 80);
});
