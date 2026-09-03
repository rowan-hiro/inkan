# 9. Bound review cost with the default view, not with an index

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

A long-lived repository accumulates thousands of outcomes. DriftSeal folded one shared log end to end to find the last three records and grew a SQLite read model to stay fast. The owner's concern was the cost of reviewing old records. The real cost is agent context, not disk, and any cache must never be consulted for correctness.

## Decision Drivers

* Recency without reading files
* The cheap view is the default view
* No derived state to keep in sync
* A measured threshold before any cache is considered

## Considered Options

* Keep a SQLite read model
* Derive an index lazily beside the files
* Rely on file naming and a one-line default view, with a benchmark as the gate

## Decision Outcome

Ids sort chronologically by name (0002 and its history), so `log -n N` sorts the directory listing and folds only N files. `log` prints one line per outcome, newest first, default 20: id, status, lane if any, headline, met count. The full record is `log <id>`. The filters `--lane`, `--since`, `--grep`, `--status`, and `--decision` fold every file and combine.

`bench/history.js` seeds ten thousand closed outcomes and requires `log -n 3` under 50 ms, `log --grep` under 1 s, and `doctor` under 2 s. A 2,000-outcome version runs in the test suite with proportionate limits.

No cache is built. If a real repository misses the targets, a read-through cache may be added as a pure performance layer that is never consulted for correctness, never committed, and rebuilt whenever absent. Not before.

## Consequences

* An agent re-anchoring reads a few short lines plus one file
* Filtered queries scale linearly with history, measured at about a quarter of a second for ten thousand outcomes
* The benchmark is the gate that any cache proposal must fail first

## Decision History
