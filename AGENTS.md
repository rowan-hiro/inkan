# Agent instructions

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
