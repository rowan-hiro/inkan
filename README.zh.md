# Inkan

[English](README.md) | 简体中文

**Agent 许下承诺，Inkan 留下凭据。**

*先把工作要交付的结果 seal 下来，在结束时如实记录完成情况。*

Inkan 是一款小巧、零依赖的 CLI，面向使用 coding agent 开发的代码仓库。它记录每项工作原本要交付什么、意图在过程中如何变化，以及结束时作出了怎样的声明。记录保存在仓库里，随代码一起提交；换一个 session 或 agent，也能从这里接手工作。

## 问题所在

漫长的 agent session 很容易偏离目标。Context 被压缩后，新 session 接手一项做到一半的任务，任务却在不知不觉间被重新解释：范围缩小了，一条验收标准被忘了，A 变成了 B，最终消息却依然写着“完成”。测试发现不了这种问题。测试能告诉你代码是否可用，却不能告诉你，这是不是你最初要求的那份代码。

常见的解决办法是不断增加检查：更多测试、更多 gate，每次查看日志都重新验证一遍。这会让 agent 每次重读历史时，都再次检查自己过去的工作，最终陷入没有尽头的循环。Inkan 选择了另一条路：如实记录当时声明了什么、声明发生在何时，把记录本身视为事实，并把结果是否正确的判断交还给仓库自己的测试体系。

## 记录里有什么

| 问题 | Inkan 如何回答 |
|---|---|
| 工作原本要交付什么？ | `begin` 把 outcome 文本和验收标准 seal 到一个 append-only 文件中。`status` 逐字打印 open outcome。 |
| 意图发生过什么变化？ | 标题保留。`amend --reason` 追加原因、补充说明，以及新增或撤回的标准。 |
| 结束时声明了什么？ | `end` 记录每条仍生效标准的 disposition 和结束说明。没有 end event 的 outcome 保持 open。 |

这些都是工作声明。Inkan 不把它们与 commit 比较，也不判断工作是否满足了标准。关闭之后，没有额外的交付审计步骤，也没有再次证明同一项工作的义务。

## 快速开始

需要 Node.js 22 或更高版本。按仓库平时的 Git 流程提交记录即可；Inkan 本身不调用 Git。

```sh
npm install --global @rowan-hiro/inkan
```

这会安装 `inkan` 及其别名 `ink`，两者接受完全相同的参数。

**1. 初始化仓库。**

```sh
inkan init
```

这条命令会把一段由 Inkan 管理的 protocol 写入 `AGENTS.md`，并创建 `.inkan/`。请把两者一并 commit；从这一刻开始，它们就是代码的一部分。加上 `--claude`，还会把 `CLAUDE.md` 软链到 `AGENTS.md`，让 Claude Code 从同一个文件读取同一份 policy。

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

状态根据 disposition 推导：所有标准都声明为 met 时是 `completed`，只要有一项声明为 unmet 就是 `partial`。如实记录的 `partial` 是一种完整、正式的结果；agent 应当报告它，而不是为了声称“完成”而拉伸 done 的定义。

**5. 把工作和记录一起提交。**

把本项工作涉及的文件加入暂存区，包括 `.inkan/` 中的记录。落地 commit 要带上 `end` 打印的 trailer：

```sh
git commit -m "feat: account recovery" \
  -m "Inkan-Outcome: 2026-09-03-0621-82qz"
```

trailer 放在 commit message 的最后一段，与其他 trailer 相邻，中间不留空行。agent protocol 要求提交时写上这条关联信息；Inkan 不安装 hook，也不通过程序阻塞提交来执行这项规则。

outcome 已经关闭，后面没有需要执行的交付审计。

## 阅读历史时使用关联信息

`Inkan-Outcome: <id>` 把 commit 与 outcome 联系起来，方便了解工作原本要交付什么、过程中如何调整，以及结束时声明了什么。它不证明工作已完成、验收条件已满足，也不证明 commit 的内容。

需要这些上下文时再沿着引用读取。了解历史时，优先通过普通 Git 命令读取该 commit 中的 `.inkan/outcomes/<id>.jsonl`；`inkan log <id>` 读取的是当前 checkout 中的记录。这种读取只提供上下文，不作一致性判断。

缺少 trailer 或找不到关联记录，只表示信息缺失。阅读历史不要求验证交付、补填 trailer、修复旧 commit 或重新打开已关闭的 outcome。提交规则用于写入新的 commit，不给阅读者增加追溯修补的义务。

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

