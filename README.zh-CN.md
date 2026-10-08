# dsh-i-have-adhd

给 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 用的 ADHD 输出风格。它往系统提示词里加一套规则，让回复更好执行：先给下一步动作、多步任务编号、每轮复述进度、不写开场白。会话跑着也能随时开关。

移植自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（MIT）。`skills/i-have-adhd/SKILL.md` 是上游原文，一字未改。

[English](README.md)

## 为什么要重新实现一遍

上游是一堆按运行时分发的胶水脚本。Claude Code 那边注册一个 `SessionStart` hook 把规则贴进会话，另外用 `~/.claude/.i-have-adhd-always` 这个标志文件记住"常开"。DSH 没有 session-start hook，所以这三件事都收进了一个 bundle：

| 能力 | 上游 | 这里 |
| --- | --- | --- |
| hook | `SessionStart` hook | `ctx.systemPrompt.section()`，`text` 用动态函数 |
| 开关 | `~/.claude/` 下的标志文件 | `.volatile()` 配置字段，改完即生效并持久化 |
| 界面 | 无 | 设置页 + 输入框旁的胶囊 |

## 安装

```sh
dsh plugin --profile web add github:letterk/dsh-i-have-adhd
```

就这一行。`dsh plugin` 把后面的参数原样转成 profile 目录里的 pnpm 命令，下次启动时任何声明了 `dsh.bundle` 的新依赖会被自动提升为 profile 层，不需要再单独启用。装完重启 profile。

pnpm 认的其他 spec：

```sh
dsh plugin --profile web add file:/path/to/dsh-i-have-adhd
dsh plugin --profile web remove dsh-i-have-adhd
```

npm 上那个裸名 `dsh-i-have-adhd` 不是这个项目（被另一个插件占了），所以装的时候用仓库 spec。

要装的是你打算改的工作区，需要多一步，见 [就地编辑安装](#就地编辑安装)。

## 使用

两个地方，都在 Web 界面里：

| 位置 | 操作 |
| --- | --- |
| 输入框旁的胶囊 | 点一下 |
| 设置 → ADHD 输出模式 | 拨开关 |

改完下一轮对话就生效，并写进 profile 配置，重启也还在。没有命令、没有工具、也不用打字——界面是唯一的控制入口，出问题时也只有这一个地方要查。

开关是全局的，不分会话。DSH 的 `PromptSection` 不接受会话参数，没地方存"这个会话开没开"。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | volatile，界面写的那个开关 |
| `order` | `15` | 段落排在系统提示词里的位置 |

## 文件

```
index.js                       Host 半边：系统提示词 hook
client.js                      Client 半边：胶囊和设置页
cordis.patch.yml               插入插件的 loader 行
skills/i-have-adhd/SKILL.md    上游的规则集
locale/{en,zh}.json            bundle 的标题和描述
icon.svg                       bundle 图标
test/host.mjs                  Host 自测
test/client.mjs                Client 自测，React 用桩
test/loader-hooks.mjs          裸仓库里把 schemastery 的导入指到桩
test/schemastery-stub.mjs      @deepseek-ai/schemastery 的最小替身
```

## 开发

```sh
npm test
```

`test/host.mjs` 用一个假的 Cordis context 加载 `index.js`，检查 section 注册、规则只在开关打开时出现，以及 Host 半边没有暴露任何命令、工具或短语匹配。`test/client.mjs` 用桩浏览器全局量和桩 React 加载 `client.js`，在 `zh` 和 `en` 下各渲染一遍两个座位。

两个测试都不需要 DSH、不需要浏览器，也不需要 `npm install`。

### 就地编辑安装

`file:` 装进去的是副本，profile 会一直用安装时那一版。想让 profile 直接读你的工作区，就改用 link：

```sh
dsh plugin --profile web add link:/path/to/dsh-i-have-adhd
```

被链接的 bundle 从它自己的目录被导入，裸导入也就从那里解析，而不是从 profile。所以要给这个 checkout 一个能走到 harness 包的 `node_modules`：

```sh
cd /path/to/dsh-i-have-adhd
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

少了它，行装得上，导入会失败：`Cannot find package '@deepseek-ai/schemastery'`。这个软链接在 `.gitignore` 里，新克隆的仓库要重做一次。

有些环境下 `client.js` 不会热加载，改完记得刷新 Web UI 页面。

在 harness 会话里做实时检查：

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:i-have-adhd"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## 许可证

MIT。`skills/i-have-adhd/SKILL.md` 以及它背后的设计来自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（作者 Ayoub Ghriss），其余代码属于本项目。
