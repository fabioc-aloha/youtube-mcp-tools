# Changelog

All notable changes to `youtube-mcp-tools` are documented here.

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. Versions are managed independently from downstream consumers such as Microsoft Scout and VideoScout.

## [Unreleased]

### Added

- Added MCP tool `youtube_find_relevant_segments` for transcript-backed timestamped segment discovery without a YouTube API key.
- Added collection selection signals for source diversity, redundancy reduction, coverage optimization, complementary sources, search provenance, and recommended viewing order.
- Added comparison opportunities for sources covering the same requested area without incorrectly labeling them as factual disagreements.

### Improved

- Candidate evaluation now preserves the originating search query.
- Research collection selection uses inspectable weighted relevance, coverage, and evidence scores.
- Collateral prompting can incorporate timestamped segment research.

### Validation

- Type checking and the full regression test suite pass on the current `main` commit.
- Release packaging should be validated with `npm pack` and a clean local tarball installation before the next npm publication.

## [2.1.0] — 2026-08-28

### Added

- Added reusable transcript segment intelligence in `src/research/segments.ts`.
- Added `ResearchSegment` and `SegmentResearchBrief` types for timestamped, evidence-linked research segments.
- Added deterministic transcript-window discovery based on research objectives and requested topics.
- Added deep links to relevant video timestamps.
- Added regression coverage for timestamped segment discovery.

### Design

- Segment intelligence is implemented in the canonical shared YouTube MCP so it can benefit VideoScout, Scout, VS Code, and other MCP hosts.
- The initial segment implementation is intentionally deterministic and evidence-first. Semantic ranking and richer boundary detection remain follow-up work.

## [2.0.1]

See the release history and repository commits for the complete 2.0.1 history.

[Unreleased]: https://github.com/fabioc-aloha/youtube-mcp-tools/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.1.0
[2.0.1]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.0.1
