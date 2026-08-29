# YouTube MCP Tools

Evidence-first YouTube research for modern MCP hosts and VS Code.

The project consolidates the supported YouTube MCP and extension workflows:

- search YouTube and inspect videos, channels, and playlists;
- retrieve, search, and cite caption transcripts;
- find timestamped transcript segments relevant to a research objective;
- analyze video content and create flashcards;
- research a topic into a transparent, curated video collection;
- turn selected, transcript-backed videos into host-grounded or direct-provider collateral;
- render accessible static HTML resource pages.

## MCP tools

| Tool | What it does | YouTube API key? | Key dependency |
|---|---|---:|---|
| `youtube_search` | Search YouTube for public videos | Yes | YouTube Data API v3 |
| `youtube_get_video_details` | Retrieve video metadata, duration, tags, captions, and engagement metadata | Yes | YouTube Data API v3 |
| `youtube_get_transcript` | Retrieve a video's caption transcript with timestamps | No | `youtube-transcript` |
| `youtube_search_transcript` | Search a transcript for terms or regex and return timestamped matches | No | `youtube-transcript` + Node worker threads |
| `youtube_find_relevant_segments` | Find transcript sections relevant to a research objective, with evidence and timestamp links | No | `youtube-transcript` + local research ranking |
| `youtube_analyze_video` | Analyze a video and its transcript for summary, concepts, and observable signals | Yes | YouTube Data API v3 + transcript |
| `youtube_generate_flashcards` | Generate study flashcards from video concepts and key points | Yes | YouTube Data API v3 + transcript |
| `youtube_quota_status` | Report process/API quota state | No | Local quota tracking |
| `youtube_research_topic` | Discover, inspect, score, diversify, and curate videos for a research objective | Yes | YouTube Data API v3 + transcript + research selector |
| `youtube_build_collateral_prompt` | Build an evidence- and citation-constrained prompt for a host model | No | Local research/collateral logic |
| `youtube_generate_collateral` | Generate transcript-grounded collateral through a configured provider | Provider-dependent | Configured direct provider adapter |
| `youtube_render_resource_page` | Render reviewed research and collateral as an accessible standalone HTML page | No | Local HTML renderer |

The server also exposes the `youtube_research_to_collateral` MCP prompt for hosts that support MCP prompts.

### Capability layers

The server has a deliberate API-key boundary:

**No API key required** — transcript retrieval, transcript search, timestamped segment intelligence, research/collateral prompt construction, resource rendering, and local quota state.

**YouTube API key required** — YouTube discovery, authoritative video metadata, video analysis, flashcards, and live topic research.

This allows transcript-backed intelligence to work in constrained environments while keeping YouTube Data API operations explicit.

## Evidence-first collateral

The research workflow does not treat popularity or a hidden score as proof of quality.
Each selected video carries explicit evidence for topic relevance, requested coverage,
transcript availability, source identity, practical duration, and optional recency. The
output includes selections, exclusions, and a verification date.

Collateral supports two intentional modes:

1. **Host-managed generation** returns a source-constrained prompt for Copilot, Claude,
   or another MCP host to write original articles, summaries, or study guides.
2. **Direct-provider generation** calls an explicitly configured provider through a
   small adapter interface. No provider credential or network integration is embedded
   in the core.

Both modes require timestamp citations to selected source videos and instruct the
writer to paraphrase rather than reproduce transcript language.

## Reference integration

`defensibleDecisionDashboardBrief` defines the first editorial profile: a
decision-ready Power BI dashboard guide for *The Defensible Decision*. It will produce
a curated video page and a companion study guide for the book's `/resources/` section.

The reader-facing guide is published at
[Power BI Video Guide: From First Report to Defensible Decision](https://www.thedefensibledecision.com/resources/power-bi-learning-path/).
It pairs selected Power BI tutorials with the book's question-first sequence for
building and reviewing a report.

## VS Code extension

The maintained Marketplace extension source is in
[`apps/vscode-extension`](apps/vscode-extension). It retains the published
`fabioc-aloha.youtube-mcp-tools` extension identifier and its existing search,
analysis, transcript, flashcard, quota, and Activity Bar workflows. Its bundled
MCP executable is built from this canonical server, so extension updates carry
the same modern host integration as the npm distribution.

## Development

```powershell
npm ci
npm test
```

## Install in MCP hosts

### Local source installation

Build and run the server directly from a local checkout:

```powershell
npm ci
Copy-Item .env.example .env
# Set YOUTUBE_API_KEY in .env when you need YouTube Data API features.
npm test
```

`npm test` builds the MCP executable at `dist/mcp-server/index.js`. Then add
this server entry to an MCP host:

```json
{
  "servers": {
    "youtube": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\youtube-mcp-tools\\dist\\mcp-server\\index.js"]
    }
  }
}
```

The checkout includes the equivalent workspace configuration in
`.vscode/mcp.json`; open the repository folder in VS Code to use it. Transcript
tools work with no configuration. To use search, metadata, analysis,
flashcards, or live topic research, add `YOUTUBE_API_KEY` through your host's
secret or environment-variable facility. `.env` is ignored by Git; never
commit a key.

### npm package

Use the published `youtube-mcp-tools@2.1.0` package without maintaining a
checkout:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "youtube-mcp-tools@2.1.0"]
}
```

### Get a YouTube Data API key

Transcript retrieval and transcript search do not require a Google API key.
You need a key for YouTube search, video metadata, analysis, flashcards, and
live topic research.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or
   select a project.
2. Open **APIs & Services** → **Library**, search for **YouTube Data API v3**,
   and enable it for that project.
3. Open **APIs & Services** → **Credentials** → **Create credentials** →
   **API key**.
4. Restrict the key's **API restrictions** to **YouTube Data API v3**. If the
   server runs from a stable egress address, also use an IP-address application
   restriction. Do not use a browser-referrer restriction for this local stdio
   server.
5. Store the key only in your MCP host's secret or environment-variable
   facility. For local development, copy `.env.example` to `.env`; `.env` is
   ignored by Git. The server loads it only when `YOUTUBE_API_KEY` is not
   already defined in the environment.

Never paste a key into an issue, source file, committed configuration, or a
prompt. If a key is exposed, delete or rotate it in Google Cloud Console.

For Claude Code, add the local build with:

```bash
claude mcp add youtube --scope project --env YOUTUBE_API_KEY=your_key -- node dist/mcp-server/index.js
```

The server also exposes the `youtube_research_to_collateral` MCP prompt for
hosts that support prompts.

### GitHub Copilot CLI through Alex ACT Plugin Mall

GitHub Copilot CLI users can install the optional Mall plugin:

```bash
copilot plugin marketplace add fabioc-aloha/Alex_Skill_Mall
copilot plugin install youtube-research@alex-mall
```

The plugin declares the same `youtube` stdio server and uses the exact npm
release. This is a Copilot-specific convenience route; Claude, Cursor, VS
Code, and other MCP hosts should use the standard installation above.

## Marketplace readiness

`server.json` is the official MCP Registry manifest. The package contains the
matching `mcpName` ownership marker required by the registry.

The manual GitHub Actions workflow at
`.github/workflows/publish-release.yml` publishes a pushed `v<version>` tag in
order: npm package, then MCP Registry manifest. It uses npm trusted publishing
and GitHub OIDC for the Registry; no repository secrets are required. Publish
the VS Code companion VSIX separately through the Visual Studio Marketplace
publisher portal.
