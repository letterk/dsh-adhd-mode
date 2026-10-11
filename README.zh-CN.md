# dsh-adhd-mode

给 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 用的 ADHD 输出风格。它往系统提示词里加一套规则，让回复更好执行：先给下一步动作、多步任务编号、每轮复述进度、不写开场白。会话跑着也能随时开关。

移植自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（MIT）。`skills/adhd-mode/rules.md` 是上游原文，只换掉了一段：上游靠读者说一句话关掉，而这个 bundle 没有要说的话（见[改动在哪](#改动在哪)）。

[English](README.md)

## 为什么要重新实现一遍

上游是一堆按运行时分发的胶水脚本。Claude Code 那边注册一个 `SessionStart` hook 把规则贴进会话，另外用 `~/.claude/.i-have-adhd-always` 这个标志文件记住"常开"。DSH 没有 session-start hook，所以这三件事都收进了一个 bundle：

| 能力 | 上游 | 这里 |
| --- | --- | --- |
| hook | `SessionStart` hook | 挂在 `agent.ctx` 上的 `systemPrompt.section()`，`text` 用动态函数 |
| 开关 | `~/.claude/` 下的标志文件 | `.volatile()` 配置字段，改完即生效并持久化 |
| 界面 | 无 | 设置页 + 输入框工具栏里的 ADHD 按钮 |

## 改动在哪

规则集里只有 `## Persistence` 这一段不是上游原文。上游靠读者说 "stop adhd mode" 关掉，而且它的 `SessionStart` hook 会在会话开始、恢复、压缩时重新贴上规则。这两件事这里都做不到——Host 半边不匹配任何文本——所以那一段改成：开关在会话外面，会话里说什么都不会改变模式。`skills/adhd-mode/rules.md` 的其余部分是上游原文，frontmatter 也在，其中 `disable-model-invocation` 是空转的，因为这个 bundle 从不把这个文件注册成 skill。

上游的规则集改动很慢（那个项目主要是给各家运行时做胶水），所以这里没有同步流程：这份是 fork，手工维护。

## 安装

```sh
dsh plugin --profile web add github:letterk/dsh-adhd-mode
```

就这一行。`dsh plugin` 把后面的参数原样转成 profile 目录里的 pnpm 命令，下次启动时任何声明了 `dsh.bundle` 的新依赖会被自动提升为 profile 层，不需要再单独启用。装完重启 profile。

pnpm 认的其他 spec：

```sh
dsh plugin --profile web add file:/path/to/dsh-adhd-mode
dsh plugin --profile web remove dsh-adhd-mode
```

`dsh-adhd-mode` 这个名字在 npm 上没人占，但本项目没发布到 npm，所以装的时候用仓库 spec。

要装的是你打算改的工作区，需要多一步，见 [就地编辑安装](#就地编辑安装)。

## 使用

两个地方，都在 Web 界面里：

| 位置 | 操作 |
| --- | --- |
| 输入框工具栏里的 `ADHD` 按钮 | 点一下 |
| 设置 → ADHD 输出模式 | 拨开关 |

改完下一轮对话就生效，并写进 profile 配置，重启也还在。没有命令、没有工具、也不用打字——界面是唯一的控制入口，出问题时也只有这一个地方要查。

开关是全局的，不分会话。DSH 的 `PromptSection` 不接受会话参数，没地方存"这个会话开没开"。

有作用域的是注入本身。这个 section 注册在 agent 自己的上下文上，而不是插件的上下文上，所以规则只到读者正在对话的那个 agent，不会再往下走。被委派出去的子代理——凡是带委派深度的，包括专家团的成员——加入的是父级的 preset，装配时用的是自己的 persona 和工具集，不会带上这个 section。而从别的会话 fork 出来的会话是读者主动开的顶层 agent，它会拿到这个 section。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | volatile，界面写的那个开关 |
| `order` | `15` | 段落排在系统提示词里的位置 |

## 文件

```
index.js                        Host 半边：系统提示词 hook
client.js                       Client 半边：输入框按钮和设置页
cordis.patch.yml                插入插件的 loader 行
skills/adhd-mode/rules.md       上游的规则集
locale/{en,zh}.json             bundle 的标题和描述
icon.svg                        bundle 图标
test/host.mjs                   Host 自测
test/client.mjs                 Client 自测，React 用桩
test/loader-hooks.mjs           裸仓库里把 schemastery 的导入指到桩
test/schemastery-stub.mjs       @deepseek-ai/schemastery 的最小替身
scripts/release.mjs             改版本号、冻结 changelog、打 tag；CI 用 verify/notes
```

## 版本

[语义化版本](https://semver.org/lang/zh-CN/)。兼容面很小——loader 的 row id 和 settings 命名空间这两个字符串是 profile 里存下来的——所以规则围着"已经装好的人要不要动手"转：

| 递增 | 什么时候 |
| --- | --- |
| MAJOR | 已经装的得重来一遍：loader row id 或 settings 命名空间变了、配置字段没了、或者要求更新的 DSH |
| MINOR | 读者拿到了新东西，或者注入行为变了：新座位、新配置字段、新语言、不同的提示词段落 |
| PATCH | 没人需要反应的修复：规则措辞、文档、测试、内部重构 |

版本号在 `package.json`，这一版里有什么记在 `CHANGELOG.md`，`[Unreleased]` 一直攒到被冻结。切一版是一条命令：

```sh
npm run release -- patch    # 或 minor / major
```

它会改版本号、把 `[Unreleased]` 的内容变成带日期的段落、跑测试、提交并推 tag。然后 `.github/workflows/release.yml` 按那个段落发布 GitHub release。CI 会拒绝和 `package.json` 对不上的 tag，`doctor` 任务会拒绝没有 changelog 段落解释的版本号。

插件市场的版本号是从 `package.json` 里读的，所以这里写什么，列表页就显示什么。这个项目没有发到 npm，版本号不参与依赖解析——但 tag 是"读者当时拿到的是哪份代码"的唯一不可变指针。

## 开发

```sh
npm test
```

`test/host.mjs` 用一个假的 Cordis context 加载 `index.js`，检查每个顶层 agent 只注册一个 section、被委派的子代理一个都拿不到而 fork 出来的还能拿到、规则只在开关打开时出现，以及 Host 半边没有暴露任何命令、工具或短语匹配。`test/client.mjs` 用桩浏览器全局量和桩 React 加载 `client.js`，在 `zh` 和 `en` 下各渲染一遍两个座位。

两个测试都不需要 DSH、不需要浏览器，也不需要 `npm install`。

Host 测试能解析到真实的 `@deepseek-ai/schemastery` 时就用真的，解析不到就用 `test/schemastery-stub.mjs`，CI、裸仓库，以及没有链入 profile 依赖的检出都走后者。想强行走桩：

```sh
DSH_ADHD_MODE_STUB=1 npm test
```

### 就地编辑安装

`file:` 装进去的是副本，profile 会一直用安装时那一版。想让 profile 直接读你的工作区，就改用 link：

```sh
dsh plugin --profile web add link:/path/to/dsh-adhd-mode
```

被链接的 bundle 从它自己的目录被导入，裸导入也就从那里解析，而不是从 profile。所以要给这个 checkout 一个能走到 harness 包的 `node_modules`：

```sh
cd /path/to/dsh-adhd-mode
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

少了它，行装得上，导入会失败：`Cannot find package '@deepseek-ai/schemastery'`。这个软链接在 `.gitignore` 里，新克隆的仓库要重做一次。

有些环境下 `client.js` 不会热加载，改完记得刷新 Web UI 页面。

在 harness 会话里做实时检查：

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:adhd-mode"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## 许可证

MIT。`skills/adhd-mode/rules.md` 以及它背后的设计来自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（作者 Ayoub Ghriss），其余代码属于本项目。
