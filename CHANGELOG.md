# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `scripts/release.mjs` and `npm run release -- patch|minor|major`: bumps `package.json`, freezes the `[Unreleased]` entries into a dated section, rewrites the link references, runs the tests, and commits and pushes the tag in one step.
- `.github/workflows/release.yml`: a pushed `vX.Y.Z` tag is checked against `package.json` and `CHANGELOG.md`, the tests run, and a GitHub release is published with that changelog section as its notes.
- A `policy` job in CI (`node scripts/release.mjs doctor`) that fails when the version, the latest tag and the changelog disagree.
- A Versions section in both READMEs stating the semantic-versioning policy for this bundle.

## [0.2.0] - 2026-10-11

### Fixed

- The ruleset no longer reaches subagents. The section was registered on the plugin's own context, which is global: every agent the Host assembled a prompt for received it, delegated children included. It is now registered per agent on `agent.ctx`, and skipped for any agent carrying a delegation depth (`origin: 'subagent'`, `header.delegationDepth > 0`, or `options.subagentDepth > 0`). A forked session still gets it — `parentSession` records fork lineage, not delegation.

### Changed

- Renamed the project from `dsh-i-have-adhd` to `dsh-adhd-mode` — that name is unoccupied on npm and in the plugin market, whereas the old one belongs to an unrelated plugin. The loader row id, the settings namespace and the bundled ruleset path follow the new name.
- The ruleset's `## Persistence` paragraph no longer tells the reader to say a phrase; it points at the UI switch instead.
- The composer trigger moved from `conversation.composer.dock` to `conversation.input.left`. The shipped composer only renders the dock for `variant === "composer"`, so a dock entry is invisible until the Session holds a conversation; the tool row renders on the new-Session screen too.
- The trigger is now an icon plus the short label `ADHD`, styled like the PUA composer trigger, and it reads the shared icon set from `@deepseek-ai/dsh-client-ui-primitives`.

### Removed

- The daily workflow that synced the ruleset from `ayghri/i-have-adhd`. Upstream changes slowly, and this copy is a fork.

## [0.1.0] - 2026-10-08

### Added

- System-prompt section that injects the upstream ruleset, re-evaluated at every assembly.
- `enabled` volatile config field: the switch, persisted to the profile patch layer.
- Settings page and a composer pill in the Web UI, in English and Chinese.
- Host and client self-tests that run without DSH, a browser, or `npm install`.

### Notes

- The Host half exposes no command, tool, or natural-language matching. The UI switch is the only way to change the mode.

[Unreleased]: https://github.com/letterk/dsh-adhd-mode/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/letterk/dsh-adhd-mode/releases/tag/v0.2.0
[0.1.0]: https://github.com/letterk/dsh-adhd-mode/releases/tag/v0.1.0
