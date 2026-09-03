---
name: use-inkan
description: Follow Inkan-managed repository work when the repository's AGENTS.md requires `inkan`, or an interrupted outcome must be resumed. Use this skill to locate the agent protocol and re-anchor state after context loss.
---

# Use Inkan

Treat the target repository's `AGENTS.md` as the only policy. This skill
helps locate and resume that workflow; it does not restate or extend the
protocol written there.

## Locate Inkan

Prefer `inkan` from `PATH`. In an Inkan source checkout, fall back to
`node bin/inkan.js`.

## Re-anchor after context loss

Run:

```sh
inkan status
inkan log -n 3
```

The open outcome these report is the task at hand; continue it exactly as
`AGENTS.md` directs. A closed outcome is final: it is never re-checked or
re-closed, no matter how the work looks now.

For command syntax, run:

```sh
inkan help
```
