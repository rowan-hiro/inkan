# 1. Inkan records the process and is not accountable for the result

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

An outcome-tracking tool for coding agents that gates closure on test
execution turns into a QA framework. Once closing an outcome depends on a
fresh passing run, that run becomes the only bridge between the sealed
outcome and the delivered work, so the tool grows verifier execution,
provenance tracking, and reconciliation logic around it. Because that run is
bound to a workspace state, every later amendment or decision reconciliation
invalidates it, and reviewing the log turns into a demand to redo the run.
The tool needs a boundary that keeps it from absorbing the repository's own
testing and review responsibilities.

## Decision Drivers

* Keep the tool accountable for the record of the process, not for the
  project result.
* Remove any mechanism that can invalidate a closed record and demand it be
  redone.
* Let agents challenge a decision when circumstances change without ever
  rewriting or re-litigating the scenario in which it was made.

## Considered Options

* Keep gating closure on a passing verifier run, scoped tighter than before.
* Drop the mandatory gate but keep an optional hook a repository can wire to
  its own test command.
* Remove verification from the tool entirely and record only what was
  declared, sealed, and closed.

## Decision Outcome

Inkan keeps a trustworthy record of the project process. It is not
accountable for the project result. A seal freezes the authoritative outcome
at the moment it was settled, and later delivery must stay faithful to it.
The record answers exactly three questions: is the stored outcome still A;
is what finally got committed A; was A swapped for B mid-way without an
explicit, reasoned amendment. Agents treat a seal as objective fact, may
challenge a decision when circumstances change, and never question the
scenario in which it was made; the original text is never rewritten. Every
check Inkan offers, `status`, `log`, and `check`, is a read-only query on
the record.

## Consequences

* Inkan never runs tests or any other shell command and never judges
  whether a declaration is true; the repository's own tooling does that.
* Closed records are final: reviewing the log is reading, not re-checking,
  and nothing in the record can demand to be redone.
* Closing over an open outcome without an explicit note is refused; the
  only path from one outcome to the next is a reasoned close.

## Decision History

### 2026-09-03T06:52:53.927Z, outcome 2026-09-03-0652-5g61

Status: accepted -> accepted

Superseded in part by 0013: the consequence that closing over an open outcome is refused is withdrawn. Open outcomes coexist and nothing closes an outcome on another session's behalf. The boundary itself stands.
