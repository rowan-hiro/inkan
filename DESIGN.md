# Inkan: design

This document is the implementation's source of truth going forward, kept
current as the design is built out and refined. `PLAN.md` stays in place as
the record of the milestone plan that produced this document; it is not
updated as implementation details are worked out here.

## Storage

```
.inkan/
  outcomes/<id>.jsonl      one append-only file per outcome
  decisions/NNNN-slug.md   MADR records
```

Everything under `.inkan/` is committed with the code. There are no
sidecars, no park file, no index, no lock directory, no `.gitignore`, and no
`INKAN_HOME`. A worktree that needs isolation is a worktree.

One file per outcome is the load-bearing choice. Two branches that begin
different outcomes never touch the same file, so ordinary Git merges work
with no merge driver, no id remapping, and no `absorb`. An open outcome is a
file without an `end` event. It may be untracked or committed; either is a
true record.

## Identity

Outcome id: `YYYY-MM-DD-HHMM-xxxx`, UTC date and UTC hour and minute of the
begin timestamp, then `xxxx` four random base32 characters. Ids sort
chronologically to the minute, with random tie-breaking within the same
minute; they are unguessable enough to avoid collisions across branches and
short enough to type. A reader also accepts the earlier `YYYY-MM-DD-xxxx`
form, so ids minted before the `HHMM` segment was added stay resolvable.
`doctor` reports a collision if one ever happens.

Decision id: sequential four-digit number, as MADR convention expects.
Collisions across branches are resolved by renaming the file; `doctor`
reports duplicates.

## Events

Each line is one JSON object with `v: 1`. Readers refuse a higher `v`.

```jsonc
{ "v": 1, "type": "begin", "id": "2026-09-03-1432-k7m2", "ts": "...",
  "outcome": "Ship account recovery",
  "criteria": ["expired links are rejected", "a valid link resets the password"],
  "decisions": ["0004"],
  "lane": null,                      // optional string tag, see Decisions 2
  "head": "<git HEAD or null>" }

{ "v": 1, "type": "amend", "id": "...", "ts": "...",
  "reason": "Security review asked for rate limiting on the recovery endpoint",
  "addition": "Rate-limit recovery requests per account",
  "criteria": ["more than five requests per hour are rejected"],
  "withdraw": [],                    // criterion indexes no longer part of A
  "decisions": [],
  "head": "..." }

{ "v": 1, "type": "end", "id": "...", "ts": "...",
  "status": "completed",            // completed | partial | abandoned
  "dispositions": [
    { "criterion": 1, "met": true },
    { "criterion": 2, "met": true },
    { "criterion": 3, "met": false, "note": "rate limiter lands in a follow-up" }
  ],
  "note": "What actually happened, in one or two sentences.",
  "contractHash": "<sha256>",
  "tree": "<git tree hash of the working tree, .inkan/outcomes excluded, or null>",
  "head": "..." }
```

Contract hash: sha256 over canonical JSON of `{ outcome, criteria with
withdrawn flags, decisions, amendments as [reason, addition] }`. The lane
tag is not part of the hash; it is a filing label, not part of what was
promised. The fold recomputes the hash; `end` stores it so later tampering
with earlier lines is detectable.

Fold rules: `begin` must be first and unique; `amend` and `end` only while
open; exactly one `end`; `completed` requires every live criterion met;
`partial` requires every live criterion to have a disposition and at least
one unmet; `abandoned` requires a note and needs no dispositions. A file
that violates these is reported as corrupt and never silently repaired.

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
| `inkan skill install --target <dir>` | Copies `skills/use-inkan/` to `<dir>/use-inkan/`; prints the destination. | The destination exists and differs from the bundled skill. |

`ink` accepts exactly the same arguments.

There is no `verify`, no `extend`, no `--force`, no `reclaim`, no `absorb`,
no lane catalog, no `migrate`. Closing over an open outcome means closing it
explicitly with a note; that is the only path from A to B and it leaves a
reasoned record.

## Library and CLI layers

`src/api.js` exports one function per command. Each takes a plain options
object plus a `root` directory, performs the operation, and returns a plain
serializable result or throws an `InkanError` with a user-facing message.
`src/cli.js` parses `argv`, calls the library, and prints. Nothing in
`src/api.js` reads `process.argv` or writes to stdout. This is the MCP hook
from Decisions 3 and it also keeps the tests fast: most of them call the
library directly and only a few spawn the binary.

## Reviewing history at scale

A long-lived repository accumulates hundreds or thousands of outcomes. Two
costs matter and they are different.

Machine cost. The old single-file log had to be folded end to end to find
the last three records, which is why it grew a SQLite index. Per-outcome
files remove that need: ids sort chronologically to the minute, so `log -n
3` sorts the directory listing and reads three files. Any filter
(`--lane`, `--since`, `--grep`, `--status`, `--decision`) reads more, and at
ten thousand outcomes that is about ten thousand small files, on the order
of thirty thousand lines and under ten megabytes, which folds in well under
a second on local disk. Git handles directories of that size routinely.

Agent cost. An agent cannot read a thousand records into context, so the
tool must make the cheap view the default. `log` prints one line per outcome
and nothing else; the full record is one file behind `log <id>`. The `end`
line carries the dispositions and the note, so reading a closed outcome
never means replaying its events. Filters narrow the scan before it reaches
the agent.

No derived cache is built up front. `bench/history.js` (`npm run bench`)
seeds a temporary repository with ten thousand closed outcomes directly
through `src/store.js` and times three calls through `src/api.js`: `log({ n:
3 })` against 50 ms, `log({ grep: 'recovery' })` against 1 s, and `doctor()`
against 2 s; it prints each timing and exits 1 if a target is missed. A
smaller version of the same benchmark, built at 2,000 outcomes with the
proportionally tighter targets 50 ms / 500 ms / 1 s, runs inside the test
suite so the targets are enforced on every run, not just measured on
demand. If a real repository breaks those targets, a read-through cache may
be added as a pure performance layer that is never consulted for
correctness, never committed, and rebuilt from the files whenever absent.
Not before.

