# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/letterk/dsh-adhd-mode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/letterk/dsh-adhd-mode/releases/tag/v0.1.0
