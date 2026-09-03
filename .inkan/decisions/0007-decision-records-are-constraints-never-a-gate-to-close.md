# 7. Decision records are constraints, never a gate to close

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

DriftSeal required every linked MADR to be reconciled through prepare and commit events with file hashes before an outcome could close as completed or partial, and every `extend` invalidated that reconciliation. In practice nearly every reconciliation read Accepted to Accepted, confirmed. That is institutionalized re-adjudication of settled decisions and contradicts the rule in 0001 that agents never question the scenario a decision was made in.

## Decision Drivers

* Linking a decision means being bound by it
* Challenging a decision records what changed since, never rewrites what was decided
* No action on a decision is ever required to close an outcome

## Considered Options

* Keep mandatory reconciliation but only when a decision file changed
* Drop the gate and keep content hashes for tamper evidence
* Drop both and treat the link as a constraint

## Decision Outcome

`--decision <id>` on `begin` and `amend` records that the outcome is bound by the decision; the id must exist. `end` records the ids and does nothing else with them.

Decision records are MADR files with fixed headings in fixed order: title and number, date, Status, Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Decision History. `decision update <id> --status <status> --reason <text>` is the only writer after creation. It changes the Status value and appends to Decision History an entry of the form `### <ts>, outcome <id>` (naming the single open outcome when there is one), `Status: <from> -> <to>`, and the reason. Every other section is preserved byte for byte.

To challenge a decision, update its status with a reason or add a new record that supersedes it. `status` and `log <id>` print linked decisions with their current status, and `(missing)` when the file is gone. `doctor` reports dangling links and duplicate ids. There are no content hashes, no prepare and commit events, and no reconciliation gate.

## Consequences

* Closing an outcome never depends on the state of any decision
* A challenge is visible in the decision file itself, with its reason and the outcome that raised it
* Sequential decision ids can collide across branches and are resolved by renaming the file

## Decision History
