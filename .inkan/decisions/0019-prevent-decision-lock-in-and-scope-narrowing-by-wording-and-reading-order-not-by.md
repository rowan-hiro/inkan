# 19. Prevent decision lock-in and scope narrowing by wording and reading order, not by isolating decisions

Date: 2026-09-24

## Status

Accepted

## Context and Problem Statement

Hiro saw two failures in agent design work. First, an agent designing a new capability treated decision records made for an earlier capability as constraints on the new one and locked itself in. Second, after a long run of work on one index in a vector search library, an agent asked how the system should be redesigned for remote memory over RDMA or CXL read the decision records and outcome log and narrowed the task to that one index. Without Inkan the same request reads broadly, because the agent starts from the code tree; the protocol sent it to the history first. The first proposal was lane isolation: keep only global and same-lane decision records in a lane's worktree. On 2026-09-24 this was tested in throwaway repositories with fresh Claude Opus 5.5 and GPT-6-Sol agents, one run per condition. Lock-in: a new bookmark command needed network access, and two decisions written for sync said notekit opens no network connections and never writes generated content into notes. With those decisions visible, Opus refused and Sol superseded both decisions on its own. With the decisions hidden by per-worktree sparse-checkout, Opus found them with git ls-files and git show, still refused, and reported the hiding as a risk. With the same decisions rewritten so that sync is the subject, both models built the command, kept the two global decisions, and bound neither sync decision. Narrowing: with the current protocol both models dropped or demoted the legacy indexes compared with no Inkan. A rule to state scope from the request alone made it worse: Opus had only the injected git log and offered index-only scopes, and Sol invented scopes from its global memory. A rule to state scope from the request and the repository's structure (README and top-level modules) before the outcome log or decision records made both models list module-based scopes, including the whole system, and ask which was meant.

## Decision Drivers

* An agent that has read a text cannot be told to ignore it
* An agent that notices hidden records looks for them and trusts the setup less
* Scope is the person's call; the agent should offer the plausible readings, not choose one silently
* Inkan spawns no child processes, including Git (0015)

## Considered Options

* Protocol wording that tells agents to treat unlinked decisions as background
* A scope field on decisions with a filtered decision list
* Deleting other lanes' decisions on a lane branch
* Per-worktree sparse-checkout that hides other lanes' decisions
* Write each decision with the part it constrains as its subject, and have new work state its scope from the request and the repository structure before reading history

## Decision Outcome

Protocol 12 changes two rules. Rule 1: for new work, state the outcome and the scope it covers from the request and the repository's current structure, such as its README and top-level modules, before reading the outcome log or the decision records; when the request names something general, such as the system, list the scopes that structure supports and ask which is meant; then read the decision records and bind those that constrain that scope. A new decision record names the part of the project it constrains as the subject of its decision, and says so plainly when it binds the whole project. Rule 4: run inkan status after context loss, and inkan log -n 3 only when resuming work that may be yours; new work starts from rule 1, not from the log. Decision records stay in one flat directory visible to every checkout, and lanes stay a plain tag per 0011. Isolating decision records by lane is rejected: hidden records remain reachable through Git, agents find them, and hiding them does not change how an agent reads them. Deleting them on a lane branch is also rejected: the deletions merge back into main, and renumbering after a merge would silently repoint closed outcomes' decision links.

## Consequences

* Existing decisions worded too broadly are not edited; narrowing one takes a new record that supersedes it
* The rules shape how agents write and read, and cannot stop an agent from reading history early; the host still injects recent git log into some agents' context
* Evidence is one run per condition in small synthetic repositories; if lock-in or narrowing still shows up in real repositories under protocol 12, revisit isolation with that evidence
* Agents with global memory, such as Codex, can still import scope from other projects

## Decision History

### 2026-09-24T06:27:08.007Z, outcome 2026-09-24-0626-yykk

Status: accepted -> accepted

Protocol 13 (2026-09-24) revises the rule 1 scope sentence. Protocol 12 asked only when the request named something general, such as the system; Hiro pointed out that a general noun is one source of ambiguity among many, and a keyword trigger misses the rest. The original failure was an agent filling in scope from recent history without saying so, so protocol 13 targets the filling-in: every part of the scope the request does not say itself is named as an assumption, and the agent asks when an assumption would change the work. inkan status also moves after the scope is stated, since it prints open outcomes in full. Tested the same day in the vecdb setup with fresh Opus 5.5 and GPT-6-Sol agents: asked about this system, both covered every index and layer and listed their assumptions; after the reply whole system, both read the decision records and history and kept flat, ivfpq, tidal, storage, query, server, and benches in the final plan; asked about the whole system by name, neither asked about scope again and both listed only the assumptions that remained. Review by a Codex agent corrected how this record reads: the first driver is a risk, not a law, since the evidence only shows that per-worktree sparse-checkout fails, not every form of context isolation; and in the lock-in experiment, rewording 0002 and 0003 with sync as subject also narrowed what they required, so the finding is that decisions worded more broadly than intended constrain later features, and a model superseding such a decision is permitted conflict handling, not anchoring.
