# 5. A seal changes only by reasoned amendment and closes by disposition

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

The seal must answer two of the questions in 0001, whether the stored outcome is still A and whether A was swapped for B without authorization, and it must do so without any mechanism that can invalidate a closed record.

DriftSeal cleared verification and reconciliation on every `extend`, let `begin --force` abandon an outcome with a canned note, and required a passing verifier bound to a workspace hash before `end --status completed`. Those three mechanisms produced the re-verification loop: every review found something stale.

## Decision Drivers

* The original text is never rewritten
* Every change to the seal carries a reason
* Closing records what was declared, not what was proven
* Nothing in the record can become stale

## Considered Options

* Keep extend and a verifier gate but loosen them
* Make records mutable with an edit history
* Append-only amendments with mandatory reasons and dispositions at close

## Decision Outcome

An outcome is one append-only file of `v: 1` events: exactly one `begin` first, any number of `amend`, exactly one `end`. Readers refuse a higher `v`. The headline outcome text is immutable.

`amend` requires `--reason`. It may add criteria, withdraw criteria by index, carry an addition sentence, and link decisions. It clears nothing.

`end` requires `--note` and one disposition, met or unmet with an optional note, for every live criterion. Status is derived: all met is `completed`, any unmet is `partial`. `-s abandoned` skips dispositions and still requires the note.

The contract hash is sha256 over canonical JSON of the headline, the criteria with their withdrawn flags, the decision links, and the amendments as reason plus addition. The lane tag is excluded. `end` stores the hash so that tampering with earlier lines is detectable on refold. Fold rules are enforced on every read and a violating file is reported as corrupt, never repaired.

A closed outcome cannot be amended, re-closed, or reopened; new work is a new outcome. `begin` refuses while another outcome is open. There is no `--force`; the only path from A to B is an explicit close with a note. There is no verifier and no `--verify` flag.

## Consequences

* Inkan never executes anything to decide whether an outcome may close
* `status` and `log` show declarations and never a validity state, so reviewing history cannot find anything to redo
* More than one open outcome can arise only from a merge and is resolved by naming an id or closing with a note

## Decision History
