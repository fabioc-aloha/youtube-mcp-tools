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

The current canonical branch is an alpha and is not published to npm yet. Build it
locally with `npm install && npm run build`, then use this executable:

```json
{
  "servers": {
    "youtube": {
      "command": "node",
      "args": ["C:\\Development\\youtube-mcp-tools\\dist\\mcp-server\\index.js"],
      "env": {
        "YOUTUBE_API_KEY": "${input:youtube-api-key}"
      }
    }
  }
}
```

This is compatible with VS Code's workspace `.vscode/mcp.json` and user
configuration. After the `2.0.0` npm release, use `npx -y youtube-mcp-tools`
instead of the local `node` command. Do not commit API keys; use a host input
variable or environment file.

For Claude Code, add the local build with:

```bash
claude mcp add youtube --scope project --env YOUTUBE_API_KEY=your_key -- node dist/mcp-server/index.js
```

The server also exposes the `youtube_research_to_collateral` MCP prompt for
hosts that support prompts.

## Marketplace readiness

`server.json` is the official MCP Registry manifest. Once the stable npm package
is published, validate and publish it with `mcp-publisher`; downstream
marketplaces can then consume the same verified registry metadata. The package
contains the matching `mcpName` ownership marker required by the registry.
