import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, computeContractHash } from '../src/fold.js';

const FILE = 'test.jsonl';

function begin(overrides = {}) {
  return {
    v: 1,
    type: 'begin',
    id: '2026-01-01-aaaa',
    ts: '2026-01-01T00:00:00.000Z',
    outcome: 'Ship the thing',
    criteria: ['first', 'second'],
    decisions: [],
    lane: null,
    head: null,
    ...overrides,
  };
}

function amend(overrides = {}) {
  return {
    v: 1,
    type: 'amend',
    id: '2026-01-01-aaaa',
    ts: '2026-01-01T01:00:00.000Z',
    reason: 'circumstances changed',
    addition: null,
    criteria: [],
    withdraw: [],
    decisions: [],
    head: null,
    ...overrides,
  };
}

function endWith(events, overrides = {}) {
  const partial = fold(events, FILE);
  return {
    v: 1,
    type: 'end',
    id: '2026-01-01-aaaa',
    ts: '2026-01-01T02:00:00.000Z',
    status: 'completed',
    dispositions: [
      { criterion: 1, met: true },
      { criterion: 2, met: true },
    ],
    note: 'done',
    contractHash: partial.contractHash,
    tree: null,
    head: null,
    ...overrides,
  };
}

test('v must be 1', () => {
  assert.throws(() => fold([begin({ v: 2 })], FILE), /unsupported event version/);
});

test('unknown event type is refused', () => {
  assert.throws(() => fold([begin(), { v: 1, type: 'bogus', id: 'x' }], FILE), /unknown event type/);
});

test('begin must be first', () => {
  assert.throws(() => fold([amend()], FILE), /begin must be first and unique/);
});

test('begin must be unique', () => {
  assert.throws(() => fold([begin(), begin()], FILE), /begin must be first and unique/);
});

test('amend or end after close is refused', () => {
  const events = [begin(), endWith([begin()])];
  assert.throws(() => fold([...events, amend()], FILE), /amend after outcome closed/);
  assert.throws(() => fold([...events, endWith([begin()])], FILE), /end after outcome closed/);
});

test('open outcome folds with no status yet', () => {
  const record = fold([begin()], FILE);
  assert.equal(record.closed, false);
  assert.equal(record.outcome, 'Ship the thing');
  assert.equal(record.criteria.length, 2);
});

test('completed requires every live criterion met', () => {
  const events = [begin()];
  const end = endWith(events, {
    dispositions: [
      { criterion: 1, met: true },
      { criterion: 2, met: false },
    ],
  });
  assert.throws(() => fold([...events, end], FILE), /"completed" but a live criterion is unmet/);
});

test('partial requires at least one unmet', () => {
  const events = [begin()];
  const end = endWith(events, {
    status: 'partial',
    dispositions: [
      { criterion: 1, met: true },
      { criterion: 2, met: true },
    ],
  });
  assert.throws(() => fold([...events, end], FILE), /"partial" but no live criterion is unmet/);
});

test('partial requires a disposition for every live criterion', () => {
  const events = [begin()];
  const end = endWith(events, { status: 'partial', dispositions: [{ criterion: 1, met: false }] });
  assert.throws(() => fold([...events, end], FILE), /missing disposition for criterion 2/);
});

test('abandoned needs a note but no dispositions', () => {
  const events = [begin()];
  const end = endWith(events, { status: 'abandoned', dispositions: [] });
  const record = fold([...events, end], FILE);
  assert.equal(record.status, 'abandoned');
  assert.equal(record.dispositions.length, 0);
});

test('end without a note is refused', () => {
  const events = [begin()];
  const end = endWith(events, { status: 'abandoned', dispositions: [], note: '' });
  assert.throws(() => fold([...events, end], FILE), /end missing note/);
});

test('withdraw of an unknown criterion is refused', () => {
  assert.throws(() => fold([begin(), amend({ withdraw: [9] })], FILE), /withdraw of unknown/);
});

test('withdraw of an already-withdrawn criterion is refused', () => {
  const events = [begin(), amend({ withdraw: [1] })];
  assert.throws(() => fold([...events, amend({ withdraw: [1] })], FILE), /already-withdrawn/);
});

test('a disposition for a withdrawn criterion is refused', () => {
  const events = [begin(), amend({ withdraw: [2] })];
  const end = endWith(events, { dispositions: [{ criterion: 1, met: true }, { criterion: 2, met: true }] });
  assert.throws(() => fold([...events, end], FILE), /disposition for withdrawn criterion 2/);
});

test('a duplicate disposition is refused', () => {
  const events = [begin()];
  const end = endWith(events, {
    dispositions: [
      { criterion: 1, met: true },
      { criterion: 1, met: true },
      { criterion: 2, met: true },
    ],
  });
  assert.throws(() => fold([...events, end], FILE), /duplicate disposition for criterion 1/);
});

test('withdrawing a criterion removes it from what "completed" requires', () => {
  const events = [begin(), amend({ withdraw: [2] })];
  const end = endWith(events, { dispositions: [{ criterion: 1, met: true }] });
  const record = fold([...events, end], FILE);
  assert.equal(record.status, 'completed');
});

test('contract hash excludes the lane tag', () => {
  const withLane = fold([begin({ lane: 'backend' })], FILE);
  const withoutLane = fold([begin({ lane: null })], FILE);
  assert.equal(withLane.contractHash, withoutLane.contractHash);
});

test('contract hash changes when criteria or amendments change', () => {
  const base = fold([begin()], FILE);
  const amended = fold([begin(), amend({ criteria: ['third'] })], FILE);
  assert.notEqual(base.contractHash, amended.contractHash);
});

test('computeContractHash matches what fold records for a closed outcome', () => {
  const events = [begin()];
  const end = endWith(events);
  const record = fold([...events, end], FILE);
  const recomputed = computeContractHash({
    outcome: record.outcome,
    criteria: record.criteria,
    decisions: record.decisions,
    amendments: record.amendments,
  });
  assert.equal(record.contractHash, recomputed);
});

test('a tampered contract hash is detected as corruption', () => {
  const events = [begin()];
  const end = endWith(events, { contractHash: 'not-the-real-hash' });
  assert.throws(() => fold([...events, end], FILE), /contract hash does not match/);
});

test('a file with no events is corrupt', () => {
  assert.throws(() => fold([], FILE), /no events/);
});
