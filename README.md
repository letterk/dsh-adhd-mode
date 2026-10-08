# dsh-adhd-mode

ADHD-friendly output style for [DeepSeek Harness](https://github.com/deepseek-ai/dsh). It puts a ruleset in the system prompt that makes replies easier to act on: the next action first, numbered steps, state restated each turn, no preamble. You can switch it on and off while a session is running.

A port of [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) (MIT). The ruleset in `skills/adhd-mode/rules.md` is upstream's text with one paragraph replaced: upstream is turned off when the reader says a phrase, and this bundle has no phrase to say ([what changed](#changes-from-upstream)).

[中文说明](README.zh-CN.md)

## What this replaces

Upstream is a set of glue scripts, one per runtime. On Claude Code it registers a `SessionStart` hook that pastes the ruleset into the session, and keeps an "always on" flag file at `~/.claude/.i-have-adhd-always`. DSH has no session-start hook, so all three pieces live in one bundle here:

| Piece | Upstream | Here |
| --- | --- | --- |
| hook | `SessionStart` hook | `ctx.systemPrompt.section()` with a dynamic `text` |
| switch | flag file under `~/.claude/` | a `.volatile()` config field, live and persisted |
| page | none | a settings page and a pill next to the composer |

## Changes from upstream

One paragraph of the ruleset is not upstream's: `## Persistence`. Upstream turns the mode off when the reader says "stop adhd mode", and its `SessionStart` hook re-pastes the ruleset whenever a session starts, resumes or compacts. Neither can happen here — the Host half matches no text — so that paragraph now says the switch lives outside the conversation and that nothing said in the conversation changes the mode. Everything else in `skills/adhd-mode/rules.md` is upstream's text, frontmatter included; the `disable-model-invocation` flag is inert because this bundle never registers the file as a skill.

Upstream's ruleset moves slowly (the project is mostly per-runtime glue), so there is no sync workflow: this copy is a fork, edited by hand.

## Install

```sh
dsh plugin --profile web add github:letterk/dsh-adhd-mode
```

That is the whole install. `dsh plugin` forwards the rest of the line to pnpm inside the profile, and the next boot promotes any new dependency that declares `dsh.bundle` to a profile layer on its own — there is no second step. Restart the profile afterwards.

Other specs pnpm accepts:

```sh
dsh plugin --profile web add file:/path/to/dsh-adhd-mode
dsh plugin --profile web remove dsh-adhd-mode
```

The name `dsh-adhd-mode` is free on npm, but this project is not published there, so install by repository spec.

Installing from a working tree you intend to edit takes one extra step: see [live-edit install](#live-edit-install).

## Use

Two places, both in the Web UI:

| Where | What |
| --- | --- |
| the pill next to the composer | click to flip |
| Settings → ADHD output mode | the switch on the page |

The change lands on the next model step and is written to the profile's config, so it survives a restart. There is no command, no tool and nothing to type — the UI is the only control, and the only place to look when the mode is not doing what you expected.

The switch is profile-wide, not per session. DSH's `PromptSection` takes no session key, so there is nowhere to store whether the mode was on in one particular session.

## Config

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | volatile; the switch the UI writes |
| `order` | `15` | position of the section in the system prompt |

## Files

```
index.js                        host half: the system-prompt hook
client.js                       client half: composer pill and settings page
cordis.patch.yml                loader row that inserts the plugin
skills/adhd-mode/rules.md       the ruleset, from upstream
locale/{en,zh}.json             bundle title and description
icon.svg                        bundle icon
test/host.mjs                   host self-test
test/client.mjs                 client self-test, stub React
test/loader-hooks.mjs           points the schemastery import at the stub in a bare checkout
test/schemastery-stub.mjs       minimal stand-in for @deepseek-ai/schemastery
```

## Development

```sh
npm test
```

`test/host.mjs` loads `index.js` against a fake Cordis context and checks that the section registers, that the ruleset appears only while the switch is on, and that the Host half exposes no command, tool or phrase matching. `test/client.mjs` loads `client.js` against stub browser globals and a stub React, then renders both seats in `zh` and `en`.

Neither test needs DSH, a browser, or `npm install`.

The host test uses the real `@deepseek-ai/schemastery` when it resolves, and `test/schemastery-stub.mjs` when it does not — which is the case in CI, a fresh clone, and any checkout without the profile's packages linked in. Take the stub path on purpose with:

```sh
DSH_ADHD_MODE_STUB=1 npm test
```

### Live-edit install

`file:` installs a copy, so the profile keeps the revision it was installed from. To have the profile read your working tree directly, link it instead:

```sh
dsh plugin --profile web add link:/path/to/dsh-adhd-mode
```

A linked bundle is imported from its own directory, so its bare imports resolve there and not in the profile. Give the checkout a `node_modules` that reaches the harness packages:

```sh
cd /path/to/dsh-adhd-mode
mkdir -p node_modules
ln -sfn ~/.dsh/profiles/web/node_modules/@deepseek-ai node_modules/@deepseek-ai
```

Without it the row installs and then fails to import: `Cannot find package '@deepseek-ai/schemastery'`. The link is in `.gitignore`, so a fresh clone has to repeat this once.

`client.js` is not hot-reloaded in every setup; reload the Web UI page after editing it.

Live inspection, from a session inside the harness:

```
cordis_inspect_query host/Config  listConfigs  {"entry":"include:adhd-mode"}
cordis_inspect_query client/Slots listSubTree {"root":"settings.section"}
```

## License

MIT. `skills/adhd-mode/rules.md` and the design it encodes come from [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) by Ayoub Ghriss. Everything else is this project.
