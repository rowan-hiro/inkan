# Inkan

[简体中文](README.zh.md)

**Agents make promises. Inkan keeps the receipts.**

*Seal what the work is meant to deliver. Record what was declared when it closed.*

Inkan is a small, zero-dependency CLI for repositories where coding agents
do real work. It keeps a trustworthy record of what each piece of work was
meant to deliver, how that intent changed along the way, and what was
declared when it closed. The record lives in the repository and travels
with the code, so a fresh session or a different agent can pick up the work
without relying on another assistant's memory.

## The problem

Long agent sessions lose the plot. Context gets compacted, a fresh session
picks up a half-finished task, and the task gets quietly reinterpreted:
scope narrows, a criterion is forgotten, A becomes B, and the final message
still says "done". Tests do not catch this. Tests tell you the code works.
They do not tell you it is the code you asked for.

The usual answer is more checking: more tests, more gates, re-verification
on every look at the log. That makes an agent re-check its own past work
every time it re-reads history, and the loop never ends. Inkan takes the
other route. It records what was declared and when, treats the record as
fact, and leaves judging the result to the repository's own tests.

## What the record holds

| Question | How Inkan answers it |
|---|---|
| What was the work meant to deliver? | `begin` seals the outcome text and its acceptance criteria in an append-only file. `status` prints open outcomes verbatim. |
| How did the intent change? | The headline stays. `amend --reason` appends the reason, additions, and any added or withdrawn criteria. |
| What was declared at close? | `end` records a disposition for every live criterion and a note. An outcome without an end event stays open. |

These are declarations. Inkan does not compare them with commits or decide
whether the work fulfilled the criteria. Closing creates no later audit
step and no obligation to prove the same work again.

## Quick start

Requires Node.js 22 or newer. Commit the records with your usual Git workflow;
Inkan itself does not invoke Git.

```sh
npm install --global @rowan-hiro/inkan
```

This installs `inkan` and its alias `ink`. They accept identical arguments.

**1. Initialise the repository.**

```sh
inkan init
```

This writes a managed protocol block into `AGENTS.md` and creates `.inkan/`.
Commit both; they are part of the code from here on. Add `--claude` to also
link `CLAUDE.md` to `AGENTS.md`, so Claude Code reads the same policy from
the same file.

**2. Seal the outcome before touching code.**

```sh
inkan begin "Ship account recovery" \
  --accept "expired links are rejected" \
  --accept "a valid link resets the password"
```

```
2026-09-03-0621-82qz
```

**3. When scope changes, amend. Never reinterpret.**

```sh
inkan amend --reason "Security review asked for rate limiting" \
  "Rate-limit recovery requests per account" \
  --accept "more than five requests per hour are rejected"
```

The original text stays. The amendment, its reason, and the new criterion
are appended, and the contract hash moves with them.

**4. Close with a disposition for every criterion.**

```sh
inkan end --met 1 --met 2 --unmet 3 --note "Rate limiting deferred to the next sprint"
```

```
2026-09-03-0621-82qz partial
```

Status is derived from the dispositions: every criterion declared met is
`completed`, any declared unmet is `partial`. A truthful `partial` is a
first-class result, and it is what an agent reports instead of stretching
the definition of done.

**5. Commit the work and its record together.**

Stage the files for this outcome, including its `.inkan/` records, then
commit using the repository's normal workflow:

```sh
git commit -m "feat: account recovery"
```

The outcome is closed. There is no delivery audit to run afterwards.

## After context loss

A new session, a new day, a compacted context: instead of guessing what was
in progress, ask.

```sh
inkan status
inkan log -n 3
```

```
[2026-09-03-0621-82qz] open
  sealed: 2026-09-03T06:21:06.511Z
  hash: 9850337661df733ec923efc25bf9fdcb85ce30a3bb4cb3c07d7c84dd4fcaff56
  outcome: Ship account recovery
  1. expired links are rejected
  2. a valid link resets the password
  3. more than five requests per hour are rejected
  amend 2026-09-03T06:21:06.555Z: Security review asked for rate limiting
    Rate-limit recovery requests per account
```

An open outcome that is your work is the task at hand: continue it, or close
it with a note. One that is not your work belongs to another session: leave
it alone, tell the person it is there, and ask whether your work should run
in its own git worktree before beginning beside it. `log` prints one line
per outcome, newest first, so re-anchoring costs a few lines of context, not
a re-read of the history:

```
2026-09-03-0621-q51x  completed  Ship account recovery, second pass  (1/1 met)
2026-09-03-0621-82qz  partial  Ship account recovery  (2/3 met)
```

