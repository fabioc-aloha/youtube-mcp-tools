# Changelog

All notable changes to `youtube-mcp-tools` are documented here.

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. Versions are managed independently from downstream consumers such as Microsoft Scout and VideoScout.

## [Unreleased]

### Added

- Added reusable transcript segment intelligence in `src/research/segments.ts`.
- Added `ResearchSegment` and `SegmentResearchBrief` types for timestamped, evidence-linked research segments.
- Added deterministic transcript-window discovery based on research objectives and requested topics.
- Added deep links to relevant video timestamps.
- Added regression coverage for timestamped segment discovery.

### Design

- Segment intelligence is implemented in the canonical shared YouTube MCP so it can benefit VideoScout, Scout, VS Code, and other MCP hosts.
- The initial implementation is intentionally deterministic and evidence-first. Semantic ranking and richer boundary detection remain follow-up work.

## [2.0.1]

See the release history and repository commits for the complete 2.0.1 history.

[Unreleased]: https://github.com/fabioc-aloha/youtube-mcp-tools/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.0.1
