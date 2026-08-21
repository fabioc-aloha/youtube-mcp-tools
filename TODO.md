# Release TODO

## Blocked on npm account recovery

- [ ] Complete the npm package-owner account's 2FA reset.
- [ ] Sign in to npm as an owner of `youtube-mcp-tools`.
- [ ] Configure npm trusted publishing for:
  - GitHub owner: `fabioc-aloha`
  - Repository: `youtube-mcp-tools`
  - Workflow: `.github/workflows/publish-release.yml`
- [ ] Alternatively, create an npm automation token and save it as the
  repository's `NPM_TOKEN` GitHub Actions secret.

## Publish 2.0.1

- [ ] In GitHub Actions, run **Publish release** with version `2.0.1`.
- [ ] Verify `youtube-mcp-tools@2.0.1` is publicly available on npm.
- [ ] Verify `io.github.fabioc-aloha/youtube-mcp-tools` version `2.0.1` is
  listed in the MCP Registry.

## Publish companion and Mall update

- [ ] Upload `apps/vscode-extension/youtube-mcp-tools-0.5.3.vsix` through the
  Visual Studio Marketplace publisher portal.
- [ ] Update `youtube-research@alex-mall` to version `1.0.1` so it launches
  `youtube-mcp-tools@2.0.1`.
- [ ] Install or update the Mall plugin and verify the `youtube` MCP server
  starts successfully.