## What Inkan refuses to do

These are the product, not its limitations.

- **It never runs anything.** No tests, no builds, no shell commands. The
  tool spawns no child processes, including Git. Whether the work is
  correct is the repository's job.
- **It never gates.** Nothing in Inkan runs before or during `git commit`,
  and `init` installs no hooks. There is no commit comparison or delivery
  audit. `doctor` is an optional file diagnostic, never a workflow step.
- **Closed is final.** There is no stale state, no invalidation, and no
  notion that a closed outcome needs to be redone. Reviewing the log is
  reading, not re-checking. If a past declaration now looks wrong, that is a
  new outcome with its own seal.
- **It never closes an outcome on anyone's behalf.** Several outcomes can be
  open at once, one per session or branch. `begin` names the others and
  leaves them alone. An outcome that was never closed is an honest record of
  exactly that; why it stayed open is a question for a person to investigate,
  not a judgment for an agent to make. Closing for the sake of closing would
  only fill the log with junk records.
- **The scenario is never rewritten.** An agent may challenge a decision when
  circumstances change, by amendment or by a new decision record. It never
  edits the text that records what was known and decided at the time.
- **No moving parts.** No server, no database, no index, no lock, no sidecar
  file, no environment variable. Everything is plain text under `.inkan/`,
  committed with the code, and merged by ordinary git.

## Built for agents

`inkan init` writes a generated protocol block into `AGENTS.md`, the file
coding agents already read. Five rules: seal before durable changes; the
seal is a fact; close with dispositions, then commit the record with the
work; re-anchor with `inkan status` after context loss and leave other
sessions' outcomes alone; closed outcomes are final.
The block carries a protocol number. `init`
upgrades a block it generated under an earlier protocol in place and refuses
to overwrite a block that was edited by hand, so the policy lives in exactly
one place. `--lang <tag>` sets the language agents should write outcome
prose in. `inkan init --claude` also creates `CLAUDE.md` as a symlink to
`AGENTS.md`: Claude Code reads its own file name, and there is still one
policy, not a copy.

For agents that support skill files, the bundled `use-inkan` skill helps an
agent locate Inkan and re-anchor. It only points at `AGENTS.md`; it does not
restate or extend the protocol.

```sh
inkan skill install                 # .agents/skills/use-inkan, read by most agents
inkan skill install --claude        # .claude/skills/use-inkan, for Claude Code
inkan skill install --target <dir>  # anywhere else, including a global directory
```

## Decisions travel with the code

Design choices are recorded as MADR (Markdown Architectural Decision
Records) under `.inkan/decisions/`, one numbered `NNNN-slug.md` file each.
`inkan decision add` writes one. Its Context and Decision Outcome sections
record the scenario and the choice at the time, and they are never edited
afterwards. To challenge a decision, `inkan decision update <id> --status
<status> --reason "<text>"` appends a dated history entry, or a new record
supersedes the old one.

An outcome names the decisions it is bound by with `--decision <id>` on
`begin` or `amend`. They are constraints on the work, never a gate on
closing it.

Inkan's own design is recorded this way, from the boundary in `0001`
onward. There is no separate design document; `inkan decision list` prints
the index.

## One record through the work

Each stage adds to the record without rewriting an earlier declaration.

| Stage | What is recorded | Command |
|---|---|---|
| Intent | What will be delivered and how it will be judged | `begin` |
| Change | How the intent moved, and why | `amend --reason` |
| Constraint | The decisions the work is bound by | `decision add`, `--decision` |
| Close | A disposition per criterion and the status derived from those declarations | `end` |
| Resume | Where a fresh session picks up | `status`, `log` |

Inkan is built this way itself. Its work is sealed and closed as outcomes,
and its design decisions live in `.inkan/decisions/`. The repository holds
the durable context for every agent that works on it.

## Optional file diagnostics

`inkan doctor` reports corrupt record files, mismatched or duplicate ids,
and missing decision references. Run it when you want to diagnose those
files. It does not judge the work, inspect commits, or repair anything.
It is not required to close an outcome, commit, or resume a session, and it
is not part of the generated agent protocol.

## Command reference

