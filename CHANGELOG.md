# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-08

### Added

- System-prompt section that injects the upstream ruleset, re-evaluated at every assembly.
- `enabled` volatile config field: the switch, persisted to the profile patch layer.
- Settings page and a composer pill in the Web UI, in English and Chinese.
- Host and client self-tests that run without DSH, a browser, or `npm install`.
- A daily workflow that syncs the ruleset from `ayghri/i-have-adhd`.

### Notes

- The Host half exposes no command, tool, or natural-language matching. The UI switch is the only way to change the mode.

[Unreleased]: https://github.com/letterk/dsh-i-have-adhd/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/letterk/dsh-i-have-adhd/releases/tag/v0.1.0
