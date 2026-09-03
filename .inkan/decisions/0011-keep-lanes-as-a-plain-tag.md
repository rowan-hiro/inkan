# 11. Keep lanes as a plain tag

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

DriftSeal's lanes were a catalog with add, switch, and assign, a per-worktree current-lane pointer, and index support, built so that recent-log re-anchoring in a multi-capability repository lands on the right narrative. The owner wants the capability kept as a hook without the machinery.

## Decision Drivers

* Keep the extension point
* No sidecars and no catalog events
* The tag is filing, not promise

## Considered Options

* Drop lanes entirely
* A full catalog with switching and a current-lane pointer
* A plain optional tag on begin with a log filter

## Decision Outcome

`begin --lane <tag>` stores an optional string on the begin event; `status` and `log` print it; `log --lane <tag>` filters. The tag is not part of the contract hash. There is no catalog, no switching, and no current-lane pointer.

Extension trigger: if dogfooding shows `log -n 3` re-anchoring on the wrong narrative in a multi-capability repository, the next step is `log` defaulting to the open outcome's lane.

## Consequences

* Agents may misuse the tag as a milestone label, as happened once in this repository; the protocol says to add a lane only when the repository already files outcomes by lane
* The trigger above is the only reason to grow lanes

## Decision History
