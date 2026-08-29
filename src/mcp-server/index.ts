import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadLocalEnvironment } from '../config/local-env.js';
import { SERVER_VERSION } from '../version.js';
import { registerSegmentTools } from './segment-tools.js';
import {
    buildHostGenerationPrompt,
    createDirectProviderFromEnvironment,
    generateWithDirectProvider,
    renderResourcePage,
    selectResearchCollection,
    type CollateralBrief,
    type ResearchCollection,
    type VideoCandidate,
    type VideoTranscript,
    YouTubeCore,
} from '../index.js';

const SERVER_NAME = 'youtube-mcp-tools';
const environmentFile = loadLocalEnvironment(process.cwd());
const apiKey = process.env.YOUTUBE_API_KEY ?? '';
const core = new YouTubeCore(apiKey, log);

export function createServer(): McpServer {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerSegmentTools(server, core);

    server.registerTool('youtube_search', { title: 'YouTube Search', description: 'Search YouTube for public videos. Requires YOUTUBE_API_KEY.', inputSchema: { query: z.string().min(1).max(512), maxResults: z.number().int().min(1).max(50).default(10) } }, async ({ query, maxResults }) => json(await requireApiKey('youtube_search').search(query, maxResults)));
    server.registerTool('youtube_get_video_details', { title: 'YouTube Video Details', description: 'Get public metadata, duration, tags, caption availability, and engagement counts. Requires YOUTUBE_API_KEY.', inputSchema: { video: z.string().min(1) } }, async ({ video }) => json(await requireApiKey('youtube_get_video_details').getVideoDetails(YouTubeCore.extractVideoId(video))));
    server.registerTool('youtube_get_transcript', { title: 'YouTube Transcript', description: 'Get a public caption transcript with timestamp deep links. Does not require a YouTube API key.', inputSchema: { video: z.string().min(1), format: z.enum(['markdown', 'plain', 'segments']).default('markdown') } }, async ({ video, format }) => {
        const videoId = YouTubeCore.extractVideoId(video);
        if (format === 'segments') return json(await core.getTranscript(videoId));
        return text(format === 'markdown' ? await core.getMarkdownTranscript(videoId) : await core.getFormattedTranscript(videoId));
    });
    server.registerTool('youtube_search_transcript', { title: 'YouTube Transcript Search', description: 'Find timestamped mentions inside a public caption transcript. Does not require a YouTube API key.', inputSchema: { video: z.string().min(1), query: z.string().min(1).max(512), regex: z.boolean().default(false), contextSeconds: z.number().int().min(0).max(120).default(10), maxMatches: z.number().int().min(1).max(200).default(25) } }, async ({ video, query, regex, contextSeconds, maxMatches }) => json({ videoId: YouTubeCore.extractVideoId(video), query, results: await core.searchTranscript(YouTubeCore.extractVideoId(video), query, { regex, contextSeconds, maxMatches }) }));
    server.registerTool('youtube_analyze_video', { title: 'YouTube Video Analysis', description: 'Create a transparent metadata and transcript analysis with summary, concepts, and observable quality signals. Requires YOUTUBE_API_KEY.', inputSchema: { video: z.string().min(1) } }, async ({ video }) => json(await requireApiKey('youtube_analyze_video').analyzeVideo(YouTubeCore.extractVideoId(video))));
    server.registerTool('youtube_generate_flashcards', { title: 'YouTube Flashcards', description: 'Generate study flashcards from video concepts and key points. Requires YOUTUBE_API_KEY.', inputSchema: { video: z.string().min(1) } }, async ({ video }) => json(await requireApiKey('youtube_generate_flashcards').generateFlashcards(YouTubeCore.extractVideoId(video))));
    server.registerTool('youtube_quota_status', { title: 'YouTube API Quota Status', description: 'Report the current server process YouTube Data API quota usage.', inputSchema: {} }, async () => json(core.getQuotaStatus()));
    server.registerTool('youtube_research_topic', { title: 'Curate YouTube Research', description: 'Search YouTube with multiple objective-driven queries, inspect candidates, caption-check, and transparently curate a diverse research collection. Requires YOUTUBE_API_KEY.', inputSchema: { topic: z.string().min(1), audience: z.string().min(1), requiredCoverage: z.array(z.string().min(1)).min(1), maxSelections: z.number().int().min(1).max(12).default(6), candidateLimit: z.number().int().min(1).max(25).default(12), recencyTargetYears: z.number().min(0).max(20).optional() } }, async (input) => json(await researchTopic(input)));
    server.registerTool('youtube_build_collateral_prompt', { title: 'Build Grounded Collateral Prompt', description: 'Build a host-model prompt for an article, summary, or study guide based only on a prior youtube_research_topic result and timestamp-cited claims.', inputSchema: collateralInputSchema }, async (input) => { const { collection, brief } = parseCollateralInput(input); return json(buildHostGenerationPrompt(collection, brief)); });
    server.registerTool('youtube_generate_collateral', { title: 'Generate Grounded Collateral', description: 'Use an explicitly configured direct provider to create transcript-grounded collateral. Set YOUTUBE_MCP_DIRECT_PROVIDER=openai-compatible and its API configuration first.', inputSchema: collateralInputSchema }, async (input) => { const provider = createDirectProviderFromEnvironment(); if (!provider) return errorResult('Direct generation is not configured. Use youtube_build_collateral_prompt for host-managed writing, or set YOUTUBE_MCP_DIRECT_PROVIDER=openai-compatible with YOUTUBE_MCP_DIRECT_API_KEY.'); const { collection, brief } = parseCollateralInput(input); return json(await generateWithDirectProvider(provider, collection, brief)); });
    server.registerTool('youtube_render_resource_page', { title: 'Render YouTube Resource Page', description: 'Render reviewed collateral and a research collection as a standalone, accessible HTML resource page.', inputSchema: { researchCollection: z.string().min(1), collateralDocument: z.string().min(1) } }, async ({ researchCollection, collateralDocument }) => text(renderResourcePage(JSON.parse(researchCollection) as ResearchCollection, JSON.parse(collateralDocument))));
    server.registerPrompt('youtube_research_to_collateral', { title: 'YouTube Research to Collateral', description: 'Guide a host through evidence-first video research, source-grounded writing, and HTML resource-page creation.', argsSchema: { topic: z.string().min(1), audience: z.string().min(1), collateralKind: z.enum(['article', 'study-guide', 'summary']).default('study-guide') } }, ({ topic, audience, collateralKind }) => ({ messages: [{ role: 'user', content: { type: 'text', text: [`Research "${topic}" for ${audience}, then create a ${collateralKind}.`, '1. Call youtube_research_topic with explicit coverage areas and inspect both selected and excluded videos.', '2. Use youtube_search_transcript or youtube_find_relevant_segments on selected videos to collect timestamped evidence for each proposed substantive claim.', '3. Call youtube_build_collateral_prompt with only selected-video citations.', '4. Write original, paraphrased collateral. Do not invent claims or reproduce long transcript passages.', '5. Review the collateral, then call youtube_render_resource_page with the research collection and reviewed collateral JSON.'].join('\n') } }] }));
    return server;
}

