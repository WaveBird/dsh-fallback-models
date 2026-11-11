# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-11

### Added

- Host `llm/stream` failover engine: ordered fallback routes, safe leading-block hold, cancellation protection, configurable retry budget and skip codes.
- Global configuration page under **Settings → Fallback models**.
- Model selection card switch: off keeps the shipped model page; on shows the per-Session fallback editor.
- Per-Session overrides that follow the global configuration until edited, with a reset-to-global control.
- The first chain entry is selected as the active primary model; switching fallback off restores the model captured before it was enabled.
- Inline fallback glyph on the composer model name while a chain is enabled.
- Bilingual documentation (English / 简体中文), installation and acceptance guide, design notes, MIT license.
- 16 unit tests covering config normalization, streaming failover, prepared dispatch, and client registration.

[1.0.0]: https://github.com/WaveBird/dsh-fallback-models/releases/tag/v1.0.0
