# Inkan: implementation plan

Status: approved direction, nothing implemented yet. Inkan (印鑑) is the
successor to DriftSeal, rebuilt from scratch under a new name. Package
`inkan`, commands `inkan` and the short alias `ink`.

## Why a rewrite instead of a fix

DriftSeal (`~/dev/driftseal`, v3.3.5) hard-wires acceptance criteria to a
shell verifier, gates `end` on a fresh passing run bound to a workspace hash,
and re-invalidates that run on every `extend` and every decision
reconciliation. Verification became the only bridge between the sealed
outcome and the delivered work, so the tool grew into a QA framework.
Roughly 300 of its 7,700 lines are the seal itself; the rest is verifier
execution, provenance, two-phase decision reconciliation, cross-lineage merge
repair (`absorb`), park and sidecar management, a SQLite read model, v1
migration, protocol-version upgrade paths, and installers for five agent
hosts. Removing the verifier from that codebase leaves most of the weight and
all of the sidecar complexity in place. A fresh repository with a smaller
storage model removes it structurally.

## Boundary

These four sentences define the product. Every design choice below must be
traceable to one of them.

1. Inkan keeps a trustworthy record of the project process. It is not
   accountable for the project result.
2. A seal freezes the authoritative outcome at the moment it was settled.
   Later delivery must stay faithful to it.
3. The record answers exactly three questions: is the stored outcome still A;
   is what finally got committed A; was A swapped for B mid-way without an
   explicit, reasoned amendment.
4. Agents treat a seal as objective fact. They may challenge a decision when
   circumstances change. They never question the scenario in which it was
   made, and the original text is never rewritten.

Consequences: Inkan never runs tests, never judges whether a declaration is
true, and never blocks a commit. Every check it offers is a read-only query
on the record.

Closed records are final. Reviewing the log never triggers verification,
re-attestation, or re-closing. The record has no notion of a stale or
invalidated state, so nothing in it can ever demand to be redone. This is
the structural fix for the old re-verification loop: the loop existed because
`extend` and reconciliation invalidated evidence, and every review found
something "stale". Here there is nothing to invalidate.

## What the seal answers, and how

| Question | Mechanism |
|---|---|
| Is the stored outcome still A? | Append-only per-outcome file. Contract hash over the sealed text and its amendments. `status` prints the seal verbatim with its hash. |
| Is what got committed A? | `end` records the working-tree hash (git tree, log excluded). The landing commit carries an `Inkan-Outcome: <id>` trailer. `check <commit>` compares trailer, recorded tree, and the commit's tree. |
| Was A swapped for B without authorization? | The headline outcome is immutable. Criteria change only through `amend --reason`. Closing requires a recorded disposition for every criterion. `begin` refuses while an outcome is open and there is no `--force`. |

## Decisions already taken

These were open questions in the first draft and are now settled.

1. **Name.** Inkan. npm package `inkan`, bins `inkan` and `ink`. Neither
   name exists on npm or as a common shell command. First release is
   `0.1.0`; it is a new product line, not DriftSeal 4.
2. **Lanes.** Keep a deliberate hook. `begin --lane <tag>` stores an optional
   string on the begin event, `status` prints it, and `log --lane <tag>`
   filters. There is no lane catalog, no switching, and no current-lane
   pointer. If dogfooding shows `log -n 3` re-anchoring on the wrong
   narrative in a multi-capability repository, the next step is `log`
   defaulting to the open outcome's lane; that is the extension point.
3. **MCP.** Keep the hook, do not implement. The command layer is written as
   a library (`src/api.js`) that returns plain objects, with the CLI as a
   thin argument parser and printer on top. An MCP server, when wanted, is
   a second thin layer over the same library. No entry point, no SDK
   dependency, and no `bin` entry until then.

## Design

### Storage

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

### Identity

Outcome id: `YYYY-MM-DD-xxxx` where `xxxx` is four random base32 characters.
Ids sort by date, are unguessable enough to avoid same-day collisions across
branches, and are short enough to type. `doctor` reports a collision if one
ever happens.

