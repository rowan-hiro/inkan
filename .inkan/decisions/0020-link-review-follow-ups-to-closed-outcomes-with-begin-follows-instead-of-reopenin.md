# 20. Link review follow-ups to closed outcomes with begin --follows instead of reopening them

Date: 2026-09-28

## Status

Accepted

## Context and Problem Statement

On 2026-09-28 the maintainer pointed out that when review of closed work, code or documentation, asks for changes, 0005 requires a new outcome, so a long review leaves many related outcomes with nothing tying them together, some of them carrying declarations that a later round of review found wrong. A reader of the log cannot tell which outcomes belong to one piece of work. Reopening the closed outcome would keep the work in one record but would make its close provisional.

## Decision Drivers

* A closed outcome stays final and its file is never written again (0001, 0005)
* Two branches never touch the same outcome file (0002)
* Closing creates no later re-checking loop (0015)
* A reader sees one piece of work reviewed over several rounds as one thread
* Records written with the link stay readable by earlier Inkan releases

## Considered Options

* Reopen a closed outcome with a reasoned reopen event, then amend and close it again
* Keep an outcome open until review finishes and close it once at the end
* Link a new outcome to the closed outcomes it follows up with begin --follows

## Decision Outcome

The subject of this record is how outcomes link to earlier outcomes. begin --follows <id>, repeatable, records in the new outcome's begin event each closed outcome it follows up. begin refuses an id that is malformed, unknown, or still open: an open outcome is amended by whoever holds it, never followed. Nothing is written to a followed outcome, so it stays final as 0005 requires, and two branches that follow the same outcome each touch only their own new file (0002). The link is not part of the contract hash, like the lane tag, so every earlier hash stands and Inkan 0.7.0 reads a record that carries it. A followed file that is gone, as 0017 allows after a prune, is printed as missing and doctor does not report it. log marks a follow-up's line with what it follows; status and log <id> name each followed outcome with its status; log <id> prints the thread, every outcome the record follows and every outcome that follows it, directly or through others, in the order they were sealed. Followers are looked for only among ids from the record's UTC day on, because a follow-up is begun after what it follows has closed. Protocol 14 rule 5 says that when review of closed work asks for changes, the new outcome's inkan begin names each closed outcome it follows. Reopening was rejected: it supersedes the core of 0005, turns every close into a provisional declaration that review can reopen, which brings back the re-checking loop 0015 removed, and puts two branches reviewing the same outcome into one file against 0002. Holding an outcome open through review was rejected: it breaks close-then-commit with the trailer in the landing commit (0016), and review often arrives after the session that did the work has ended. amend does not take --follows.

## Consequences

* An intermediate outcome keeps the declaration it closed with; the follow-up records what review found, so a reader sees both instead of a rewritten close
* log <id> on an old outcome reads every file begun since its day; the default log view and the 0009 targets are unchanged
* A follower begun on an earlier UTC day than what it follows, which only a skewed clock can produce, is missing from the thread
* An outcome begun without --follows cannot be linked afterwards; add --follows to amend if that turns out to matter
* Protocol 14 is a new version with an upgrade path in init, as 0008 requires

## Decision History

### 2026-09-28T08:44:51.327Z, outcome 2026-09-28-0842-6sfc

Status: accepted -> accepted

amend now takes --follows, repeatable, so a link left out at begin can be added to the open outcome; this revises the sentence that amend does not take --follows and the consequence that an outcome begun without --follows cannot be linked afterwards. The maintainer asked for it on 2026-09-28, and asked whether the UTC-day scan in log <id> misses a follow-up whose local day crosses a UTC day, as in UTC+10. It does not: ids and timestamps are UTC, and the scan relies only on a follow-up being sealed after what it follows. amend --follows could break that, since an outcome begun before another could link to it later, so amend refuses a followed outcome sealed after the amended one; with begin, which only follows closed outcomes, a follow-up is always sealed after what it follows. The thread scan reads links from begin and amend events. The link stays out of the contract hash, and Inkan 0.7.0 still reads an amend event that carries it. Protocol 14 is unchanged: rule 5 already has a follow-up name what it follows, and amend --follows is the remedy when begin left it out.
