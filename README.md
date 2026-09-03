# Inkan

Inkan keeps a trustworthy record of a project's process. It is not
accountable for the project's result. A seal freezes the authoritative
outcome at the moment it was settled, and later delivery must stay faithful
to it. The record answers exactly three questions: is the stored outcome
still A; is what finally got committed A; was A swapped for B mid-way
without an explicit, reasoned amendment. Agents treat a seal as objective
fact: they may challenge a decision when circumstances change, but they
never question the scenario in which it was made, and the original text is
never rewritten.

Inkan is the successor to DriftSeal, rebuilt from scratch under a new name.

## The three questions

| Question | Mechanism |
|---|---|
| Is the stored outcome still A? | Append-only per-outcome file. Contract hash over the sealed text and its amendments. `status` prints the seal verbatim with its hash. |
| Is what got committed A? | `end` records the working-tree hash (git tree, log excluded). The landing commit carries an `Inkan-Outcome: <id>` trailer. `check <commit>` compares trailer, recorded tree, and the commit's tree. |
| Was A swapped for B without authorization? | The headline outcome is immutable. Criteria change only through `amend --reason`. Closing requires a recorded disposition for every criterion. `begin` refuses while an outcome is open and there is no `--force`. |

## Install

```sh
npm install --global inkan
```

This installs two identical commands: `inkan` and the short alias `ink`.
Use whichever reads better in a given script or shell history; they accept
exactly the same arguments.

## Core workflow

Seal an outcome before making durable changes:

```sh
inkan begin "Ship account recovery" \
  --accept "expired links are rejected" \
  --accept "a valid link resets the password"
```

This prints an id such as `2026-09-03-1432-k7m2`. If circumstances change
while the work is in progress, append to the same outcome instead of
reinterpreting it:

```sh
inkan amend --reason "Security review asked for rate limiting" \
  "Rate-limit recovery requests per account" \
  --accept "more than five requests per hour are rejected"
```

Close the outcome with a disposition for every criterion:

```sh
inkan end --met 1 --met 2 --met 3 --note "Shipped as scoped."
```

This prints an `Inkan-Outcome: <id>` trailer. Put it in the commit that
lands the work:

```sh
git commit -m "$(printf 'feat: account recovery\n\nInkan-Outcome: 2026-09-03-1432-k7m2\n')"
```

After losing context, whether from a new session or a new day, re-anchor
instead of guessing at what was in progress:

```sh
inkan status
inkan log -n 3
```

An open outcome found this way is the task at hand; continue it, or stop it
by closing it with a note. Never begin a new outcome over an open one.

Later, check whether a landed commit stayed faithful to what it claims:

```sh
inkan check HEAD
```

This reports whether the trailer, the recorded hash, and the recorded tree
line up with what the commit actually contains. It is a read-only report
about the past; it changes nothing and blocks nothing:

```
9f06a7b  Inkan-Outcome: 2026-09-03-33cx
  outcome: present, closed (completed)
  hash: matches refold
  tree: matches commit tree
consistent
```

A mismatch replaces the offending line (`outcome: missing from commit`,
`outcome: present, open`, `hash: does not match refold`, or `tree: differs
from commit tree`) and prints `mismatch` instead of `consistent`; nothing is
repaired. Exit 0 consistent, 1 mismatch, 2 when the commit carries no
`Inkan-Outcome` trailer at all.

`inkan doctor` folds every outcome and parses every decision, printing one
line per problem found (a corrupt file, an id that does not match its file
name, a duplicate decision id, a dangling decision link) or `ok: <n>
outcomes, <m> decisions` when there is nothing to report. Exit 0 clean, 1
problems; it never repairs or deletes anything either.

## Commands

