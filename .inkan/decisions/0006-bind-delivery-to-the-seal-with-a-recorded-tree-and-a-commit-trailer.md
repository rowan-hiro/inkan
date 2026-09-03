# 6. Bind delivery to the seal with a recorded tree and a commit trailer, and keep check read-only

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

The third question in 0001, whether what finally got committed is A, needs a link between a closed outcome and the commit that lands it. DriftSeal recorded only the parent HEAD, closed before the commit, and had nothing pointing from a commit back to an outcome. A post-commit event would dirty the tree again and force a second commit; git notes are not pushed by default.

## Decision Drivers

* The commit names the outcome
* The outcome describes the tree it was closed on
* The check is a query on the record, never a gate on the result

## Considered Options

* Append a post-commit event to the log
* Attach the link with git notes
* A commit trailer plus a recorded tree hash compared on demand

## Decision Outcome

At `end`, before the end line is written, Inkan records `tree` with the temporary-index recipe: `git read-tree --empty`, `git add -A -- . ':(exclude).inkan/outcomes'`, `git write-tree`, all under a throwaway `GIT_INDEX_FILE`. Outside a worktree `tree` is null. `.inkan/decisions` is inside the hash on purpose: a decision edited after `end` and before the commit is a real divergence.

`end` prints `Inkan-Outcome: <id>` and the protocol requires it as a trailer on the landing commit.

`inkan check [<commit>]` reads the trailers with `git log -1 --format=%(trailers:key=Inkan-Outcome,valueonly)`, loads each named outcome from the commit's own tree with `git show`, refolds it, and reports four facts: present in the commit; closed, with its status; hash matches the refold; tree matches the commit tree, tested with `git diff-tree -r --quiet <tree> <commit>^{tree} -- . ':(exclude).inkan/outcomes'`. An unreadable file is reported as unreadable, never as open. Exit 0 consistent, 1 mismatch, 2 no trailer.

`check` never touches the working tree, never repairs, and on mismatch prints only that a mismatch is a fact about that commit, recorded and not repaired. `init` never installs it as a hook.

## Consequences

* A change made after `end` and before the commit shows as a tree mismatch, which is the truthful record
* `end` itself compares nothing and gates nothing
* The only child process in Inkan is git with fixed argument arrays

## Decision History