## Tree hash

At `end`, before the end line is written:

```sh
GIT_INDEX_FILE=<tmp> git read-tree --empty
GIT_INDEX_FILE=<tmp> git add -A -- . ':(exclude).inkan/outcomes'
GIT_INDEX_FILE=<tmp> git write-tree
```

At `check`:

```sh
git diff-tree -r --quiet <recorded-tree> <commit>^{tree} -- . ':(exclude).inkan/outcomes'
```

Outside a Git worktree `tree` is `null` and `check` reports that binding is
unavailable. `.inkan/decisions` is inside the hash on purpose: a decision
edited after `end` and before the commit is a real divergence.

## Check and doctor output

`check` prints one block per `Inkan-Outcome` trailer on the resolved commit,
then a one-word summary:

```
9f06a7b  Inkan-Outcome: 2026-09-03-33cx
  outcome: present, closed (completed)
  hash: matches refold
  tree: matches commit tree
consistent
```

Each of the three fact lines can instead read `outcome: missing from
commit`, `outcome: present, open`, `outcome: present, unreadable (<parse
error>)`, `hash: does not match refold`, or `tree: differs from commit
tree`; a `tree: not recorded` line means the outcome was closed outside a
worktree, which is not itself a mismatch. Whichever fact
fails is the only line printed for it, the summary reads `mismatch` instead
of `consistent`, and the only further line it may print is `a mismatch is a
fact about this commit; it is recorded, not repaired`. A commit with no
trailer at all prints `<sha>  no Inkan-Outcome trailer` and nothing else.
Exit 0 consistent, 1 mismatch, 2 no trailer.

`doctor` prints one line per problem it finds (`outcome <id>: <message>` or
`decision <id-or-file>: <message>`) and exits 1, or prints `ok: <n>
outcomes, <m> decisions` and exits 0 when nothing is wrong. Neither command
repairs, deletes, or suggests redoing anything; both are exit codes for
scripting, not gates.

## Agent protocol

`init` writes this block. It is the whole policy; the skill and any future
MCP descriptions only point at it. It is generated verbatim by `inkan init`
and must be kept identical to `protocolBlock` in `src/api.js`.

```markdown
<!-- inkan -->
<!-- inkan-protocol: 1 -->
<!-- inkan-lang: en -->

## Agent protocol: sealed outcomes

This repository uses Inkan (`inkan`, alias `ink`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not run tests and does not judge the result; the repository's own checks do that. Write outcome prose in en.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run `inkan begin "<outcome>" --accept "<observable criterion>"`. Repeat `--accept` per criterion. Add `--decision <id>` for each decision record this work is bound by. Add `--lane <tag>` only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run `inkan amend --reason "<what changed>"` with the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run `inkan end --met <n>... [--unmet <n>...] --note "<what happened>"`. Every criterion gets a disposition. Put the printed `Inkan-Outcome: <id>` trailer in the commit message that lands the work. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run `inkan status` and `inkan log -n 3`. The open outcome is the task; continue it. To stop it, close it with a note. Do not begin over it.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal.

Decision records live in `.inkan/decisions/`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run `inkan decision update <id> --status <status> --reason "<what changed>"` or add a new record that supersedes it.

Outcome log: `.inkan/outcomes/<id>.jsonl`, one append-only file per outcome. Commit `.inkan/` with the code. Do not edit these files by hand.
<!-- /inkan -->
```

## Deliberately absent

| Absent | Why |
|---|---|
| Verifier execution, provenance, `--allow-tracked-command` | Running tests is the repository's job. Boundary sentence 1. |
| Invalidation semantics of any kind | Nothing in the record can become stale, so nothing can ask to be redone. `amend` appends; it clears nothing. This is what removes the re-verification loop. |
| Workspace-fingerprint gate on `end` | A gate on the result. The tree hash is recorded, not enforced. |
| Two-phase decision reconciliation, file hashes, mandatory reconcile before close | Forced every outcome to re-adjudicate settled decisions. Boundary sentence 4. |
| `absorb`, merge driver, `.gitattributes` | Per-outcome files do not collide. |
| Park sidecar, current-lane pointer, provenance file, lock directory | Every sidecar in the old code brought sandbox, gitignore, and recovery code with it. None is needed with per-outcome files. |
| SQLite index | Recency is free with per-outcome files. See "Reviewing history at scale" for the benchmark that would justify a cache later. |
| `begin --force` | A silent path from A to B. Close explicitly with a note instead. |
| `reclaim` / `unreclaim` | A view concern. `log -n` and `log <id>` cover the need. |
| Lane catalog, `lane add`, `lane switch`, current-lane pointer | The tag alone is the hook; see Decisions 2. |
| MCP server, MCP SDK dependency | Deferred behind the library layer; see Decisions 3. |
| v1/v2 migration, protocol upgrade paths for old versions | Fresh product line. A one-shot `import` for the DriftSeal v2/v3 log is M5. |
| Installers for five agent hosts, lifecycle hooks | Adapters, not the product. Skill install stays; the rest is documentation. |

## Runtime

Node 22 or newer, ESM, zero runtime dependencies. Tests use `node --test`.
Most tests call `src/api.js` directly against a temporary directory; a
smaller set spawns `bin/inkan.js` and `bin/ink.js` inside temporary Git
repositories to cover parsing, printing, and exit codes.

Size targets: `src/` under 1,500 lines, tests under 1,500 lines. If a
milestone pushes past that, the design is wrong, not the target.
