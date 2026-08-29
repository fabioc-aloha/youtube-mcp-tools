# Release & Product TODO

## 2.2.0 release

- [x] Align package, server, and MCP handshake version at 2.2.0.
- [x] Add `youtube_find_relevant_segments` MCP tool without an API-key dependency.
- [x] Improve segment relevance ranking with phrase weighting.
- [x] Reduce overlapping/redundant segment windows.
- [x] Add objective-driven multi-query discovery.
- [x] Preserve search provenance.
- [x] Improve candidate diversity and source/channel balance.
- [x] Add redundancy / near-duplicate reduction.
- [x] Improve coverage optimization.
- [x] Identify complementary sources.
- [x] Add conservative cross-source comparison opportunities without falsely asserting disagreement.
- [x] Generate recommended viewing sequences.
- [x] Add regression coverage for the new research behavior.
- [x] Pass GitHub CI type checking and regression tests.
- [ ] Validate the 2.2.0 package artifact with `npm pack` and a clean local install.
- [ ] Publish `v2.2.0` through npm Trusted Publishing.
- [ ] Verify public npm and MCP Registry propagation outside the Microsoft package proxy.
- [ ] Run a live API-backed smoke test after public package propagation.

## Existing ecosystem updates

- [ ] Verify the VS Code extension still works with the 2.2.0 server.
- [ ] Update `youtube-research@alex-mall` when the Mall package is ready for 2.2.0.
- [ ] Install/update the Mall plugin and verify the `youtube` MCP server starts successfully.
- [ ] Update `ACT_Skills_for_Scout` only after Scout compatibility review/canary.

## Product evolution

The deterministic/evidence-first research-engine backlog is complete for this release. Remaining work is release validation and empirical evaluation, which requires the public package path or live YouTube access.

### Future evaluation

- [ ] Benchmark segment quality against a curated set of real transcripts.
- [ ] Evaluate semantic relevance against human judgments.
- [ ] Evaluate boundary quality and learning-value coverage.
- [ ] Evaluate multi-query discovery recall/precision and quota cost.
- [ ] Evaluate cross-source comparison signals before exposing factual disagreement claims.
