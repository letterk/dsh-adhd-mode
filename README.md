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

Through the plugin manager. Do not copy files into the profile.

```sh
cd /path/to/dsh-i-have-adhd
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

```sh
plugin_manager action=install_bundle target=/path/to/dsh-i-have-adhd
plugin_manager action=set_bundle     target=dsh-i-have-adhd enabled=true
```

The symlink is required. `install_bundle` adds the directory as a `link:` dependency, and Node resolves a linked package's bare imports from that package's realpath, so `@deepseek-ai/schemastery` has to be reachable from this directory. Without it the row installs and then fails to activate.

Two things that are easy to trip over:

- Running `install_bundle` again on an already-installed directory answers `ambiguous-install` and does not retry activation. Cycle the bundle with `set_bundle ... enabled=false` and then `enabled=true`.
- `client.js` is not hot-reloaded in every setup. After editing it, reload the Web UI page.

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

Live inspection, from a session inside the harness:

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:i-have-adhd"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## License

MIT. `skills/i-have-adhd/SKILL.md` and the design it encodes come from [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) by Ayoub Ghriss. Everything else is this project.
