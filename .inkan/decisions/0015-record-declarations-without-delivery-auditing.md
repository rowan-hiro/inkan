# 15. Record declarations without delivery auditing

Date: 2026-09-09

## Status

Accepted

## Context and Problem Statement

On 2026-09-09 Hiro reviewed the delivery audit in 0006 and asked to remove it: even a read-only comparison invites an endless verification loop after work has been declared closed. A clone portability defect exposed that path, but the product decision is to remove the audit rather than repair it. Hiro separately confirmed that doctor should remain optional and must not become mandatory verification.

## Decision Drivers

* A closed declaration creates no later obligation to prove delivery again
* Keep records with the code without making Inkan inspect commits or the working tree
* Preserve historical records and provide optional diagnostics for damaged files

## Considered Options

* Repair tree comparison and retain check
* Remove delivery auditing and its Git machinery, retaining optional doctor diagnostics

## Decision Outcome

Remove the check command and API, working-tree snapshots, Git HEAD capture, and Inkan-Outcome trailer output and requirements. Inkan records intent, reasoned amendments, decision constraints, and the dispositions declared at close. It does not compare those declarations with commits. No runtime command spawns git or another child process. Existing event fields and historical trailers remain historical facts; old v1 outcomes remain readable without being rewritten or audited. Contract hashes still describe the recorded terms, and readers still reject corrupt event records. doctor remains an explicitly invoked file and reference diagnostic, never a step required to close work, commit it, or resume an agent session. Protocol 5 removes the trailer rule while retaining close-before-commit and separate-worktree guidance for concurrent edits. This supersedes 0006 and the delivery-audit portions of 0001, 0004, 0008, 0010, and 0013.

## Consequences

* There is no commit consistency verdict and no audit stage after closure
* Git remains the version-control tool used by people and agents; it is not a runtime dependency of Inkan
* Existing closed outcomes and decision Context and Decision Outcome sections are never rewritten
* doctor is available on demand but is absent from the normal workflow and generated protocol

## Decision History

### 2026-09-09T02:57:39.042Z, outcome 2026-09-09-0256-gxgm

Status: accepted -> accepted

Superseded in part by 0016 after Hiro distinguished a reference from an audit: end again prints Inkan-Outcome and Protocol 6 requires it on new landing commits. Reading the trailer is informational and never requires validation, repair, or backfilling history. The removal of check, Git state capture, and runtime Git execution stands; doctor remains optional.
