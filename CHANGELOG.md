# Changelog

All notable changes to `youtube-mcp-tools` are documented here.

The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. Versions are managed independently from downstream consumers such as Microsoft Scout and VideoScout.

## [Unreleased]

- Release verification for 2.2.0 remains pending public npm/MCP Registry propagation and a live API-backed smoke test.

## [2.2.0] — unreleased

### Added

- Exposed `youtube_find_relevant_segments` as a first-class MCP tool; transcript-backed segment research does not require a YouTube Data API key.
- Added objective-driven multi-query discovery using the research topic plus requested coverage areas.
- Preserved search-query provenance on discovered candidates and collections.
- Added diversity-aware collection selection with source/channel diversity, redundancy reduction, and coverage optimization.
- Added recommended viewing sequences and complementary-source explanations.
- Added conservative comparison opportunities instead of falsely labeling shared coverage as factual disagreement.
- Improved transcript segment ranking with phrase weighting and overlap suppression.
- Added release-oriented CI coverage for the new research behaviors.

### Design

- Research selection remains deterministic and inspectable: scores are derived from observable relevance, coverage, transcript availability, source identity, duration, and recency signals.
- The server distinguishes API-key-free transcript intelligence from API-key-dependent YouTube Data API discovery and metadata operations.
- The implementation avoids claiming semantic disagreement unless the available evidence can support it; current cross-source comparison signals are deliberately conservative.

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

[Unreleased]: https://github.com/fabioc-aloha/youtube-mcp-tools/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.2.0
[2.1.0]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.1.0
[2.0.1]: https://github.com/fabioc-aloha/youtube-mcp-tools/releases/tag/v2.0.1
