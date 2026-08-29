# Release & Product TODO

## 2.1.0 release

- [x] Recover npm package-owner account access.
- [x] Configure npm Trusted Publishing for `fabioc-aloha/youtube-mcp-tools`.
- [x] Create immutable Git tag `v2.1.0` from the stable 2.1.0 commit.
- [x] Run **Publish release** in GitHub Actions with version `2.1.0`.
- [x] Confirm the GitHub release workflow completed successfully.
- [ ] Verify `youtube-mcp-tools@2.1.0` is publicly available on npm from a non-Corpnet network.
- [ ] Verify `io.github.fabioc-aloha/youtube-mcp-tools` version `2.1.0` is listed in the MCP Registry.
- [ ] Verify the published package starts successfully through `npx -y youtube-mcp-tools@2.1.0` from a non-Corpnet network.

## 2.2.0 development

### Segment intelligence

- [x] Add reusable transcript segment schema and primitive.
- [x] Add timestamped deep links and evidence.
- [x] Add regression coverage.
- [x] Expose segment intelligence as `youtube_find_relevant_segments` MCP tool.
- [ ] Validate segment quality against real-world transcripts.
- [ ] Improve semantic relevance ranking.
- [ ] Improve section boundary detection and reduce overlapping windows.

### Collection intelligence

- [x] Improve candidate diversity.
- [x] Add redundancy / near-duplicate reduction.
- [x] Improve coverage optimization.
- [x] Identify complementary sources.
- [ ] Identify meaningful disagreements / alternative approaches from transcript evidence.
- [x] Generate recommended viewing sequences.
- [x] Preserve search provenance on candidates and collections.

### Discovery

- [ ] Improve objective-driven discovery.
- [ ] Support multi-query candidate generation.
- [ ] Improve freshness handling.

### Release validation

- [x] Keep package, registry manifest, and MCP handshake versions aligned.
- [x] Pass TypeScript validation and regression suite on `main`.
- [ ] Run `npm pack` for the 2.2.0 package candidate.
- [ ] Install the tarball in a clean project and start the MCP server.
- [ ] Publish 2.2.0 through Trusted Publishing after release candidate validation.

## Existing ecosystem updates

- [ ] Verify the VS Code extension still works with the current server.
- [ ] Update `youtube-research@alex-mall` when the Mall package is ready for the current server.
- [ ] Install/update the Mall plugin and verify the `youtube` MCP server starts successfully.
- [ ] Update `ACT_Skills_for_Scout` only after Scout compatibility review/canary.
