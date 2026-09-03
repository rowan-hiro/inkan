# Inkan

[English](README.md) | 简体中文

**先把工作真正要交付的结果 seal 下来，再验证最终落地的内容有没有兑现承诺。**

Inkan 是一款小巧、零依赖的 CLI，专为让 coding agent 真正参与开发的代码仓库而生。它会可靠地记录每项工作原本要交付什么、意图在过程中如何变化，以及工作结束时作出了怎样的声明；再把最终落地的每个 commit 与这份记录绑定。于是，无论人还是 agent，日后都能清楚回答：这个 commit，真的兑现了当初的承诺吗？

它同时也是一个更宏大构想的可运行原型：用一份贯穿 agent 工作全生命周期的记录，从意图确定一路走到 commit 审计，并且全程只追加、不改写。

## 问题所在

漫长的 agent session 很容易偏离目标。Context 被压缩后，新 session 接手一项做到一半的任务，任务却在不知不觉间被重新解释：范围缩小了，一条验收标准被忘了，A 变成了 B，最终消息却依然写着“完成”。测试发现不了这种问题。测试能告诉你代码是否可用，却不能告诉你，这是不是你最初要求的那份代码。

常见的解决办法是不断增加检查：更多测试、更多 gate，每次查看日志都重新验证一遍。这会让 agent 每次重读历史时，都再次检查自己过去的工作，最终陷入没有尽头的循环。Inkan 选择了另一条路：如实记录当时声明了什么、声明发生在何时，把记录本身视为事实，并把结果是否正确的判断交还给仓库自己的测试体系。

## 三个问题

对于一项工作，Inkan 只回答三个问题，并且刻意不越界。

| 问题 | Inkan 如何回答 |
|---|---|
| 保存下来的 outcome 还是当初 seal 的那一个吗？ | 每个 outcome 都有自己的 append-only 文件。系统会根据 seal 的文本、验收标准和历次 amendment 计算 contract hash。`inkan status` 会逐字打印 seal 及其 hash。 |
| commit 中落地的内容就是 seal 的 outcome 吗？ | 关闭 outcome 时会记录 working tree 的 hash。落地 commit 带有 `Inkan-Outcome: <id>` trailer。`inkan check <commit>` 会把 trailer、记录的 hash 和记录的 tree 与 commit 本身逐一比对。 |
| outcome 是否在中途被擅自调换？ | 标题永远不变。验收标准只能通过 `inkan amend --reason` 修改。关闭时，每一条仍生效的标准都必须给出 disposition。从未关闭的 outcome 会一直明确显示为 open；Inkan 不会替任何人关闭它。 |

## 快速开始

需要 Node.js 22 或更高版本，以及 git。

```sh
npm install --global inkan
```

这会安装 `inkan` 及其别名 `ink`，两者接受完全相同的参数。

**1. 初始化仓库。**

```sh
inkan init
```

这条命令会把一段由 Inkan 管理的 protocol 写入 `AGENTS.md`，并创建 `.inkan/`。请把两者一并 commit；从这一刻开始，它们就是代码的一部分。

**2. 在动手修改代码之前 seal outcome。**

```sh
inkan begin "Ship account recovery" \
  --accept "expired links are rejected" \
  --accept "a valid link resets the password"
```

```
2026-09-03-0621-82qz
```

**3. 范围发生变化时，明确 amend，绝不重新解释。**

```sh
inkan amend --reason "Security review asked for rate limiting" \
  "Rate-limit recovery requests per account" \
  --accept "more than five requests per hour are rejected"
```

原始文本会完整保留。amendment、变更原因和新增标准会被追加到记录中，contract hash 也会随之更新。

**4. 关闭时，为每一条标准给出 disposition。**

```sh
inkan end --met 1 --met 2 --unmet 3 --note "Rate limiting deferred to the next sprint"
```

```
2026-09-03-0621-82qz partial
Inkan-Outcome: 2026-09-03-0621-82qz
```

状态由事实推导，而不是人为选择：所有标准均达成时为 `completed`，只要有一项未达成就是 `partial`。如实记录的 `partial` 是一种完整、正式的结果；agent 应当报告它，而不是为了声称“完成”而拉伸 done 的定义。

