# 8. AGENTS.md is the only policy, and the skill or any adapter only points at it

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

Agents follow a repository's AGENTS.md reliably. DriftSeal spread guidance across the AGENTS.md block, a skill, MCP tool descriptions, and hook reminders, and the reminders drifted toward running verification. Inkan needs one policy text and one place it is generated from.

## Decision Drivers

* One source of truth for policy
* Policy text and code stay identical
* Adapters never add rules
* Hand edits are refused rather than overwritten

## Considered Options

* A hand-maintained AGENTS.md with no tooling
* A generated block with a protocol number and an upgrade path
* A generated block plus adapters that restate the rules

## Decision Outcome

`inkan init` writes a managed block between `<!-- inkan -->` and `<!-- /inkan -->` carrying `<!-- inkan-protocol: 1 -->` and `<!-- inkan-lang: <tag> -->`. The text is generated verbatim by `protocolBlock` in `src/api.js`; this repository's own AGENTS.md is the rendered reference. `init` is idempotent, replaces a block that differs only in the language tag, and refuses a block edited by hand.

The block states: seal before durable changes; the seal is a fact, amend with a reason and never reinterpret; close with dispositions, then commit with the trailer; re-anchor with `status` and `log -n 3` and continue the open outcome; closed outcomes are final and reviewing is reading, not re-checking; decision Context and Decision sections are never edited.

The companion skill `use-inkan` only locates AGENTS.md, re-anchors, and points at `inkan help`. `inkan skill install --target <dir>` copies it and refuses to overwrite a differing copy. No MCP server, no lifecycle hooks, and no host installers ship.

## Consequences

* Any future MCP or hook text points at the block and adds nothing
* A protocol change is a new protocol number with an upgrade path in `init`
* The language tag changes one comment line and one sentence

## Decision History

### 2026-09-03T06:45:04.609Z, outcome 2026-09-03-0643-44gb

Status: accepted -> accepted

Protocol 2 (2026-09-03): step 3 now says the Inkan-Outcome trailer goes in the last paragraph of the commit message, next to any other trailers, with no blank line between them, because git reads trailers only from that final paragraph. Found while dogfooding: a blank line between the trailer and a Co-Authored-By line made git drop the trailer and check reported no trailer on a commit that had one in its text. init keeps the protocol 1 text verbatim and upgrades a protocol 1 block in place; a hand-edited block of either protocol is still refused. Decision unchanged.

### 2026-09-03T07:19:12.188Z, outcome 2026-09-03-0718-220x

Status: accepted -> accepted

Superseded in part by 0014: init --claude and the .agents/skills default with --claude are the host conveniences that ship. Still no MCP server and no hooks, and CLAUDE.md is a symlink to the one policy, not a copy.

### 2026-09-09T02:45:29.933Z, outcome 2026-09-09-0243-hd24

Status: accepted -> accepted

Protocol 5 implements 0015: close with dispositions and commit the record with the work, without an Inkan-Outcome trailer or delivery audit. Separate-worktree guidance now explains isolation of concurrent edits rather than tree snapshots. init upgrades generated protocols 1 through 4 and still refuses hand-edited blocks. doctor is optional and is not part of the protocol.

### 2026-09-09T02:57:39.053Z, outcome 2026-09-09-0256-gxgm

Status: accepted -> accepted

Protocol 6 implements 0016: agents include the end output trailer in the final paragraph of a landing commit. Reading that trailer supplies context only and creates no duty to verify delivery or repair missing references. init upgrades generated protocols 1 through 5 while preserving refusal of hand-edited blocks. No check command, Git execution, hook, or mandatory doctor step is added.

### 2026-09-09T03:27:48.023Z, outcome 2026-09-09-0326-dsp9

Status: accepted -> accepted

Protocol 7 (2026-09-09): the block states policy only. It names each command and what a call must carry (one observable criterion at a time, every binding decision record, a disposition for every live criterion, a reason for every amendment) and sends flag-level syntax to inkan help, so a CLI change no longer bumps the protocol. The Inkan-Outcome trailer placement rule from 0016 stays in the block because git parsing, not usage, dictates it. Hiro asked whether usage guidance belonged in the skill; it went to inkan help instead, because the skill is neither guaranteed present nor generated from the code, and 0008 still forbids adapters restating the protocol. init upgrades generated protocols 1 through 6 and still refuses hand-edited blocks.

### 2026-09-09T07:43:46.955Z, outcome 2026-09-09-0743-h84b

Status: accepted -> accepted

init now tells a block from a newer protocol apart from a hand edit. Found on 2026-09-09 when a globally installed 0.2.0 met this repository's protocol 7 block and reported it as edited by hand. A stamped protocol number above the tool's own now yields a message naming both numbers and asking to upgrade Inkan; the file is still left untouched. Hand-edit refusal for known protocols is unchanged. Hiro framed this as Postel's law: read liberally, write conservatively.

### 2026-09-10T03:19:44.030Z, outcome 2026-09-10-0318-vwbj

Status: accepted -> accepted

Protocol 8 (2026-09-10): rule 1 gains one sentence for hosts that plan before they change, such as Claude Code's plan mode. The plan states the outcome, its criteria, and its decisions in the words inkan begin will receive, and running begin with that text unchanged is the first action after the plan is approved. Hiro asked for this after a design pass on 2026-09-10: plan approval is where a person agrees on what will be delivered, and writing the seal's words into the plan closes the gap where an agent could narrow the scope between the approved plan and the seal. Revisions before approval need no record because nothing is sealed yet; changes after the seal go through amend as before. The sentence is host-agnostic, so it belongs in the block rather than in the skill or a hook, per 0008 and 0014. init upgrades generated protocols 1 through 7 and still refuses hand-edited blocks.

### 2026-09-11T03:30:50.740Z, outcome 2026-09-11-0329-915g

Status: accepted -> accepted

Protocol 9 (2026-09-11): rule 1 gains one sentence that scopes the seal to project work, not machine setup. Work that will leave nothing to commit, such as installing tools, fetching or preparing data, or changing local settings, needs no seal however many machines repeat it, and a project change it turns out to need is sealed as usual. Hiro asked for this on 2026-09-11 because preparing the same dataset on several machines was recorded once per machine. The test is whether the work leaves anything to commit: rule 3 commits every outcome with its work, so an outcome whose work commits nothing records a machine rather than the project, and an agent can predict the test before it starts. The sentence is host-agnostic, so it belongs in the block, per 0008. init upgrades generated protocols 1 through 8 and still refuses hand-edited blocks.