- **它绝不运行任何任务。** 不运行测试、build 或 shell command。Inkan 不启动任何 child process，包括 Git。工作是否正确，应由仓库自己判断。
- **它绝不充当 gate。** `git commit` 之前或期间不会运行任何 Inkan 操作，`init` 也不会安装 hook。没有 commit 比较或交付审计。`doctor` 是可选的文件诊断工具，不是工作流程中的必经步骤。
- **关闭即最终状态。** 没有 stale state，没有 invalidation，也不存在已经关闭的 outcome 还需要重做的概念。查看日志就是阅读，而不是重新检查。如果过去的声明如今看来有误，那应当成为一项拥有独立 seal 的新 outcome。
- **它绝不代替别人关闭 outcome。** 多个 outcome 可以同时 open，每个 session 或 branch 各自拥有一个。`begin` 会指出其他 outcome 的存在，但不会碰它们。从未关闭的 outcome，就是“它确实没有关闭”的诚实记录；为何一直 open，应由人来调查，而不是由 agent 擅自判断。仅仅为了关闭而关闭，只会让日志充斥无意义的记录。
- **它绝不改写当时的场景。** 情况变化时，agent 可以通过 amendment 或新的 decision record 对既有决定提出挑战，但绝不会修改那段记录了当时所知信息与所作决定的文本。
- **没有额外运转部件。** 没有 server、database、index、lock、sidecar file 或 environment variable。一切都是 `.inkan/` 下的纯文本，随代码一同 commit，并通过普通 git 操作完成 merge。

## 为 agent 而生

`inkan init` 会把生成好的 protocol block 写进 coding agent 本来就会读取的 `AGENTS.md`。其中只有五条规则：在 durable change 之前 seal；seal 是事实；先逐项 disposition 并关闭，再把记录与工作一起提交，并写入 outcome trailer；context 丢失后用 `inkan status` 重新锚定，同时不碰其他 session 的 outcome；关闭即最终状态，阅读历史时仅把 commit 引用作为辅助信息。

这个 block 只说明 policy 和每次调用需要交代的内容，命令和参数用法见 `inkan help`。

protocol block 带有版本号。`init` 会原地升级由旧版 protocol 生成的 block，但拒绝覆盖经过手工编辑的 block，确保 policy 始终只有一个权威来源。`--lang <tag>` 用来设置 agent 撰写 outcome 文本时应使用的语言。`inkan init --claude` 还会把 `CLAUDE.md` 创建为指向 `AGENTS.md` 的 symlink：Claude Code 读的是自己认识的文件名，而 policy 依然只有一份，不是副本。

## 让决策与代码同行

设计选择以 MADR（Markdown Architectural Decision Records）的形式保存在 `.inkan/decisions/` 下，每条记录对应一个编号为 `NNNN-slug.md` 的文件。`inkan decision add` 用于创建记录。其中的 Context 和 Decision Outcome 部分会记下当时的场景与选择，之后永不改写。

如果要挑战一项决定，可运行 `inkan decision update <id> --status <status> --reason "<text>"`，追加一条带日期的历史记录；也可以创建一条新记录来 supersede 旧记录。

outcome 可以在 `begin` 或 `amend` 时通过 `--decision <id>` 指明自己受哪些 decision 约束。这些 decision 是工作的约束条件，但绝不是关闭工作的 gate。

Inkan 自己的设计也用同样的方式记录，从 `0001` 中划定的边界一路延续至今。仓库没有单独的设计文档；`inkan decision list` 就是它的索引。

## 工作共用一份记录

每个阶段都向记录追加内容，不改写此前的声明。

| 阶段 | 记录什么 | 命令 |
|---|---|---|
| 意图 | 要交付什么，以及如何判断是否达成 | `begin` |
| 变更 | 意图如何变化，以及为什么变化 | `amend --reason` |
| 约束 | 当前工作受哪些 decision 约束 | `decision add`、`--decision` |
| 关闭 | 每条标准的 disposition，以及由这些声明推导出的状态 | `end` |
| 提交关联 | commit 关联的 outcome，供阅读时了解上下文 | `Inkan-Outcome` trailer |
| 恢复 | 新 session 从哪里接手 | `status`、`log` |

Inkan 本身也这样开发：工作先作为 outcome 被 seal，结束时记录声明；设计决定保存在 `.inkan/decisions/` 中。仓库保存长期上下文，供参与工作的每个 agent 使用。

## 可选的文件诊断

`inkan doctor` 报告记录文件损坏、id 不匹配或重复，以及缺失的 decision 引用。需要排查这些文件时可以主动运行；它不判断工作结果、不读取 commit，也不修复内容。

关闭 outcome、提交代码和恢复 session 都不要求运行 `doctor`，生成的 agent protocol 也不包含这一步。

## 命令参考

