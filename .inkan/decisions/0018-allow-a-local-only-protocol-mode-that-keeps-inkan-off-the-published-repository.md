# 18. Allow a local-only protocol mode that keeps .inkan off the published repository

Date: 2026-09-17

## Status

Accepted

## Context and Problem Statement

The default, recorded in 0008 and restated in every generated protocol through 10, is that .inkan/ is committed with the code so a clone can pick up the work. Hiro asked on 2026-09-17 for a local-only mode because some checkouts cannot or should not publish the record: a repository that will not take the extra files, a personal overlay on a shared project, or a situation where committing the log would be inconvenient. Without an explicit mode, an agent following today's protocol will commit .inkan/ anyway.

## Decision Drivers

* Default stays: records travel with the code
* Some checkouts cannot publish .inkan/
* Mode is policy in AGENTS.md, not a sidecar or env var
* Switching mode is explicit; a bare init must not flip it

## Considered Options

* Keep commit-with-the-code as the only policy
* A protocol-11 mode stamp, --local and --repo on init, two generated blocks
* A sidecar or environment variable that init and agents read

## Decision Outcome

The default remains that .inkan/ is committed with the code. inkan init --local writes protocol 11 with <!-- inkan-mode: local -->. That block keeps the seal, amend, close, re-anchor, and closed-is-final rules, and changes only the publication duty: keep .inkan/ on this checkout; do not commit it; do not put an Inkan-Outcome trailer on the landing commit. init --repo writes the default <!-- inkan-mode: repo --> block, which still requires committing the record and the trailer. Omitting both flags keeps the current mode, or repo when there is no block yet. --local together with --repo is refused. A protocol-11 local block is a generated form that init upgrades in place, the same as a repo block; a hand edit of either is still refused. end still prints the trailer; the local block tells the agent not to include it. No .gitignore write, no environment variable, and no sidecar: the mode is the stamp and the generated text in AGENTS.md, per 0008. This repository stays in repo mode.

## Consequences

* A clone of a local-only checkout does not inherit the record
* 0008 gains a protocol 11 history entry; V1 through V10 stay verbatim
* end still prints Inkan-Outcome; only the local protocol omits it from the commit

## Decision History
