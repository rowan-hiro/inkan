# Agent instructions

<!-- inkan -->
<!-- inkan-protocol: 8 -->
<!-- inkan-lang: en -->

## Agent protocol: sealed outcomes

This repository uses Inkan (`inkan`, alias `ink`). Inkan keeps a trustworthy record of what the work was meant to deliver and what was declared at close. It does not inspect commits, run tests, or judge the result; the repository's own checks do that. Write outcome prose in en. This block states the policy; `inkan help` gives the command syntax.

1. **Seal before durable changes.** Before changing code, configuration, documentation, or dependencies, run `inkan status`; if it shows an open outcome that is not your work, follow rule 4 first. Then run `inkan begin` with the outcome, one observable acceptance criterion at a time, and every decision record the work is bound by. When the host has a planning step before changes, the plan states the outcome, its criteria, and its decisions in the words `inkan begin` will receive, and running it with that text unchanged is the first action after the plan is approved. File the outcome by lane only when the repository already files outcomes by lane.
2. **The seal is a fact.** Deliver what it says. If circumstances change, do not reinterpret it: run `inkan amend` with the reason and the added or withdrawn criteria. The original text stays. Never question why the outcome was sealed the way it was at the time.
3. **Close with dispositions, then commit.** Run `inkan end` with a disposition, met or unmet, for every live criterion and a note on what happened. Commit the outcome record with the work. Include the printed `Inkan-Outcome: <id>` trailer in the final paragraph of the landing commit message, beside any other trailers with no blank line between them. Never report success without closing the outcome.
4. **Re-anchor after context loss.** Run `inkan status` and `inkan log -n 3`. An open outcome that is the work you were asked to do is your task: continue it, or close it with a note. An open outcome that is not your work belongs to another session: leave it alone. Never close, amend, or abandon an outcome you did not work on, and do not judge why it is still open. Before beginning your own outcome beside it, stop and tell the person it is there, and ask whether your work should run in its own git worktree, because separate worktrees keep each session's edits apart.
5. **Closed outcomes are final.** Reviewing the log is reading, not re-checking. Never re-verify, re-attest, or re-close a closed outcome. If a past declaration now looks wrong, that is a new outcome with its own seal. When reading history, use commit trailers only as references. Missing trailers or unavailable referenced records are missing information, not failed outcomes or a reason to verify delivery or repair history.

Decision records live in `.inkan/decisions/`. Their Context and Decision sections record the scenario at the time and are never edited. To challenge one, run `inkan decision update` with the new status and the reason, or add a new record that supersedes it.

Outcome log: `.inkan/outcomes/<id>.jsonl`, one append-only file per outcome. Commit `.inkan/` with the code. Do not edit these files by hand.
<!-- /inkan -->
