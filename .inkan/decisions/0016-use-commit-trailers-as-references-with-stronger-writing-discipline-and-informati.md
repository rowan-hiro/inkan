# 16. Use commit trailers as references with stronger writing discipline and informational reading

Date: 2026-09-09

## Status

Accepted

## Context and Problem Statement

After removing delivery auditing in 0015, Hiro distinguished an outcome reference from a verification claim. On 2026-09-09 he agreed to retain Inkan-Outcome as a commit habit and auxiliary information: submission can require the reference more strongly, while readers must not turn it into mandatory verification.

## Decision Drivers

* Make the reason and declared scope of a commit easy to find
* Require useful metadata when writing new history without imposing retroactive obligations on readers
* Keep declaration recording independent of Git snapshots, audit verdicts, and hooks

## Considered Options

* Keep trailer output and requirements removed
* Restore trailers as informational references with an agent-side submission requirement

## Decision Outcome

end prints Inkan-Outcome: <id> after the outcome id and derived status. Protocol 6 requires the agent to include that line in the final trailer paragraph of the landing commit, beside other trailers without an intervening blank line. This is a writing requirement for the agent, not an executable gate in Inkan. When reading history, the trailer only associates a commit with an outcome; it certifies neither completion nor acceptance criteria nor the contents of the commit. Follow the reference when useful and prefer the outcome file stored in that commit for historical context. A missing trailer or unavailable referenced file is only missing information, not a failed outcome or an instruction to repair history. No reader must compare hashes, audit delivery, reopen work, or backfill trailers. check, Git state capture, and runtime Git execution stay removed; doctor remains optional. This supersedes only the trailer-removal portions of 0015 and its updates to 0004 and 0008; it does not revive the audit in 0006.

## Consequences

* New landing commits carry useful outcome references through the generated protocol and end output
* Existing commits and closed records remain final even when an association is absent or unavailable
* The link is usable with ordinary Git reads and Inkan record reads; no new reader command or metadata format is needed

## Decision History
