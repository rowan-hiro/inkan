# 17. Treat outcomes as prunable working records and MADR as the durable one

Date: 2026-09-10

## Status

Accepted

## Context and Problem Statement

On 2026-09-10 Hiro asked how to file outcomes by lane in a repository with several long-running directions, and whether a company-scale history of tens of thousands of outcomes would need an index. Filing by lane directory was proposed so that a lane-filtered recent log reads a few files instead of folding every one. Measuring first showed the premise was weaker than it looked, and the conversation then turned up a different framing: an outcome is consulted while its work runs and shortly after, while a decision record constrains work that has not started. In this repository 15 of 31 outcomes are named by a decision history; the other 16 are releases, README wording, CI, and gitignore edits that nothing will consult again.

## Decision Drivers

* Recent-log re-anchoring stays cheap without derived state
* Removing records must never be able to hide a failure
* A constraint that still binds new work stays in the working tree
* Measure before reshaping storage

## Considered Options

* File outcomes in per-lane directories
* Keep flat storage and stop a filtered read once N records match
* Add a read-through cache or a database index at company scale
* Keep storage as it is and let a shipped outcome leave the working tree

## Decision Outcome

An outcome is a working record. Once its work has landed it may leave the working tree, by an ordinary "git rm .inkan/outcomes/<year>-*.jsonl" that is committed like any other change. Nothing is lost: 0016 already prefers the outcome file stored in the landing commit, and already rules that an unavailable referenced file is missing information, not a failed outcome. MADR is the durable record. By MADR's own scope, anything inside an outcome that constrains later work is itself a decision and belongs in .inkan/decisions/, so what remains in a shipped outcome is backward-looking by construction, and Git already archives it.

The prune rule is by date and blind to status. Outcome status is success or failure, so a status-aware prune could quietly turn the log into a highlight reel; the date-prefixed id from 0002 makes a glob prune structurally incapable of picking by status. Outcomes named by a decision history are kept, so that a MADR record's own history does not dangle.

Because the working set is then bounded by this habit rather than growing with the age of the repository, storage does not need reshaping. Lanes stay a plain tag, 0011 unchanged. Outcomes stay flat, one append-only file each, 0002 unchanged. Neither a cache nor an index is built, 0009 unchanged. No code and no release accompanies this record.

A decision record may also leave the working tree once it is superseded, deprecated, or rejected, except where a live record names it in prose. The mechanism for that already exists and needs no new code: begin refuses to bind a decision whose file is gone, while status and log <id> print (missing) for an older link, so the working tree holds exactly the constraints that new work can still bind.

Measured on 2026-09-10 with bench/history.js against the targets in 0009. "log -n 3" takes 9 ms at ten thousand outcomes, 45 ms at fifty thousand, and 95 ms at a hundred thousand, against a 50 ms target, and at that size readdir and the id sort, not record reading, account for nearly all of it. A lane-filtered "log -n 3" folds every file and takes 162 ms at ten thousand; a prototype that stops once N records match returned identical records in 8.7 ms after reading 11 files. "status", which every session runs before begin, folds every file, takes 167 ms at ten thousand, and is not in the benchmark. In this repository, which holds 31 outcomes, status takes 1.03 ms.

Triggers. Reshape storage or add a cache when bench/history.js misses the 0009 targets on a real repository, never on synthetic history. Make log default to the open outcome's lane when the extension trigger in 0011 fires; as of 0.3.0 one of 31 outcomes carries a lane, so it has not. Build the early-stop read when a filtered query is slow enough to notice in real use. Document the prune in README, or give it a command, when .inkan/outcomes/ makes ordinary Git operations or the working tree slow. Prune decision records when superseded ones crowd the working tree; today one of sixteen is superseded and a live record names it.

## Consequences

* The prune is safe only while a decision is written whenever one is made; the failure mode moves from pruning too much to never filing the decision at all
* The protocol says when to bind a decision and never to edit one, but not when to create one; that gap is known and is not closed here
* Every option turned down here carries a condition that can be checked, most of them by running bench/history.js
* Nothing in the repository changes today: no storage layout, no code, and no release

## Decision History
