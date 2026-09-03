# 3. Rebuild as a new product instead of fixing DriftSeal

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

DriftSeal v3.3.5 (about 7,700 lines) hard-wired acceptance criteria to a shell verifier, gated `end` on a fresh passing run bound to a workspace hash, and invalidated that run on every `extend` and every decision reconciliation. Verification became the only bridge between the sealed outcome and the delivered work, so the tool grew into a QA framework.

About 300 of those lines were the seal itself. The rest was verifier execution, provenance, two-phase reconciliation, cross-lineage merge repair (`absorb`), park and sidecar management, a SQLite read model, v1 migration, protocol upgrade paths, and installers for five agent hosts. Removing the verifier would have left most of the weight and all of the sidecar complexity in place. The boundary in 0001 could not be reached by subtraction.

## Decision Drivers

* Remove the re-verification loop structurally, not by policy wording
* Shrink the product to what the three questions in 0001 need
* Keep a history that starts clean under the new boundary

## Considered Options

* Fix DriftSeal in place through phased removals of verify, provenance, and reconciliation gates
* Rewrite from scratch in a new repository under a new name

## Decision Outcome

Rewrite from scratch in a new repository with a smaller storage model (0002). There is no code dependency on DriftSeal; only small helpers are ported by copying and trimming: atomic file writes, MADR render and parse, the managed-block replace in `init`, and the temporary-repository test harness pattern.

DriftSeal history is not migrated automatically. A one-shot import is deferred (0012).

## Consequences

* No compatibility with DriftSeal state, commands, or protocol text
* The DriftSeal repository keeps working on its own until it adopts Inkan
* The founding documents PLAN.md and DESIGN.md served the build through M0 to M4 and were then folded into these decision records; there is no separate design document

## Decision History
