# YouTube MCP Tools

Evidence-first YouTube research for modern MCP hosts and VS Code.

The project consolidates the supported YouTube MCP and extension workflows:

- search YouTube and inspect videos, channels, and playlists;
- retrieve, search, and cite caption transcripts;
- analyze video content and create flashcards;
- research a topic into a transparent, curated video collection;
- turn selected, transcript-backed videos into host-grounded or direct-provider collateral;
- render accessible static HTML resource pages.

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
npm install
npm test
```

## Install in MCP hosts

### Any MCP host

Install the canonical server from npm:

```json
{
  "servers": {
    "youtube": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "youtube-mcp-tools@2.0.0"]
    }
  }
}
```

This is compatible with VS Code's workspace `.vscode/mcp.json` and user
configuration. Transcript tools work with no configuration. To use search,
metadata, analysis, flashcards, or live topic research, add `YOUTUBE_API_KEY`
through your host's secret or environment-variable facility; never commit a
key.

For local development, copy `.env.example` to `.env` (a blank `.env` is already
created in this repository) and set `YOUTUBE_API_KEY`. Create a restricted key
in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
enable **YouTube Data API v3**, then create an API key restricted to that API.
The MCP server loads `.env` from its working directory only when an explicit
environment variable is not already set.

For Claude Code, add the local build with:

```bash
claude mcp add youtube --scope project --env YOUTUBE_API_KEY=your_key -- npx -y youtube-mcp-tools@2.0.0
```

The server also exposes the `youtube_research_to_collateral` MCP prompt for
hosts that support prompts.

### GitHub Copilot CLI through Alex ACT Plugin Mall

For GitHub Copilot CLI, install the optional Mall plugin after registering the
Mall:

```bash
copilot plugin marketplace add fabioc-aloha/Alex_Skill_Mall
copilot plugin install youtube-research@alex-mall
```

The plugin declares the same `youtube` stdio server and uses the exact npm
release. This is a Copilot-specific convenience route; Claude, Cursor, VS
Code, and other MCP hosts should use the standard installation above.

## Marketplace readiness

`server.json` is the official MCP Registry manifest. After publishing the npm
package, publish this manifest with the official
[MCP Registry publisher](https://modelcontextprotocol.io/registry/quickstart).
The package contains the matching `mcpName` ownership marker required by the
registry.

The manual GitHub Actions workflow at
`.github/workflows/publish-release.yml` publishes a pushed `v<version>` tag in
order: npm package, then MCP Registry manifest. Configure either npm trusted
publishing or an `NPM_TOKEN` repository secret; the MCP Registry step uses
GitHub OIDC and needs no dedicated secret. Publish the VS Code companion VSIX
separately through the Visual Studio Marketplace publisher portal.
