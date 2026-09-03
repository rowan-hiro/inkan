# 12. Import DriftSeal history with a one-shot converter

Date: 2026-09-03

## Status

Deferred

## Context and Problem Statement

The DriftSeal repository holds 53 outcomes and 23 decision records in its v2 and v3 log. Inkan has no automatic migration (0003). That history is worth keeping when the repository adopts Inkan.

## Decision Drivers

* Never rewrite what was recorded
* Drop what Inkan does not model
* One shot, deterministic, reviewable

## Considered Options

* No import; the repository starts fresh
* Model-assisted regrouping as DriftSeal did for v1 to v2
* A deterministic one-shot converter

## Decision Outcome

Deferred. When taken: `inkan import <events.jsonl> [--decisions <dir>]` converts closed DriftSeal outcomes into per-outcome files. `begin` maps to `begin` with the acceptance list as criteria and the old `lane` field as the tag; `extend` maps to `amend` with the reason `imported extension`; `verify` events are dropped; `verifyResult` and `note` are preserved in the end note. Completed outcomes get every criterion met, partial and failed outcomes get every criterion unmet, abandoned stays abandoned, and every imported end note says the dispositions were inferred at import. MADR files are copied with their reconciliation markers stripped. Open DriftSeal outcomes are refused.

Revisit trigger: the DriftSeal repository adopting Inkan, or the 0.1.0 release.

## Consequences

* Until then the two repositories keep separate histories
* The import is the last work item before the 0.1.0 release

## Decision History