const collateralInputSchema = { researchCollection: z.string().min(1), kind: z.enum(['article', 'study-guide', 'summary']), title: z.string().min(1), audience: z.string().min(1), learningObjectives: z.array(z.string().min(1)).default([]), claims: z.array(z.object({ claim: z.string().min(1), citations: z.array(z.object({ videoId: z.string().min(1), timestampSeconds: z.number().min(0), rationale: z.string().min(1) })).min(1) })).min(1) };

function buildResearchQueries(topic: string, requiredCoverage: string[]): string[] {
    const coverageQueries = requiredCoverage.slice(0, 3).map((area) => `${topic} ${area}`);
    return [...new Set([topic, ...coverageQueries])].slice(0, 4);
}

async function researchTopic(input: { topic: string; audience: string; requiredCoverage: string[]; maxSelections: number; candidateLimit: number; recencyTargetYears?: number }): Promise<ResearchCollection> {
    const keyedCore = requireApiKey('youtube_research_topic');
    const queries = buildResearchQueries(input.topic, input.requiredCoverage);
    const perQueryLimit = Math.max(1, Math.ceil(input.candidateLimit / queries.length));
    const batches = await Promise.all(queries.map(async (query) => keyedCore.search(query, perQueryLimit)));
    const seen = new Set<string>();
    const results = batches.flatMap((items) => items.map((item) => ({ item, query: queries.find((query) => batches.some((batch) => batch.includes(item) && query)) ?? input.topic }))).filter(({ item }) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
    const candidates = await Promise.all(results.slice(0, input.candidateLimit).map(async ({ item, query }): Promise<VideoCandidate> => {
        const details = await keyedCore.getVideoDetails(item.id);
        const transcript = await tryGetTranscript(item.id);
        return { id: item.id, url: `https://youtu.be/${item.id}`, title: details.title || item.title, channel: details.channelTitle || item.channelTitle, publishedAt: details.publishedAt || item.publishedAt, durationSeconds: parseIsoDuration(details.duration), transcript: transcript?.fullText, tags: details.tags, viewCount: details.viewCount, likeCount: details.likeCount, searchQuery: query };
    }));
    return selectResearchCollection({ topic: input.topic, audience: input.audience, requiredCoverage: input.requiredCoverage, maxSelections: input.maxSelections, asOf: new Date().toISOString(), recencyTargetYears: input.recencyTargetYears }, candidates);
}

function parseCollateralInput(input: { researchCollection: string; kind: CollateralBrief['kind']; title: string; audience: string; learningObjectives: string[]; claims: CollateralBrief['claims'] }): { collection: ResearchCollection; brief: CollateralBrief } { return { collection: JSON.parse(input.researchCollection) as ResearchCollection, brief: { kind: input.kind, title: input.title, audience: input.audience, learningObjectives: input.learningObjectives, claims: input.claims } }; }
function requireApiKey(tool: string): YouTubeCore { if (!apiKey) throw new Error(`${tool} requires YOUTUBE_API_KEY. Enable the YouTube Data API v3 for that key.`); return core; }
async function tryGetTranscript(videoId: string): Promise<VideoTranscript | undefined> { try { return await core.getTranscript(videoId); } catch (error) { log(`Transcript unavailable for ${videoId}: ${error instanceof Error ? error.message : String(error)}`); return undefined; } }
function parseIsoDuration(duration: string): number { const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!match) return 0; return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0); }
function json(payload: unknown) { return text(JSON.stringify(payload, null, 2)); }
function text(value: string) { return { content: [{ type: 'text' as const, text: value }] }; }
function errorResult(message: string) { return { isError: true, content: [{ type: 'text' as const, text: message }] }; }
function log(message: string): void { process.stderr.write(`[${SERVER_NAME}] ${message}\n`); }
async function main(): Promise<void> { const server = createServer(); await server.connect(new StdioServerTransport()); log(`${SERVER_NAME} ${SERVER_VERSION} connected on stdio${apiKey ? '' : ' (transcript and collateral-prompt tools available without an API key)'}${environmentFile ? `; loaded ${environmentFile}` : ''}.`); }
main().catch((error) => { log(`Fatal: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
