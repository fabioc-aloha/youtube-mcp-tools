# Release & Product TODO

## 2.1.0 release

- [x] Recover npm package-owner account access.
- [ ] Confirm npm trusted publishing is configured for `fabioc-aloha/youtube-mcp-tools`, or configure the repository `NPM_TOKEN` secret.
- [ ] Create immutable Git tag `v2.1.0` from the stable 2.1.0 commit.
- [ ] Run **Publish release** in GitHub Actions with version `2.1.0`.
- [ ] Verify `youtube-mcp-tools@2.1.0` is publicly available on npm.
- [ ] Verify `io.github.fabioc-aloha/youtube-mcp-tools` version `2.1.0` is listed in the MCP Registry.
- [ ] Verify the published package starts successfully through `npx -y youtube-mcp-tools@2.1.0`.

## Existing ecosystem updates

- [ ] Verify the VS Code extension still works with the 2.1.0 server.
- [ ] Update `youtube-research@alex-mall` when the Mall package is ready for 2.1.0.
- [ ] Install/update the Mall plugin and verify the `youtube` MCP server starts successfully.
- [ ] Update `ACT_Skills_for_Scout` only after Scout compatibility review/canary.

## Product evolution

### Segment intelligence

- [x] Add reusable transcript segment schema and primitive.
- [x] Add timestamped deep links and evidence.
- [x] Add regression coverage.
- [ ] Validate segment quality against real-world transcripts.
- [ ] Improve semantic relevance ranking.
- [ ] Improve section boundary detection and reduce overlapping windows.

### Collection intelligence

- [ ] Improve candidate diversity.
- [ ] Add redundancy / near-duplicate reduction.
- [ ] Improve coverage optimization.
- [ ] Identify complementary sources.
- [ ] Identify meaningful disagreements / alternative approaches.
- [ ] Generate recommended viewing sequences.

### Discovery

- [ ] Improve objective-driven discovery.
- [ ] Support multi-query candidate generation.
- [ ] Improve freshness handling.
- [ ] Preserve search provenance.