Decision id: sequential four-digit number, as MADR convention expects.
Collisions across branches are resolved by renaming the file; `doctor`
reports duplicates.

### Events

Each line is one JSON object with `v: 1`. Readers refuse a higher `v`.

```jsonc
{ "v": 1, "type": "begin", "id": "2026-09-03-k7m2", "ts": "...",
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
`partial` requires every live criterion to have a disposition and at least one
unmet; `abandoned` requires a note and needs no dispositions. A file that
violates these is reported as corrupt and never silently repaired.

### Commands

| Command | Effect | Refuses when |
|---|---|---|
| `inkan init [--lang <tag>]` | Writes or upgrades the managed block in `AGENTS.md`; creates `.inkan/`. | The block was hand-edited. |
| `inkan begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]` | Seals a new outcome; prints its id. | Another outcome is open. The message lists it and says to close it with a note. |
| `inkan amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]... [--decision <id>]... [<id>]` | Appends an amendment; prints the new contract hash. | No reason. No open outcome. Ambiguous open outcome without `<id>`. |
| `inkan end [<id>] [--met <n>]... [--unmet <n> [--note]]... [-s abandoned] --note <text>` | Records dispositions and closes. Status is derived: all met is `completed`, any unmet is `partial`. Prints the commit trailer line. | A live criterion has no disposition. `abandoned` without a note. |
| `inkan status` | Prints every open outcome verbatim: sealed time, hash, lane, criteria with indexes, amendments with reasons, linked decisions. | Never. |
| `inkan log [-n N] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]` | One line per outcome, newest first, default 20: id, status, lane if any, headline, met count. `<id>` prints one outcome in full including amendments, dispositions, note, and tree. Filters narrow the scan. | Never. |
| `inkan check [<commit>]` | Read-only. Reads `Inkan-Outcome` trailers, loads each named outcome from the commit's own tree, refolds it, and reports: trailer present, outcome closed, recorded hash matches refold, recorded tree matches the commit tree. Exit 0 consistent, 1 mismatch, 2 no trailer. A mismatch is a fact about a past commit; it is reported, never repaired by redoing work. | Never blocks anything. Not installable as a hook by `init`. |
| `inkan doctor` | Folds every outcome file and parses every decision; reports corrupt files, duplicate ids, and dangling decision links. | Never. |
| `inkan decision add "<title>" --context ... --decision ... [--driver]... [--option]... [--consequence]... [-s status]` | Writes a numbered MADR file. | Missing required sections. |
| `inkan decision update <id> --status <status> --reason <text>` | Appends a dated history entry to the MADR. Names the open outcome when there is one. Never edits Context or Decision sections. | Unknown id. |
| `inkan decision list [-s status]` / `show <id>` | Read-only. | Never. |

`ink` accepts exactly the same arguments.

There is no `verify`, no `extend`, no `--force`, no `reclaim`, no `absorb`,
no lane catalog, no `migrate`. Closing over an open outcome means closing it
explicitly with a note; that is the only path from A to B and it leaves a
reasoned record.

### Library and CLI layers

`src/api.js` exports one function per command. Each takes a plain options
object plus a `root` directory, performs the operation, and returns a plain
serializable result or throws an `InkanError` with a user-facing message.
`src/cli.js` parses `argv`, calls the library, and prints. Nothing in
`src/api.js` reads `process.argv` or writes to stdout. This is the MCP hook
from Decisions 3 and it also keeps the tests fast: most of them call the
library directly and only a few spawn the binary.

### Reviewing history at scale

A long-lived repository accumulates hundreds or thousands of outcomes. Two
costs matter and they are different.

Machine cost. The old single-file log had to be folded end to end to find
the last three records, which is why it grew a SQLite index. Per-outcome
files remove that need: ids sort by date, so `log -n 3` sorts the directory
listing and reads three files. Only `--grep`, `--since`, and `--lane` read
more, and at ten thousand outcomes that is about ten thousand small files,
on the order of thirty thousand lines and under ten megabytes, which folds
in well under a second on local disk. Git handles directories of that size
routinely.

Agent cost. An agent cannot read a thousand records into context, so the
tool must make the cheap view the default. `log` prints one line per outcome
and nothing else; the full record is one file behind `log <id>`. The `end`
line carries the dispositions and the note, so reading a closed outcome
never means replaying its events. Filters narrow the scan before it reaches
the agent.

No derived cache is built up front. M3 adds a synthetic benchmark with ten
thousand outcomes and two targets: `log -n 3` under 50 ms and `log --grep`
under one second. If a real repository breaks those targets, a read-through
cache may be added as a pure performance layer that is never consulted for
correctness, never committed, and rebuilt from the files whenever absent.
Not before.

### Tree hash

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

### Agent protocol

`init` writes this block. It is the whole policy; the skill and any future
MCP descriptions only point at it.

```markdown
<!-- inkan -->
<!-- inkan-protocol: 1 -->
<!-- inkan-lang: en -->