**5. 带上 trailer，让工作落地。**

```sh
git commit -m "$(printf 'feat: account recovery\n\nInkan-Outcome: 2026-09-03-0621-82qz\n')"
```

trailer 必须放在 commit message 的最后一个段落，并与 `Co-Authored-By` 等其他 trailer 相邻，中间不能有空行。Git 只会把最后一个段落中的内容识别为 trailer；用空行单独隔开的 trailer，不会报错，却也不会被识别。

**6. 日后随时检查：这个 commit 是否兑现了承诺？**

```sh
inkan check HEAD
```

```
b751a39  Inkan-Outcome: 2026-09-03-0621-82qz
  outcome: present, closed (partial)
  hash: matches refold
  tree: matches commit tree
consistent
```

## 偷换 outcome 会是什么样

假设 outcome 关闭后，代码又被修改，却仍使用同一个 trailer 提交。此时，记录中的 tree 将不再匹配这个 commit：

```
c7f3a54  Inkan-Outcome: 2026-09-03-0621-82qz
  outcome: present, closed (partial)
  hash: matches refold
  tree: differs from commit tree
mismatch
a mismatch is a fact about this commit; it is recorded, not repaired
```

一致时退出码为 0，不匹配时为 1；如果 commit 完全没有 `Inkan-Outcome` trailer，则为 2。Inkan 不会修复任何内容，也不会阻塞任何操作。`check` 只是对过去作出报告——也正因为如此，它可以安心地运行在 code review 或 CI job 中，而不会摇身变成一道 gate。

## Context 丢失之后

新的 session、新的一天，或一次 context compaction 之后，不要靠猜来判断正在做什么，直接查询记录。

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

如果一个 open outcome 属于你的工作，它就是当前任务：继续完成它，或者写明 note 后关闭。如果它不属于你，那就是另一个 session 的工作：不要动它；告诉负责人这里已有一项 open outcome，并在与它并行开始新工作前，询问是否应该使用独立的 git worktree。`log` 按从新到旧的顺序，每个 outcome 只打印一行。因此，重新锚定上下文只需要寥寥几行，而不必重读全部历史：

```
2026-09-03-0621-q51x  completed  Ship account recovery, second pass  (1/1 met)
2026-09-03-0621-82qz  partial  Ship account recovery  (2/3 met)
```

## Inkan 坚决不做什么

这些不是功能缺失，而是产品本身的边界。

- **它绝不运行任何任务。** 不运行测试、build 或 shell command。Inkan 唯一会启动的 child process 是 git，而且参数列表固定。工作是否正确，应由仓库自己判断。
- **它绝不充当 gate。** `git commit` 之前或期间不会运行任何 Inkan 操作，`init` 也不会安装 hook。`check` 和 `doctor` 只报告已经存在的 commit 和文件。
- **关闭即最终状态。** 没有 stale state，没有 invalidation，也不存在已经关闭的 outcome 还需要重做的概念。查看日志就是阅读，而不是重新检查。如果过去的声明如今看来有误，那应当成为一项拥有独立 seal 的新 outcome。
- **它绝不代替别人关闭 outcome。** 多个 outcome 可以同时 open，每个 session 或 branch 各自拥有一个。`begin` 会指出其他 outcome 的存在，但不会碰它们。从未关闭的 outcome，就是“它确实没有关闭”的诚实记录；为何一直 open，应由人来调查，而不是由 agent 擅自判断。仅仅为了关闭而关闭，只会让日志充斥无意义的记录。
- **它绝不改写当时的场景。** 情况变化时，agent 可以通过 amendment 或新的 decision record 对既有决定提出挑战，但绝不会修改那段记录了当时所知信息与所作决定的文本。
- **没有额外运转部件。** 没有 server、database、index、lock、sidecar file 或 environment variable。一切都是 `.inkan/` 下的纯文本，随代码一同 commit，并通过普通 git 操作完成 merge。

## 为 agent 而生

