# dsh-i-have-adhd

ADHD-friendly output style for [DeepSeek Harness](https://github.com/deepseek-ai/dsh). It puts a ruleset in the system prompt that makes replies easier to act on: the next action first, numbered steps, state restated each turn, no preamble. You can switch it on and off while a session is running.

A port of [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) (MIT). The ruleset in `skills/i-have-adhd/SKILL.md` is upstream's, unchanged.

[中文说明](README.zh-CN.md)

## What this replaces

Upstream is a set of glue scripts, one per runtime. On Claude Code it registers a `SessionStart` hook that pastes the ruleset into the session, and keeps an "always on" flag file at `~/.claude/.i-have-adhd-always`. DSH has no session-start hook, so all three pieces live in one bundle here:

| Piece | Upstream | Here |
| --- | --- | --- |
| hook | `SessionStart` hook | `ctx.systemPrompt.section()` with a dynamic `text` |
| switch | flag file under `~/.claude/` | a `.volatile()` config field, live and persisted |
| page | none | a settings page and a pill next to the composer |

## Install

```sh
dsh plugin --profile web add dsh-i-have-adhd
```

That is the whole install. `dsh plugin` forwards the rest of the line to pnpm inside the profile, and the next boot promotes any new dependency that declares `dsh.bundle` to a profile layer on its own — there is no second step. Restart the profile afterwards.

Any spec pnpm accepts works:

```sh
dsh plugin --profile web add github:letterk/dsh-i-have-adhd
dsh plugin --profile web add file:/path/to/dsh-i-have-adhd
dsh plugin --profile web remove dsh-i-have-adhd
```

Installing from a working tree you intend to edit takes one extra step: see [live-edit install](#live-edit-install).

## Use

| Input | Effect |
| --- | --- |
| `/adhd on`, `/adhd off` | set the mode |
| `/adhd toggle`, `/adhd status` | flip it, read it |
| the pill next to the composer | set the mode |
| Settings → ADHD output mode | set the mode |
| `/i-have-adhd` in a message | turn it on |
| `stop adhd mode`, `关闭adhd`, `正常模式` | turn it off |

The switch is profile-wide, not per session. DSH's `PromptSection` takes no session key, so there is nowhere to store whether the mode was on in one particular session.

## Config

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | volatile; the live switch |
| `order` | `15` | position of the section in the system prompt |
| `registerSkill` | `true` | also publish the ruleset as a user-invocable skill |
| `honorStopPhrase` | `true` | let the stop phrases turn the mode off |

## Files

```
index.js                       host half: hook, switch, command, gesture listener, skill
client.js                      client half: composer pill and settings page
cordis.patch.yml               loader row that inserts the plugin
skills/i-have-adhd/SKILL.md    the ruleset, from upstream
locale/{en,zh}.json            bundle title and description
icon.svg                       bundle icon
test/host.mjs                  host self-test
test/client.mjs                client self-test, stub React
test/loader-hooks.mjs          points the schemastery import at the stub in a bare checkout
test/schemastery-stub.mjs      minimal stand-in for @deepseek-ai/schemastery
```

## Development

```sh
npm test
```

`test/host.mjs` loads `index.js` against a fake Cordis context and checks the section, skill, command and listener registrations, the whole `/adhd` argument table, every stop phrase, and the failed-write path. `test/client.mjs` loads `client.js` against stub browser globals and a stub React, then renders both seats in `zh` and `en`.

Neither test needs DSH, a browser, or `npm install`.

### Live-edit install

`file:` installs a copy, so the profile keeps the revision it was installed from. To have the profile read your working tree directly, link it instead:

```sh
dsh plugin --profile web add link:/path/to/dsh-i-have-adhd
```

A linked bundle is imported from its own directory, so its bare imports resolve there and not in the profile. Give the checkout a `node_modules` that reaches the harness packages:

```sh
cd /path/to/dsh-i-have-adhd
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

Without it the row installs and then fails to import: `Cannot find package '@deepseek-ai/schemastery'`. The link is in `.gitignore`, so a fresh clone has to repeat this once.

`client.js` is not hot-reloaded in every setup; reload the Web UI page after editing it.

Live inspection, from a session inside the harness:

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:i-have-adhd"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## License

MIT. `skills/i-have-adhd/SKILL.md` and the design it encodes come from [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) by Ayoub Ghriss. Everything else is this project.
