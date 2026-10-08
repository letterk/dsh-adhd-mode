# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-08

### Added

- System-prompt section that injects the upstream ruleset, re-evaluated at every assembly.
- `enabled` volatile config field: a live switch, persisted to the profile patch layer.
- `/adhd on | off | toggle | status`.
- `/i-have-adhd` gesture, plus the stop phrases `stop adhd mode`, `关闭adhd`, and `正常模式`.
- Settings page and a composer pill in the Web UI, in English and Chinese.
- Registration of the ruleset as a user-invocable, non-model-invocable skill.
- Host and client self-tests that run without DSH, a browser, or `npm install`.

[Unreleased]: https://github.com/letterk/dsh-i-have-adhd/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/letterk/dsh-i-have-adhd/releases/tag/v0.1.0