| Command | Effect | Refuses when |
|---|---|---|
| `inkan init [--lang <tag>]` | Writes or upgrades the managed block in `AGENTS.md`; creates `.inkan/`. | The block was hand-edited. |
| `inkan begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]` | Seals a new outcome; prints its id. | Another outcome is open. The message lists it and says to close it with a note. |
| `inkan amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]... [--decision <id>]... [<id>]` | Appends an amendment; prints the new contract hash. | No reason. No open outcome. Ambiguous open outcome without `<id>`. |
| `inkan end [<id>] [--met <n>]... [--unmet <n> [--note]]... [-s abandoned] --note <text>` | Records dispositions and closes. Status is derived: all met is `completed`, any unmet is `partial`. Prints the commit trailer line. | A live criterion has no disposition, unless closing with `-s abandoned`. `abandoned` without a note. |
| `inkan status` | Prints every open outcome verbatim: sealed time, hash, lane, criteria with indexes, amendments with reasons, linked decisions. | Never. |
| `inkan log [-n N] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]` | One line per outcome, newest first, default 20: id, status, lane if any, headline, met count. `<id>` prints one outcome in full including amendments, dispositions, note, and tree. Filters narrow the scan. | Never. |
| `inkan check [<commit>]` | Read-only. Reads `Inkan-Outcome` trailers, loads each named outcome from the commit's own tree, refolds it, and reports: trailer present, outcome closed, recorded hash matches refold, recorded tree matches the commit tree. Exit 0 consistent, 1 mismatch, 2 no trailer. A mismatch is a fact about a past commit; it is reported, never repaired by redoing work. | Never blocks anything. Not installable as a hook by `init`. |
| `inkan doctor` | Folds every outcome file and parses every decision; reports corrupt files, an outcome whose `begin` id differs from its file name, duplicate decision ids, and dangling decision links. Exit 0 clean, 1 problems. | Never. |
| `inkan decision add "<title>" --context ... --decision ... [--driver]... [--option]... [--consequence]... [-s status]` | Writes a numbered MADR file. | Missing required sections. |
| `inkan decision update <id> --status <status> --reason <text>` | Appends a dated history entry to the MADR. Names the open outcome when there is one. Never edits Context or Decision sections. | Unknown id. |
| `inkan decision list [-s status]` / `show <id>` | Read-only. | Never. |

`ink` accepts exactly the same arguments.

## Decisions

Design choices worth defending are written as MADR (Markdown Architectural
Decision Records) under `.inkan/decisions/`, one numbered file per decision:
`NNNN-slug.md`. Each record's Context and Problem Statement and Decision
Outcome describe the scenario and the choice made at the time. Those two
sections are never edited once written; they are the historical record of
what was actually known and decided. When circumstances change,
`inkan decision update <id> --status <status> --reason "<text>"` appends a
dated history entry underneath instead of rewriting the original text, or a
new record is written that supersedes the old one. An outcome can name the
decisions it is bound by with `--decision <id>` on `begin` or `amend`.

## Storage

```
.inkan/
  outcomes/<id>.jsonl      one append-only file per outcome
  decisions/NNNN-slug.md   MADR records
```

Everything under `.inkan/` is committed with the code, the same as any other
project file. An outcome id looks like `2026-09-03-1432-k7m2`: a date, the
UTC hour and minute the outcome was begun, and four random characters, so
ids sort chronologically to the minute and two branches essentially never
collide. An open outcome is a file that has not yet received an `end`
event; it can be tracked or untracked in Git, either is a true record of work
in progress. Because each outcome has its own file, two branches that begin
different outcomes never touch the same file, and an ordinary Git merge is
enough to bring them together.

One file per outcome also keeps `log` and `doctor` fast without a cache:
`node bench/history.js` (`npm run bench`) seeds ten thousand closed outcomes
and checks that `log -n 3` stays under 50 ms, `log --grep` under 1 s, and
`doctor` under 2 s.

## What Inkan will not do

- It never runs tests, builds, or any other shell command. Whether the work
  is actually correct is the repository's own job, checked by its own
  tooling.
- It never blocks or gates a commit. `check` reports facts about a commit
  that already landed; nothing in Inkan runs before or during `git commit`.
- Closed records are final. There is no stale state, no invalidated state,
  and no notion that a closed outcome needs to be redone. Reviewing the log
  is reading, not re-checking.
- It keeps no sidecar files, no park file, no lock directory, no index, and
  no environment variable to relocate storage. Everything lives under
  `.inkan/` and is committed with the code.
- It has no merge driver and no cross-lineage repair tool. One append-only
  file per outcome means two branches never collide on the same file, so an
  ordinary Git merge is enough.
- It has no flag to force a new outcome open while one is already open.
  Closing an open outcome explicitly, with a note, is the only path from one
  outcome to the next.
- It has no lane catalog, no lane switching, and no current-lane pointer. A
  lane is a plain, optional filing tag, nothing more.
- It ships no MCP server and no installers for other agent hosts in this
  release; those are adapters, not the product.
- It does not migrate or import an older log in this release; that is a
  later milestone.
- It never silently repairs a corrupt record. A file that violates the event
  rules is reported as corrupt, not fixed.
