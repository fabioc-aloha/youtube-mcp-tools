# Changelog

All notable changes to **YouTube MCP Tools** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-08-20

### Fixed

- Restored Marketplace banner and CorreaX logo rendering by using immutable
  public asset URLs. The canonical source repository is private, so the
  Marketplace cannot fetch its raw GitHub media assets.

## [0.5.0] - 2026-08-20

### Changed

- Repositioned the Marketplace extension as an optional VS Code companion to
  the canonical `youtube-mcp-tools@2.0.0` MCP server.
- Updated MCP-host installation examples to launch the released npm package
  through `npx`, rather than refer to development-only bundle paths.
- Bundled the canonical 2.0 MCP server with the companion VSIX so the
  extension's UI and server capabilities share the current implementation.

## [0.4.0] - 2026-04-29

End-user focused release. The previous transcript scraper was broken against
modern YouTube. The MCP server demanded an API key before it would even
start. Both fixed; new tools added for the cases that actually matter.

### Added

- **`youtube_get_transcript`** — works **without an API key**. Returns a
  Markdown transcript with deep-link timestamps (`[03:42](https://youtu.be/X?t=222)`),
  so AI clients can cite specific moments and users can click to jump to
  them. Three formats: `markdown` (default), `plain`, `segments` (raw JSON).
- **`youtube_search_transcript`** — works **without an API key**. Find every
  moment in a video that matches a substring or regex; returns timestamps
  and deep-link URLs with optional surrounding context. Solves "where in
  this 2-hour podcast did they mention X?" without dumping the whole
  transcript into an LLM's context window.
- **URL parsing everywhere.** All `video` arguments now accept bare 11-char
  IDs *or* `youtu.be/…`, `youtube.com/watch?v=…`, `youtube.com/shorts/…`,
  `youtube.com/live/…`, `youtube.com/embed/…`. End-users paste URLs.
- **Filesystem transcript cache.** Transcripts are immutable; we now cache
  them on disk at `$YOUTUBE_MCP_CACHE_DIR` or
  `~/.cache/youtube-mcp-tools/transcripts/`. Disable with
  `YOUTUBE_MCP_NO_CACHE=1`.

### Changed

- **Transcript backend swapped.** The home-grown HTML scraper was returning
  empty results because YouTube changed their player config and timedtext
  endpoint authentication. We now use the
  [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript)
  npm package which tracks those upstream changes for us.
- **MCP server no longer fails fast on missing `YOUTUBE_API_KEY`.** It boots
  with a clear stderr note and exposes the no-key tools immediately;
  key-requiring tools return a friendly error if called without one.
- **Tool descriptions** now mark "**No API key needed**" or
  "**Requires `YOUTUBE_API_KEY`**" up front so LLM clients can pick the
  right tool first try.

### Removed

- The old `fetchPage` / `extractCaptionUrl` / `parseTranscriptXml` helpers
  in `YouTubeCore`. Transcript fetching is delegated to the
  `youtube-transcript` package; the regex-based scraper was a maintenance
  burden and didn't work.

### Notes

- Existing tools (`youtube_search`, `youtube_get_video_details`,
  `youtube_analyze_video`, `youtube_generate_flashcards`) continue to work
  unchanged with an API key.
- The VS Code extension UI is unchanged.

## [0.3.0] - 2026-04-29

### Added

- **Real MCP server** — `dist/mcp-server.js`, a standalone Model Context
  Protocol server (stdio transport) usable from any MCP-aware client (VS Code
  Agent Mode, Claude Desktop, Cursor, custom agents). Exposes 6 tools:
  `youtube_search`, `youtube_get_video_details`, `youtube_get_transcript`,
  `youtube_analyze_video`, `youtube_generate_flashcards`,
  `youtube_quota_status`. Reads `YOUTUBE_API_KEY` from the environment.
- **`youtube-mcp-server` bin entry** in `package.json` so the server can be
  invoked via `npx youtube-mcp-server` once published.
- **CI workflow** (`.github/workflows/ci.yml`) — lint, type-check, production
  build of both bundles, fail-fast smoke test of the MCP server, and VSIX
  artifact upload on every push and PR.

### Changed

- **Internal rename** — extension-side `YouTubeMcpClient` is now
  `YouTubeApiClient`. The old name lied: it never spoke MCP. The actual MCP
  server is the new `src/mcp-server/index.ts`. A deprecated alias keeps the
  old name working through 0.3.x; it will be removed in 0.4.0.
