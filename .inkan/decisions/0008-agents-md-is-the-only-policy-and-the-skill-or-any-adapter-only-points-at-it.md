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