## Agent protocol: sealed outcomes

This repository uses Inkan (`inkan`, alias `ink`). Inkan keeps a trustworthy
record of what the work was meant to deliver and what was declared at close.
It does not run tests and does not judge the result; the repository's own
checks do that.

1. **Seal before durable changes.** Before changing code, configuration,
   documentation, or dependencies, run
   `inkan begin "<outcome>" --accept "<observable criterion>"`.
   Repeat `--accept` per criterion. Add `--decision <id>` for each decision
   record this work is bound by. Add `--lane <tag>` only when the
   repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do
   not reinterpret it: run `inkan amend --reason "<what changed>"` with the
   added or withdrawn criteria. The original text stays. Never question why
   the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run
   `inkan end --met <n>... [--unmet <n>...] --note "<what happened>"`.
   Every criterion gets a disposition. Put the printed
   `Inkan-Outcome: <id>` trailer in the commit message that lands the work.
   Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run `inkan status` and
   `inkan log -n 3`. The open outcome is the task; continue it. To stop it,
   close it with a note. Do not begin over it.
5. **Closed outcomes are final.** Reviewing the log is reading, not
   re-checking. Never re-verify, re-attest, or re-close a closed outcome. If
   a past declaration now looks wrong, that is a new outcome with its own
   seal.

Decision records live in `.inkan/decisions/`. Their Context and Decision
sections record the scenario at the time and are never edited. To challenge
one, run `inkan decision update <id> --status <status> --reason "<what
changed>"` or add a new record that supersedes it.