- **Architecture split** — domain logic moved into vscode-free `YouTubeCore`
  (`src/services/youtubeCore.ts`); `YouTubeService` is now a thin VS Code
  wrapper handling SecretStorage, settings, and `.env` loading. The MCP
  server reuses `YouTubeCore` directly.
- **`tsconfig`** — added `DOM` lib (for `HeadersInit`) and `skipLibCheck`
  (works around an SDK CJS/ESM type-import quirk under `Node16` resolution).

### Removed

- **Opaque "quality assessment" 0–100 scores** (`overall`, `clarity`, `depth`,
  `structure`, `engagement`). The formula was undocumented and the precision
  was unjustified. Replaced with **measurable quality signals**:
  `hasCaptions`, `wordCount`, `avgSentenceLength`, `engagementRatio`,
  `transcriptSegmentCount`. Consumers can now interpret the signals
  themselves rather than trust a hidden weighting.

### Notes

- The VS Code extension UI (`Search`, `Analyze Video`, `Get Transcript`,
  `Generate Flashcards`, `Show Quota`) is unchanged and continues to work
  exactly as before. The MCP server is additive.
- Anki `.apkg` export and an npm publish handshake for the standalone server
  are scoped for 0.4.0.

## [0.2.1] - 2026-02-27

### Changed

- 🎨 **New Banner** - AI-generated minimalist banner using Ideogram v2
- 📦 Updated dependencies to latest versions

## [0.2.0] - 2026-02-27

### Added

- 🔐 **Secure API Key Storage** - API keys now stored in VS Code SecretStorage (encrypted)
- ⌨️ **Keyboard Shortcuts** - Quick access to all commands:
  - `Ctrl+Shift+Y S` - Search YouTube
  - `Ctrl+Shift+Y A` - Analyze Video
  - `Ctrl+Shift+Y T` - Get Transcript
  - `Ctrl+Shift+Y F` - Generate Flashcards
- 🔑 **Set API Key Command** - New `YouTube MCP: Set API Key` command with validation
- 🔄 **Rate Limiting** - Automatic request throttling (10 req/sec max)
- 🔁 **Exponential Backoff** - Automatic retry with backoff for failed requests
- 💾 **Quota Persistence** - API quota now persists across VS Code sessions
- ⚠️ **Quota Warnings** - Visual warnings when approaching daily API limit (80%+)
- 🧪 **Comprehensive Tests** - 36 unit tests covering all core functionality

### Changed

- 🛡️ **Stronger Type Safety** - Eliminated all `any` types, full TypeScript strict mode
- 📏 **Stricter ESLint** - Added rules for explicit return types, no-explicit-any, unused vars
- 🏗️ **Improved Architecture** - Better separation of concerns in service layer
- 📝 **Better Error Messages** - More actionable error messages throughout

### Security

- API keys migrated from plain settings to encrypted SecretStorage
- Added API key validation before storage
- Rate limiting prevents accidental quota exhaustion

### Technical

- Full TypeScript strict mode compliance
- Proper API response type interfaces
- HTTP retry logic with exponential backoff
- Session-persistent quota tracking

## [0.1.1] - 2026-01-27

### Changed

- 📚 Polished documentation (README, CHANGELOG, SUPPORT)
- ✨ Added dynamic marketplace badges (Version, Installs, Rating)
- 📦 Added `author`, `pricing`, and `qna` fields to package manifest
- 🎨 Improved table formatting throughout documentation
- 📋 Added SUPPORT.md with troubleshooting guide and FAQ

## [0.1.0] - 2026-01-27

### Added

- 🔍 **YouTube Search** - Search videos directly from VS Code with configurable results
- 📊 **Video Analysis** - Get AI-powered summaries, key concepts, and quality assessments
- 📝 **Transcript Extraction** - Extract timestamped transcripts from any video with captions
- 🎴 **Flashcard Generation** - Automatically create study flashcards from video content
- 📈 **Quota Monitoring** - Track YouTube API usage in real-time
- ⚙️ **Flexible Configuration** - Support for API key via VS Code settings or `.env` file
- 🎯 **Activity Bar Views** - Dedicated views for Search Results, Recent Videos, and Flashcards
- 📊 **Status Bar** - Quick indicator showing extension state

### Technical

- Zero external runtime dependencies
- Self-sufficient architecture (no MCP server required)
- Direct YouTube Data API v3 integration
- Native HTTPS implementation for maximum compatibility
