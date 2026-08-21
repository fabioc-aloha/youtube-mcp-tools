# Release Handoff

## Current state

- The canonical repository is public:
  <https://github.com/fabioc-aloha/youtube-mcp-tools>.
- The production server release is tagged `v2.0.1`.
- The npm package `youtube-mcp-tools@2.0.1` is **not yet published**.
- The MCP Registry record is **not yet published**.
- The VS Code Marketplace currently has `0.5.1`; the prepared security and
  reliability update is `0.5.3`.
- The Alex ACT Mall currently contains `youtube-research@alex-mall` `1.0.0`.
  Update it to `1.0.1` after npm publishes `2.0.1`.

## Blocking issue

The npm package-owner account requires a 2FA reset. Do not attempt local npm
publication until account access is restored. Do not commit or paste npm
tokens, recovery codes, API keys, proxy credentials, or `.env` files.

## Completed production work

- Fixed classic and srv3 transcript timestamp normalization.
- Moved regex transcript matching into a resource-limited worker with a 250 ms
  timeout.
- Restored no-key transcript commands in the VS Code companion.
- Migrated legacy plaintext VS Code API-key settings into SecretStorage and
  clears all legacy setting scopes.
- Hardened the GitHub release workflow with idempotent npm publication and a
  pinned, SHA-256-verified MCP Registry publisher binary.
- Enabled GitHub secret scanning, push protection, and Dependabot security
  updates.
- Resolved all npm audit findings in both the root production dependencies and
  the VS Code extension development dependency graph.

## Verification completed

```powershell
# Canonical server
npm test
npm audit --omit=dev

# VS Code companion
Push-Location apps\vscode-extension
npm test
npm audit
Pop-Location
```

Both test suites and both audits passed with zero reported vulnerabilities.

## Release artifacts

| Artifact | Version | Location / release route |
| --- | --- | --- |
| npm package | `2.0.1` | Publish through GitHub Actions after npm access is restored |
| MCP Registry entry | `2.0.1` | Published by the same GitHub Actions workflow after npm succeeds |
| VS Code companion | `0.5.3` | `apps\vscode-extension\youtube-mcp-tools-0.5.3.vsix`; upload manually in the Visual Studio Marketplace publisher portal |
| Alex ACT Mall plugin | `1.0.1` pending | Update after npm package publication |

## Resume steps

1. Complete npm 2FA recovery and sign in as a package owner.
2. Configure npm trusted publishing for:
   - GitHub owner: `fabioc-aloha`
   - Repository: `youtube-mcp-tools`
   - Workflow: `.github/workflows/publish-release.yml`
3. Run **Publish release** in GitHub Actions with version `2.0.1`.
4. Verify:
   - <https://www.npmjs.com/package/youtube-mcp-tools>
   - `io.github.fabioc-aloha/youtube-mcp-tools` version `2.0.1` in the MCP
     Registry.
5. Upload the `0.5.3` VSIX through the Marketplace publisher portal.
6. Update the Mall plugin from `apps\copilot-plugin`:

   ```powershell
   Push-Location C:\Development\Alex_ACT_Plugin_Mall
   npm run vendor -- --source C:\Development\youtube-mcp-tools\apps\copilot-plugin --category media-graphics --repository https://github.com/fabioc-aloha/youtube-mcp-tools --ref v2.0.1 --submitted-by @fabioc-aloha --evidence "Canonical YouTube MCP 2.0.1 release with validated npm, MCP Registry, and VS Code companion distribution." --replace --apply
   npm run submit:validate -- --plugin media-graphics/youtube-research
   npm run maintain -- --curated
   ```

7. Review, commit, and push the Mall changes. Confirm the plugin launches
   `youtube-mcp-tools@2.0.1`.