Outcome log: `.inkan/outcomes/<id>.jsonl`, one append-only file per
outcome. Commit `.inkan/` with the code. Do not edit these files by hand.
<!-- /inkan -->
```

### Deliberately absent

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

### Runtime

Node 22 or newer, ESM, zero runtime dependencies. Tests use `node --test`.
Most tests call `src/api.js` directly against a temporary directory; a
smaller set spawns `bin/inkan.js` and `bin/ink.js` inside temporary Git
repositories to cover parsing, printing, and exit codes.

Size targets: `src/` under 1,500 lines, tests under 1,500 lines. If a
milestone pushes past that, the design is wrong, not the target.

## Milestones

Each milestone ships on its own and is dogfooded with the tool as it exists
at that point.

### M0. Founding documents

- `README.md` with the boundary, the three questions, and the command table.
- `DESIGN.md` carrying the storage, event, hash, layer, and protocol
  sections above, kept current as the source of truth for the
  implementation.
- Two decision records, written by hand in the target MADR format:
  `0001` Inkan records the process and is not accountable for the result;
  `0002` one append-only file per outcome, no cross-lineage merge tooling.
- `package.json` (name `inkan`, version `0.1.0`, bins `inkan` and `ink`,
  `"type": "module"`, `engines.node >= 22`), `LICENSE`, `.gitignore`, empty
  `src/` and `test/`.

Done when a reader with no context can state the boundary and the three
questions from the README alone.

### M1. Core seal

- `src/store.js`: id generation, per-outcome file read and append with fsync,
  atomic create.
- `src/fold.js`: event validation, fold, contract hash.
- `src/git.js`: `HEAD`, worktree detection, tree hash.
- `src/api.js`: `begin`, `amend`, `end`, `status`, `log`, `init`.
- `src/cli.js`, `bin/inkan.js`, `bin/ink.js`: argument parsing, printing,
  `help`, `--version`.
- `--lane` on `begin`, lane in `status` and `log` lines, `log --lane`.
- `init` writes protocol block 1 and creates `.inkan/`.
- Tests: fold rules, hash stability and lane exclusion from the hash,
  refusal paths, `init` idempotence, open-outcome handling across two
  worktrees of one repo, `ink` and `inkan` producing identical output.

Done when this repository seals its own work with M1 and the M1 outcome
files fold cleanly.

### M2. Decisions as constraints

- `src/decisions.js`: MADR render, parse, list, `update` with history
  append. Ported from DriftSeal by copying and trimming, not by importing.
- `--decision` on `begin` and `amend` validates ids and records links.
- `status` and `log <id>` show linked decisions with their current status.
- Tests: add, update, list, show, dangling link detection.

Done when `0001` and `0002` from M0 are linked from a sealed outcome and
`decision update` on one of them names that outcome.

### M3. Delivery binding

- `end` records `tree`; prints the `Inkan-Outcome` trailer.
- `check [<commit>]` with the four reports and exit codes.
- `doctor`.
- `log` filters: `--since`, `--grep`, `--status`, `--decision`.
- `bench/history.js`: generates a temporary repository with ten thousand
  closed outcomes and times `log -n 3`, `log --grep`, and `doctor`. Targets:
  50 ms, 1 s, 2 s.
- Tests: trailer parsing, tree match and mismatch, outcome loaded from the
  commit's own tree, tamper detection via hash refold, non-Git fallback,
  each `log` filter, and a smaller benchmark run in the test suite so the
  targets are enforced, not just measured.

Done when `inkan check HEAD` on this repository reports consistent for
every commit landed since M1.

### M4. Adapters and ergonomics

- `skills/use-inkan/SKILL.md`: locate `AGENTS.md`, re-anchor, nothing else.
  `inkan skill install --target <dir>` copies it.
- Revisit the lane hook: if dogfooding showed `log -n 3` re-anchoring on
  the wrong narrative, make `log` default to the open outcome's lane.
- Decide whether a `prepare-commit-msg` hook that adds the trailer is worth
  shipping as an opt-in installer. Default: no.
- MCP stays unimplemented unless a host needs it; when it does, it is
  `bin/inkan-mcp.js` over `src/api.js` with the SDK as an optional
  dependency.

### M5. Import and release

- `inkan import <events.jsonl> [--decisions <dir>]`: converts closed
  DriftSeal v2/v3 outcomes into per-outcome files. `extend` becomes `amend`
  with reason `imported extension`; `verify` events are dropped;
  `verifyResult` and `note` are preserved in the end note; the old `lane`
  field maps to the new tag; MADR files are copied with their reconciliation
  markers stripped. Open outcomes are refused; close them in DriftSeal
  first.
- Import the DriftSeal repository's history, run `doctor`, and compare `log`
  against the old `log --all-lanes`.
- Publish `inkan` 0.1.0.

## What to port from DriftSeal

Copy, trim, and re-test; do not depend on the old package.

- `atomicCreateFile` and the fsync-on-append helper.
- MADR `renderDecision`, `parseDecision`, `slugify`, and the history append
  with EOL preservation, minus reconciliation markers and hashes.
- The managed-block replace logic in `init`, reduced to one marker and one
  version series.
- The test harness pattern: temp Git repo per test, CLI spawned as a
  subprocess, `AGENTS.md` fixtures.
