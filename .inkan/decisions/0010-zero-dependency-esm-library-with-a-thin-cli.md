# 10. Zero-dependency ESM library with a thin CLI, and growth reviewed against the decision records

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

DriftSeal was one 7,700-line file with the MCP SDK and zod as runtime dependencies. Inkan must stay small and still leave an extension point for hosts without carrying their dependencies. During the build a hard 1,500-line target for `src/` worked as a brake on accretion but also pushed one milestone to compress earlier code cosmetically to fit.

## Decision Drivers

* Zero runtime dependencies
* Every command callable as a function
* Tests mostly in-process
* A size discipline that resists accretion without forcing cosmetic compression

## Considered Options

* A single-file CLI
* A library plus a thin CLI, MCP deferred
* A library plus CLI plus an MCP server shipped now

## Decision Outcome

Node 22 or newer, ESM, no runtime dependencies. `src/api.js` exports one function per command taking `{ root, ...options }` and returning plain objects or throwing `InkanError`; it never reads argv or writes stdout. `src/cli.js` parses with `node:util` parseArgs and prints. `bin/inkan.js` and `bin/ink.js` are identical entry points. `src/store.js`, `src/fold.js`, `src/git.js`, and `src/decisions.js` hold storage, fold, git, and MADR code.

MCP is deferred. When a host needs it, `bin/inkan-mcp.js` is a second thin layer over `src/api.js` with the SDK as an optional dependency.

Size is reviewed, not capped. The 1,500-line target is retired as a hard line. Growth is reviewed by traceability: a change that cannot cite the decision record it serves is refused, whatever the line count.

## Consequences

* Most tests call the library against temporary directories and only a few spawn the binaries
* Adding a host adapter never touches the library
* The size question in review is which decision a change serves, not whether it is under a number

## Decision History
