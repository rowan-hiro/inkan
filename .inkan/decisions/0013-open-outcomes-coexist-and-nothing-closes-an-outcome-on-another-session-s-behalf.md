# 13. Open outcomes coexist, and nothing closes an outcome on another session's behalf

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

On 2026-09-03 a second agent was asked to translate the README while another session held an open outcome for unrelated work in the same checkout. Protocol 2 step 4 said the open outcome is the task and, to stop it, close it with a note; and begin refused while any outcome was open. The second agent, following that text, was about to close the first session's outcome as abandoned and begin its own. It knew nothing about that work, so the abandoned status would have been a declaration made on someone else's behalf, which is the kind of untrue record the seal exists to prevent. The refusal in begin was written against one agent swapping A for B. With a second actor it stops no swap; it only forces a false record or a blocked agent.

## Decision Drivers

* A record never contains a declaration by someone who did not do the work
* Parallel sessions and parallel branches are normal, not an error
* An outcome is not accountable even for its own close (Hiro, 2026-09-03)
* Why an outcome stayed open is a question for a person to investigate, never a judgment for an agent to make
* No new fields, flags, or identity concepts

## Considered Options

* Keep the refusal and have the second agent stop and ask the person
* Add an --alongside <id> flag that acknowledges the other open outcome
* Let open outcomes coexist and forbid closing on another's behalf in the protocol

## Decision Outcome

begin never refuses because another outcome is open. It prints the new id on stdout and, on stderr, a notice naming the other open outcomes. amend, end, and decision update keep requiring an id when more than one outcome is open. Protocol 3 rewrites step 4: an open outcome that is the work you were asked to do is your task, continue it or close it with a note; an open outcome that is not your work belongs to another session, leave it alone, never close, amend, or abandon an outcome you did not work on, do not judge why it is still open, and begin your own beside it. An outcome left open is an honest record that it was never closed. Ten open outcomes are still traceable and auditable; finding out why one stayed open is a person's call. This supersedes the sentence in 0005 that begin refuses while another outcome is open and that an explicit close is the only path from A to B, and the matching consequence in 0001. The rest of both records stands. The --alongside flag was rejected because an agent would not know to use it and coexistence is already visible from timestamps.

## Consequences

* The mechanical guard against one agent leaving A open and starting B is gone; that case now shows as A open beside B in status, visible rather than disguised as a false close
* Parallel agents should still use separate git worktrees: end records the whole working tree, so two sessions in one checkout would record each other's uncommitted files and check would report a tree mismatch
* Protocol 3 is a new version with an upgrade path in init, as 0008 requires

## Decision History

### 2026-09-03T06:55:21.749Z, outcome 2026-09-03-0652-5g61

Status: accepted -> accepted

Hiro added a second reason on 2026-09-03: a forced close also invites an agent to work only in order to close the outcome, and closing for the sake of closing fills the log with junk records. An outcome left open costs nothing; a false close costs the record its trust.

### 2026-09-03T06:59:37.229Z, outcome 2026-09-03-0659-4y7h

Status: accepted -> accepted

Hiro added on 2026-09-03: an agent that meets an open outcome that is not its work does not judge it, but stops, tells the person it is there, and asks whether the work should run in its own git worktree. Protocol 4 carries this: rule 1 runs status before begin and defers to rule 4; rule 4 states the reminder.
