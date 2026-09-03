# 2. One append-only file per outcome, no cross-lineage merge tooling

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

A single shared outcome log file caused four kinds of trouble once more than
one branch was active at a time. Two branches that opened outcomes at
around the same time produced conflicting edits to the same file, and an
ordinary Git merge could not reconcile them, so the tool needed a dedicated
merge driver and a cross-lineage repair step to fix up what the merge left
broken. Sequential or timestamp-based ids collided when two branches picked
the same slot, which meant a reconciliation pass had to detect and rename
them after the fact. An outcome left open across a branch switch had
nowhere safe to live inside the shared file, so it was written out to a
park sidecar file, which brought its own recovery path with it. And finding
the most recent handful of records in a long, single file meant folding it
end to end, which eventually required a SQLite index just to stay fast.

## Decision Drivers

* Let ordinary Git merges resolve concurrent work across branches without a
  dedicated merge driver.
* Keep outcome identity simple enough that two branches never need a
  reconciliation pass to avoid a collision.
* Remove any need for a sidecar file to hold an open outcome across a
  branch switch.
* Keep recent-history lookups fast without building a derived index.

## Considered Options

* Keep one shared log file and add a merge driver plus a reconciliation pass
  to resolve collisions after the fact.
* Keep one log file per branch and merge the logs themselves at integration
  time.
* Give every outcome its own append-only file, named by a date-prefixed
  random id.

## Decision Outcome

Store one append-only file per outcome at `.inkan/outcomes/<id>.jsonl`,
where `<id>` is `YYYY-MM-DD-xxxx` with four random base32 characters as the
suffix. Two branches that begin different outcomes never touch the same
file, so ordinary Git merges resolve them with no merge driver, no id
remapping, and no cross-lineage repair tool. There is no park sidecar: an
open outcome is simply a file that has not yet received an `end` event, and
it is a true record whether or not it is tracked in Git yet. There is no
index: ids sort by date, so finding recent outcomes means listing a
directory and reading a handful of files.

## Consequences

* A collision between two random suffixes on the same day remains possible
  in principle; `doctor` reports it if one ever happens.
* Filtered queries such as `log --grep` or `log --since` read more than the
  recent handful of files, though still comfortably within budget at
  thousands of outcomes.
* Any future need for faster history search must come from a read-through
  cache that is never consulted for correctness, not from returning to a
  shared log file.

## Decision History