`inkan init` 会把生成好的 protocol block 写进 coding agent 本来就会读取的 `AGENTS.md`。其中只有五条规则：在 durable change 之前 seal；seal 是事实；先逐项 disposition 并关闭，再把 trailer 放在 commit message 的最后一段完成提交；context 丢失后用 `inkan status` 重新锚定，同时不碰其他 session 的 outcome；关闭即最终状态。

protocol block 带有版本号。`init` 会原地升级由旧版 protocol 生成的 block，但拒绝覆盖经过手工编辑的 block，确保 policy 始终只有一个权威来源。`--lang <tag>` 用来设置 agent 撰写 outcome 文本时应使用的语言。

对于支持 skill 文件的 agent，Inkan 内置的 `use-inkan` skill 可以帮助 agent 定位 Inkan 并重新锚定。它只会指向 `AGENTS.md`，不会复述或扩展 protocol。

```sh
inkan skill install --target <skills-dir>
```

## 让决策与代码同行

设计选择以 MADR（Markdown Architectural Decision Records）的形式保存在 `.inkan/decisions/` 下，每条记录对应一个编号为 `NNNN-slug.md` 的文件。`inkan decision add` 用于创建记录。其中的 Context 和 Decision Outcome 部分会记下当时的场景与选择，之后永不改写。

如果要挑战一项决定，可运行 `inkan decision update <id> --status <status> --reason "<text>"`，追加一条带日期的历史记录；也可以创建一条新记录来 supersede 旧记录。

outcome 可以在 `begin` 或 `amend` 时通过 `--decision <id>` 指明自己受哪些 decision 约束。这些 decision 是工作的约束条件，但绝不是关闭工作的 gate。

Inkan 自己的设计也用同样的方式记录，从 `0001` 中划定的边界一路延续至今。仓库没有单独的设计文档；`inkan decision list` 就是它的索引。

## 面向完整生命周期的原型

Inkan 还是一个更大构想的可运行原型：管理 agent 工作的完整生命周期，从意图确定的那一刻，到 commit 接受审计的那一刻。整个过程中，每个阶段都向同一份记录写入事实，没有任何阶段会改写过去。

| 阶段 | 记录什么 | 命令 |
|---|---|---|
| 意图 | 要交付什么，以及如何判断是否达成 | `begin` |
| 变更 | 意图如何变化，以及为什么变化 | `amend --reason` |
| 约束 | 当前工作受哪些 decision 约束 | `decision add`、`--decision` |
| 关闭 | 每条标准的 disposition，以及由此推导出的诚实状态 | `end` |
| 交付 | 真正落地的 commit，并与 seal 绑定 | `Inkan-Outcome` trailer |
| 审计 | commit 与记录是否仍然一致 | `check`、`doctor` |
| 恢复 | 新 session 从哪里接手 | `status`、`log` |

Inkan 本身就是这样构建的。仓库从第二个 commit 开始，每个 commit 都带有 `Inkan-Outcome` trailer；每个 milestone 都先作为 outcome 被 seal，随后关闭；所有设计决定都保存在 `.inkan/decisions/` 中。

这份记录被刻意设计得很小。这个原型真正要验证的是：不在流程里加入 runner，也不设置 gate，仅凭一份只记录事实的日志，能否管理完整的生命周期。

## 命令参考

