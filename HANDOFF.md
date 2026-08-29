# 2.1.0 Release and Local Installation Handoff

## Current state

- The canonical repository is public:
  <https://github.com/fabioc-aloha/youtube-mcp-tools>.
- The root package, MCP Registry manifest, and MCP handshake version are
  aligned at `2.1.0`.
- The local source installation has been completed with `npm ci` and `npm test`.
  The built stdio executable is `dist/mcp-server/index.js`, and
  `.vscode/mcp.json` runs that executable from the repository folder.
- A local `.env` holds `YOUTUBE_API_KEY` for Data API features. It is ignored
  by Git and must never be committed. Transcript tools remain usable without a
  key.
- npm publication was initiated on 2026-08-28. Verify public availability
  outside the current corporate npm proxy, which may not surface the version
  for up to seven days.
- The MCP Registry record, `v2.1.0` tag, VS Code Marketplace companion
  release, and Alex ACT Mall publication should each be independently
  confirmed before announcing the release.

## Local source installation

```powershell
npm ci
Copy-Item .env.example .env
# Set YOUTUBE_API_KEY in .env when Data API tools are needed.
npm test
```

For VS Code, open this repository folder. Its `.vscode/mcp.json` registers a
`youtube` stdio server using the local build. Other MCP hosts can run:

```json
{
  "type": "stdio",
  "command": "node",
  "args": ["C:\\absolute\\path\\to\\youtube-mcp-tools\\dist\\mcp-server\\index.js"]
}
```

## Remaining release checks

1. Confirm `youtube-mcp-tools@2.1.0` is publicly available from an npm
   registry that is not subject to the current proxy delay.
2. Create and verify the immutable `v2.1.0` tag if it is still absent.
3. Confirm `io.github.fabioc-aloha/youtube-mcp-tools` version `2.1.0` appears
   in the MCP Registry.
4. Publish the VS Code companion version `0.5.3` separately through the
   Visual Studio Marketplace publisher portal.
5. Vendor `apps/copilot-plugin` into Alex ACT Mall and verify it launches
   `youtube-mcp-tools@2.1.0`.
