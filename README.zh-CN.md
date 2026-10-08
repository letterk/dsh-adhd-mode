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

走插件管理器，不要手动往 profile 里拷文件。

```sh
cd /path/to/dsh-i-have-adhd
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

```sh
plugin_manager action=install_bundle target=/path/to/dsh-i-have-adhd
plugin_manager action=set_bundle     target=dsh-i-have-adhd enabled=true
```

那个软链接是必须的。`install_bundle` 把目录以 `link:` 依赖的形式装进去，而 Node 解析被链接包的裸导入时用的是它的 realpath，所以 `@deepseek-ai/schemastery` 必须能从本目录找到。少了它，行能装上，但激活会失败。

两个容易踩的坑：

- 对已经装过的目录再跑一次 `install_bundle`，只会回你 `ambiguous-install`，不会重试激活。要用 `set_bundle ... enabled=false` 再 `enabled=true` 来回切一次。
- 有些环境下 `client.js` 不会热加载。改完记得刷新 Web UI 页面。

## 使用

| 操作 | 效果 |
| --- | --- |
| `/adhd on`、`/adhd off` | 开 / 关 |
| `/adhd toggle`、`/adhd status` | 切换 / 查看状态 |
| 输入框旁的胶囊 | 开 / 关 |
| 设置 → ADHD 输出模式 | 开 / 关 |
| 消息里写 `/i-have-adhd` | 打开 |
| `stop adhd mode`、`关闭adhd`、`正常模式` | 关闭 |

开关是全局的，不分会话。DSH 的 `PromptSection` 不接受会话参数，没地方存"这个会话开没开"。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | volatile，实时开关 |
| `order` | `15` | 段落排在系统提示词里的位置 |
| `registerSkill` | `true` | 同时把规则集注册成用户可调用的 skill |
| `honorStopPhrase` | `true` | 允许关闭短语把模式关掉 |

## 文件

```
index.js                       Host 半边：hook、开关、命令、手势监听、skill
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

`test/host.mjs` 用一个假的 Cordis context 加载 `index.js`，检查 section、skill、command、监听器的注册情况，`/adhd` 的完整参数表，所有关闭短语，以及写入失败的分支。`test/client.mjs` 用桩浏览器全局量和桩 React 加载 `client.js`，在 `zh` 和 `en` 下各渲染一遍两个座位。

两个测试都不需要 DSH、不需要浏览器，也不需要 `npm install`。

在 harness 会话里做实时检查：

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:i-have-adhd"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## 许可证

MIT。`skills/i-have-adhd/SKILL.md` 以及它背后的设计来自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（作者 Ayoub Ghriss），其余代码属于本项目。