| 命令 | 作用 | 何时拒绝执行 |
|---|---|---|
| `inkan init [--lang <tag>]` | 写入或升级 `AGENTS.md` 中由 Inkan 管理的 block；创建 `.inkan/`。 | block 曾被手工编辑。 |
| `inkan begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]` | Seal 一个新 outcome，并打印其 id。其他 open outcome 会在 stderr 的 notice 中被点名，但不会受到任何改动。 | 永不拒绝。 |
| `inkan amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]... [--decision <id>]... [<id>]` | 追加 amendment，并打印新的 contract hash。 | 没有 reason；没有 open outcome；存在多个 open outcome，却没有用 `<id>` 明确指定目标。 |
| `inkan end [<id>] [--met <n>]... [--unmet <n>]... [-s abandoned] --note <text>` | 记录 disposition 并关闭 outcome。状态由结果推导：全部 met 为 `completed`，任一 unmet 为 `partial`。打印 commit trailer 行。 | 仍生效的标准缺少 disposition（以 `-s abandoned` 关闭时除外）；没有 note。 |
| `inkan status` | 逐字打印所有 open outcome：seal 时间、hash、lane、带编号的标准、附 reason 的 amendment，以及关联的 decision。 | 永不拒绝。 |
| `inkan log [-n N] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]` | 每个 outcome 打印一行，最新的在前，默认 20 条。`<id>` 会完整打印一项 outcome，包括 disposition、note 和记录的 tree。filter 可以组合。 | 永不拒绝。 |
| `inkan check [<commit>]` | 只读。从 commit 自身的 tree 中读取 `Inkan-Outcome` trailer 和对应 outcome，重新 fold 后报告 trailer、关闭状态、hash 与 tree。退出码：一致为 0，不匹配为 1，没有 trailer 为 2。 | 不会阻塞任何操作。 |
| `inkan doctor` | 只读。Fold 所有 outcome 并解析所有 decision；报告损坏文件、id 不匹配、重复的 decision id，以及失效的 decision link。退出码：正常为 0，发现问题为 1。 | 永不拒绝。 |
| `inkan decision add "<title>" --context <text> --decision <text> [--driver <text>]... [--option <text>]... [--consequence <text>]... [-s <status>]` | 写入一个带编号的 MADR 文件，并打印其路径。 | 缺少必要 section。 |
| `inkan decision update <id> --status <status> --reason <text>` | 追加一条带日期的历史记录，并设置新状态。有 open outcome 时会指出它的名称。永不编辑 Context 或 Decision Outcome。 | id 或 status 未知。 |
| `inkan decision list [-s <status>]` / `inkan decision show <id>` | 只读。`show` 接受 `2`、`02` 或 `0002`。 | 永不拒绝。 |
| `inkan skill install --target <dir>` | 把内置 skill 复制到 `<dir>/use-inkan/`，并打印目标路径。 | 目标已存在，且与内置 skill 不同。 |

Decision status 包括 `proposed`、`accepted`、`rejected`、`deferred`、`deprecated` 和 `superseded`。

## 工作原理

```
.inkan/
  outcomes/<id>.jsonl      每个 outcome 一个 append-only 文件
  decisions/NNNN-slug.md   MADR 记录
```

`2026-09-03-1432-k7m2` 这样的 outcome id，由 outcome 开始时的 UTC 日期与分钟，加上四个随机字符组成。因此 id 可以按时间排序，两个 branch 也几乎不可能发生冲突。每个 outcome 文件包含一个 `begin` event、任意数量的 `amend` event，以及最多一个 `end` event。所谓 open outcome，就是一个尚无 `end` 的文件。

contract hash 是一个 SHA-256，计算范围包括 outcome 文本、带 withdrawn 标记的验收标准、关联的 decision，以及每次 amendment 的 reason 和 addition。`end` 会记录这个 hash，同时记录 working tree 的 git tree hash；计算时会排除 `.inkan/outcomes`，因此日志本身不会扰动它所描述的工作 hash。`check` 会重新 fold commit 中保存的 outcome，并同时比较两者。

由于每个 outcome 都有独立文件，两个 branch 永远不会改动同一个 outcome 文件，普通 merge 就能把记录自然汇合。这种设计不需要 cache，也能让 review 保持轻快：不带 filter 的 `log` 只读取实际要打印的文件数；内置 benchmark（`npm run bench`）会生成一万个已关闭的 outcome，并将 `log -n 3` 控制在 50 ms 以内、`log --grep` 控制在 1 秒以内、`doctor` 控制在 2 秒以内。

## 当前状态

Inkan 0.1.0 是首个正式版本，也是 DriftSeal 继任者的一次从零重构。本版本有意没有加入 DriftSeal 历史记录 importer、MCP server，以及面向特定 agent host 的 installer。这些都属于 adapter，可以后续补上，而无需改变记录格式。Lane 目前只作为 `begin` 时可选的归档 tag，以及 `log` 的 filter。

## License

MIT