| 命令 | 作用 | 何时拒绝执行 |
|---|---|---|
| `inkan init [--lang <tag>] [--claude]` | 写入或升级 `AGENTS.md` 中由 Inkan 管理的 block；创建 `.inkan/`。`--claude` 还会把 `CLAUDE.md` 软链到 `AGENTS.md`。 | block 曾被手工编辑；已存在一个不是该 symlink 的 `CLAUDE.md`。 |
| `inkan begin "<outcome>" [--accept <text>]... [--decision <id>]... [--lane <tag>]` | Seal 一个新 outcome，并打印其 id。其他 open outcome 会在 stderr 的 notice 中被点名，但不会受到任何改动。 | 永不拒绝。 |
| `inkan amend --reason <text> [<addition>] [--accept <text>]... [--withdraw <n>]... [--decision <id>]... [<id>]` | 追加 amendment，并打印新的 contract hash。 | 没有 reason；没有 open outcome；存在多个 open outcome，却没有用 `<id>` 明确指定目标。 |
| `inkan end [<id>] [--met <n>]... [--unmet <n>]... [-s abandoned] --note <text>` | 记录 disposition 并关闭 outcome。状态由结果推导：全部 met 为 `completed`，任一 unmet 为 `partial`。打印 outcome id、状态和供 commit 使用的关联 trailer。 | 仍生效的标准缺少 disposition（以 `-s abandoned` 关闭时除外）；没有 note。 |
| `inkan status` | 逐字打印所有 open outcome：seal 时间、hash、lane、带编号的标准、附 reason 的 amendment，以及关联的 decision。 | 永不拒绝。 |
| `inkan log [-n N] [--since <date>] [--grep <regex>] [--status <s>] [--decision <id>] [--lane <tag>] [<id>]` | 每个 outcome 打印一行，最新的在前，默认 20 条。`<id>` 会完整打印一项 outcome，包括 disposition 和 note。filter 可以组合。 | 永不拒绝。 |
| `inkan doctor` | 可选的只读文件诊断。Fold 所有 outcome 并解析所有 decision；报告损坏文件、id 不匹配、重复的 decision id，以及失效的 decision link。退出码：正常为 0，发现问题为 1。 | 永不拒绝。 |
| `inkan decision add "<title>" --context <text> --decision <text> [--driver <text>]... [--option <text>]... [--consequence <text>]... [-s <status>]` | 写入一个带编号的 MADR 文件，并打印其路径。 | 缺少必要 section。 |
| `inkan decision update <id> --status <status> --reason <text>` | 追加一条带日期的历史记录，并设置新状态。有 open outcome 时会指出它的名称。永不编辑 Context 或 Decision Outcome。 | id 或 status 未知。 |
| `inkan decision list [-s <status>]` / `inkan decision show <id>` | 只读。`show` 接受 `2`、`02` 或 `0002`。 | 永不拒绝。 |

Decision status 包括 `proposed`、`accepted`、`rejected`、`deferred`、`deprecated` 和 `superseded`。

## 工作原理

```
.inkan/
  outcomes/<id>.jsonl      每个 outcome 一个 append-only 文件
  decisions/NNNN-slug.md   MADR 记录
```

`2026-09-03-1432-k7m2` 这样的 outcome id，由 outcome 开始时的 UTC 日期与分钟，加上四个随机字符组成。因此 id 可以按时间排序，两个 branch 也几乎不可能发生冲突。每个 outcome 文件包含一个 `begin` event、任意数量的 `amend` event，以及最多一个 `end` event。所谓 open outcome，就是一个尚无 `end` 的文件。

contract hash 是一个 SHA-256，计算范围包括 outcome 文本、带 withdrawn 标记的验收标准、关联的 decision，以及每次 amendment 的 reason 和 addition。`end` 把这个 hash 与 disposition 和 note 一起保存。读取时仍会检查 event 格式并拒绝损坏的记录，但不会读取项目文件或与 commit 比较。旧 v1 记录中的 Git 信息可以继续读取，不会被改写。

由于每个 outcome 都有独立文件，两个 branch 永远不会改动同一个 outcome 文件，普通 merge 就能把记录自然汇合。这种设计不需要 cache，也能让 review 保持轻快：不带 filter 的 `log` 只读取实际要打印的文件数；内置 benchmark（`npm run bench`）会生成一万个已关闭的 outcome，并将 `log -n 3` 控制在 50 ms 以内、`log --grep` 控制在 1 秒以内、`doctor` 控制在 2 秒以内。

## 当前状态

Inkan 从 0.1.0 起作为 DriftSeal 的继任者，从零重新构建。当前开发版本移除了首发版本中的交付审计（decision 0015），同时保留 outcome trailer 作为 commit 的关联信息（decision 0016）。目前仍未加入 DriftSeal 历史记录 importer 和 MCP server。这些都属于 adapter，可以后续补上，而无需改变记录格式。对于 Claude Code，`inkan init --claude` 把 `CLAUDE.md` 软链到 `AGENTS.md`；其他 host 直接读取 `AGENTS.md`。Lane 目前只作为 `begin` 时可选的归档 tag，以及 `log` 的 filter。

## License

MIT