| Command | Effect | Refuses when |
|---|---|---|
| `inkan init [--lang <tag>] [--claude]` | Writes or upgrades the managed block in `AGENTS.md`; creates `.inkan/`. `--claude` also links `CLAUDE.md` to `AGENTS.md`. | The block was hand-edited. A `CLAUDE.md` exists that is not that symlink. |
| `inkan begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]` | Seals a new outcome; prints its id. Any other open outcome is named in a notice on stderr and left untouched. | Never. |
| `inkan amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]... [--decision <id>]... [<id>]` | Appends an amendment; prints the new contract hash. | No reason. No open outcome. Ambiguous open outcome without `<id>`. |
| `inkan end [<id>] [--met <n>]... [--unmet <n>]... [-s abandoned] --note <text>` | Records dispositions and closes. Status is derived: all met is `completed`, any unmet is `partial`. Prints the outcome id and status. | A live criterion has no disposition, unless closing with `-s abandoned`. No note. |
| `inkan status` | Prints every open outcome verbatim: sealed time, hash, lane, criteria with indexes, amendments with reasons, linked decisions. | Never. |
| `inkan log [-n N] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]` | One line per outcome, newest first, default 20. `<id>` prints one outcome in full, including dispositions and note. Filters combine. | Never. |
| `inkan doctor` | Optional, read-only diagnostic. Folds every outcome and parses every decision; reports corrupt files, id mismatches, duplicate decision ids, and dangling decision links. Exit 0 clean, 1 problems. | Never. |
| `inkan decision add "<title>" --context <text> --decision <text> [--driver <text>]... [--option <text>]... [--consequence <text>]... [-s <status>]` | Writes a numbered MADR file; prints its path. | Missing required sections. |
| `inkan decision update <id> --status <status> --reason <text>` | Appends a dated history entry and sets the new status. Names the open outcome when there is one. Never edits Context or Decision Outcome. | Unknown id or status. |
| `inkan decision list [-s <status>]` / `inkan decision show <id>` | Read-only. `show` accepts `2`, `02`, or `0002`. | Never. |
| `inkan skill install [--claude \| --target <dir>]` | Copies the bundled skill to `.agents/skills/use-inkan/` under the repository root, to `.claude/skills/use-inkan/` with `--claude`, or to `<dir>/use-inkan/`; prints the destination. | The destination exists and differs from the bundled skill. `--claude` with `--target`. |

Decision statuses are `proposed`, `accepted`, `rejected`, `deferred`,
`deprecated`, and `superseded`.

## How it works

```
.inkan/
  outcomes/<id>.jsonl      one append-only file per outcome
  decisions/NNNN-slug.md   MADR records
```

An outcome id such as `2026-09-03-1432-k7m2` is the UTC date and minute the
outcome was begun plus four random characters, so ids sort chronologically
and two branches essentially never collide. Each outcome file holds a
`begin` event, any `amend` events, and at most one `end` event. An open
outcome is simply a file with no `end` yet.

The contract hash is a SHA-256 over the outcome text, its criteria with
their withdrawn flags, the linked decisions, and every amendment's reason
and addition. `end` stores that contract hash with the dispositions and
note. Readers enforce the event format and reject corrupt records; they
do not inspect project files or compare the record with a commit. Existing
v1 records that contain Git metadata remain readable without being rewritten.

Because each outcome is its own file, two branches never touch the same
file and an ordinary merge brings them together. It also keeps review cheap
without a cache: an unfiltered `log` reads only as many files as it prints, and the bundled
benchmark (`npm run bench`) seeds ten thousand closed outcomes and holds
`log -n 3` under 50 ms, `log --grep` under 1 s, and `doctor` under 2 s.

## Status

Inkan began with 0.1.0, rebuilt from scratch as the successor to DriftSeal.
Current development removes delivery auditing from that first release
(decision 0015). Still deferred: an importer for DriftSeal
history and an MCP server. Those are adapters and can follow without
changing the record format. The only host-specific convenience is
`--claude` on `init` and `skill install`; every other host reads
`AGENTS.md` and `.agents/skills` as they are. Lanes exist only as an
optional filing tag on `begin` and a filter on `log`.

## Releasing

Every push to `main` and every pull request runs the test suite on Node 22,
24, and 26, the history benchmark, and a package smoke on Linux, macOS, and
Windows that packs the tarball, installs it, and drives the installed
`inkan` through a full outcome (`npm run test:package`).

A release is a GitHub Release whose tag is `v` plus the version in
`package.json`. Publishing the release runs the publish workflow, which
checks that the tag and the version agree, runs the tests and the package
smoke again, and publishes to npm with trusted publishing (OIDC). No npm
token is stored anywhere. The one-time setup is on npmjs.com, in the
package's settings: add a trusted publisher of type GitHub Actions with
owner `rowan-hiro`, repository `inkan`, and workflow `publish.yml`. If
npm does not let a trusted publisher be added to a package that has never
been published, publish the first release by hand from a checkout of the
tag with `npm publish --access public`; every release after that goes
through the workflow.

## License

MIT
