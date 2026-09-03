// Event validation and the fold of one outcome's events into a record.
// A file that violates the rules throws, naming the file, the line, and the
// rule. Never repaired, here or anywhere else.

import crypto from 'node:crypto';

const EVENT_TYPES = new Set(['begin', 'amend', 'end']);
const STATUSES = new Set(['completed', 'partial', 'abandoned']);

function corrupt(where, message) {
  return new Error(`${where}: ${message}`);
}

/** Deterministic JSON with sorted object keys, for hashing. */
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * sha256 over canonical JSON of { outcome, criteria with withdrawn flags,
 * decisions, amendments as [reason, addition] }. The lane tag is excluded on
 * purpose: it is a filing label, not part of what was promised.
 */
export function computeContractHash({ outcome, criteria, decisions, amendments }) {
  const payload = {
    outcome,
    criteria: criteria.map((c) => ({ text: c.text, withdrawn: c.withdrawn })),
    decisions,
    amendments: amendments.map((a) => [a.reason, a.addition ?? null]),
  };
  return crypto.createHash('sha256').update(canonicalJSON(payload)).digest('hex');
}

function positiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Fold one outcome's events into a plain record. `file` is used only to
 * label errors. Throws on any violation of the rules in decision 0005: `begin`
 * first and unique; `amend`/`end` only while open; exactly one `end`;
 * `completed` requires every live criterion met; `partial` requires every
 * live criterion to have a disposition and at least one unmet; `abandoned`
 * requires a note and needs no dispositions.
 */
export function fold(events, file) {
  if (!Array.isArray(events) || events.length === 0) throw corrupt(file, 'no events');

  const record = {
    id: null,
    outcome: null,
    lane: null,
    decisions: [],
    criteria: [],
    amendments: [],
    sealedAt: null,
    beginHead: null,
    closed: false,
  };
  let began = false;
  let closed = false;

  events.forEach((event, i) => {
    const where = `${file}:${i + 1}`;
    if (event === null || typeof event !== 'object') throw corrupt(where, 'event is not an object');
    if (event.v !== 1) throw corrupt(where, `unsupported event version ${event.v}`);
    if (!EVENT_TYPES.has(event.type)) throw corrupt(where, `unknown event type "${event.type}"`);

    if (event.type === 'begin') {
      if (i !== 0 || began) throw corrupt(where, 'begin must be first and unique');
      began = true;
      if (!event.outcome || typeof event.outcome !== 'string') {
        throw corrupt(where, 'begin missing an outcome');
      }
      record.id = event.id;
      record.outcome = event.outcome;
      record.lane = event.lane ?? null;
      record.sealedAt = event.ts;
      record.beginHead = event.head ?? null;
      for (const text of event.criteria ?? []) {
        record.criteria.push({ index: record.criteria.length + 1, text, withdrawn: false });
      }
      for (const d of event.decisions ?? []) {
        if (!record.decisions.includes(d)) record.decisions.push(d);
      }
      return;
    }

    if (!began) throw corrupt(where, 'begin must be first and unique');
    if (closed) throw corrupt(where, `${event.type} after outcome closed`);

    if (event.type === 'amend') {
      if (!event.reason || typeof event.reason !== 'string') throw corrupt(where, 'amend missing reason');
      for (const raw of event.withdraw ?? []) {
        const n = positiveInteger(raw);
        const criterion = n === null ? null : record.criteria[n - 1];
        if (!criterion || criterion.withdrawn) {
          throw corrupt(where, `withdraw of unknown or already-withdrawn criterion ${raw}`);
        }
        criterion.withdrawn = true;
      }
      for (const text of event.criteria ?? []) {
        record.criteria.push({ index: record.criteria.length + 1, text, withdrawn: false });
      }
      for (const d of event.decisions ?? []) {
        if (!record.decisions.includes(d)) record.decisions.push(d);
      }
      record.amendments.push({
        ts: event.ts,
        reason: event.reason,
        addition: event.addition ?? null,
        head: event.head ?? null,
      });
      return;
    }

    // event.type === 'end'
    if (!STATUSES.has(event.status)) throw corrupt(where, `unknown status "${event.status}"`);
    if (!event.note || typeof event.note !== 'string') throw corrupt(where, 'end missing note');

    const seen = new Set();
    const dispositions = [];
    for (const d of event.dispositions ?? []) {
      const n = positiveInteger(d?.criterion);
      const criterion = n === null ? null : record.criteria[n - 1];
      if (!criterion) throw corrupt(where, `disposition for unknown criterion ${d?.criterion}`);
      if (criterion.withdrawn) throw corrupt(where, `disposition for withdrawn criterion ${n}`);
      if (seen.has(n)) throw corrupt(where, `duplicate disposition for criterion ${n}`);
      seen.add(n);
      dispositions.push({ criterion: n, met: Boolean(d.met), note: d.note ?? null });
    }

    if (event.status !== 'abandoned') {
      for (const c of record.criteria) {
        if (!c.withdrawn && !seen.has(c.index)) {
          throw corrupt(where, `missing disposition for criterion ${c.index}`);
        }
      }
      const anyUnmet = dispositions.some((d) => !d.met);
      if (event.status === 'completed' && anyUnmet) {
        throw corrupt(where, 'status "completed" but a live criterion is unmet');
      }
      if (event.status === 'partial' && !anyUnmet) {
        throw corrupt(where, 'status "partial" but no live criterion is unmet');
      }
    }

    const expectedHash = computeContractHash(record);
    if (event.contractHash !== expectedHash) {
      throw corrupt(where, 'contract hash does not match the folded record (tampering or corruption)');
    }

    record.closed = true;
    record.closedAt = event.ts;
    record.status = event.status;
    record.dispositions = dispositions;
    record.note = event.note;
    record.contractHash = event.contractHash;
    record.tree = event.tree ?? null;
    record.head = event.head ?? null;
    closed = true;
  });

  if (!began) throw corrupt(file, 'begin must be first and unique');
  if (!record.closed) record.contractHash = computeContractHash(record);
  return record;
}
