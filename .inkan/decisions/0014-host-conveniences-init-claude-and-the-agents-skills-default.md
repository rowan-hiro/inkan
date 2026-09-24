# 14. Host conveniences: init --claude links CLAUDE.md, and skill install defaults to .agents/skills

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

0008 shipped no host installers: skill install takes a bare directory, so the agent or person has to know each host's skill path. In practice most coding agents other than Claude Code read project skills from .agents/skills, while Claude Code reads .claude/skills and CLAUDE.md. Hiro asked on 2026-09-03 for the two conveniences that cover this without creating a second policy text.

## Decision Drivers

* One policy text: CLAUDE.md must not become a second copy of AGENTS.md
* The common case needs no path
* Claude Code is the one host with its own conventions
* No MCP server, no lifecycle hooks, no editing of any host's config file

## Considered Options

* Keep a bare --target only
* A host table like DriftSeal's five targets with scope and force flags
* A .agents/skills default plus one --claude flag

## Decision Outcome

inkan init --claude creates CLAUDE.md as a relative symlink to AGENTS.md, so Claude Code reads the same text and there is still exactly one policy. Without the flag init never touches CLAUDE.md. An existing CLAUDE.md that is not that symlink is refused, never replaced. inkan skill install with no flags copies the bundled skill to <root>/.agents/skills/use-inkan, where <root> is the Inkan repository root; --claude copies it to <root>/.claude/skills/use-inkan; --target <dir> stays as the explicit path for anything else, including global directories; --claude together with --target is refused. The refusal of a destination that exists and differs stays, and there is still no force flag. This supersedes the sentence in 0008 that no host installers ship. No MCP server and no lifecycle hooks ship; those stay deferred.

## Consequences

* A CLAUDE.md symlink is committed like any other file; a checkout that cannot create symlinks sees a one-line file naming AGENTS.md
* Another host flag is a history entry here, not a target table
* Global installs still spell the path with --target

## Decision History

### 2026-09-24T04:05:25.421Z, outcome 2026-09-24-0405-cngn

Status: accepted -> accepted

skill install now replaces a use-inkan copy that differs from the bundled skill instead of refusing (2026-09-24). Found when upgrading to 0.6.0: the installed copy was the unmodified 0.5.0 skill, yet install refused it and left the protocol 11 re-anchor text in place, so every upgrade needed a manual delete. Hiro chose plain overwrite over tracking known versions: the skill only points at AGENTS.md per 0008 and carries no policy of its own, so a local edit to it protects nothing worth a refusal. The destination directory is replaced whole, so files the bundled skill dropped do not linger. There is still no force flag, because none is needed.
