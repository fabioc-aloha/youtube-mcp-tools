/**
 * YouTube MCP Server
 *
 * Stdio Model Context Protocol server. Exposes YouTube capabilities to any
 * MCP-aware client (VS Code Agent Mode, Claude Desktop, Cursor, custom
 * agents).
 *
 * # Design choices that matter to end-users
 *
 * - **No API key required to start.** Transcript-based tools (`get_transcript`,
 *   `search_transcript`) work against YouTube's public timed-text endpoint —
 *   no Google Cloud Console trip needed for the most common use case
 *   ("summarize this video for me"). Tools that need the YouTube Data API
 *   (search, video details, full analysis, flashcards) check for the key
 *   on call and return a clear error if it's missing.
 * - **Accept URLs everywhere.** Any tool taking a `video` argument tolerates
 *   bare 11-char IDs *or* `youtu.be/...`, `youtube.com/watch?v=...`,
 *   `youtube.com/shorts/...`, etc. End-users paste URLs.
 * - **Deep-linkable timestamps.** Transcript output renders each timestamp
 *   as a clickable Markdown link (`[03:42](https://youtu.be/X?t=222)`) so
 *   chatbots can cite specific moments and users can jump there.
 * - **Transcripts are cached on disk.** They never change once a video is
 *   uploaded; refetching wastes bandwidth and time. Cache lives at
 *   `$YOUTUBE_MCP_CACHE_DIR` or `~/.cache/youtube-mcp-tools/transcripts/`.
 *   Disable with `YOUTUBE_MCP_NO_CACHE=1`.
 *
 * Logs go to stderr only — stdout is reserved for the JSON-RPC channel.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { YouTubeCore, VideoTranscript } from '../services/youtubeCore';

const SERVER_NAME = 'youtube-mcp-tools';
const SERVER_VERSION = '0.4.0';

function logErr(msg: string): void {
    process.stderr.write(`[${SERVER_NAME}] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Filesystem transcript cache
// ---------------------------------------------------------------------------
// Transcripts on YouTube are immutable for a given video — captions can be
// edited but the public timed-text endpoint serves the live version and we
// don't reissue requests we don't have to. Cache TTL is therefore "until the
// user clears it" rather than time-based.

const CACHE_DISABLED = process.env.YOUTUBE_MCP_NO_CACHE === '1';
const CACHE_DIR = process.env.YOUTUBE_MCP_CACHE_DIR
    || path.join(os.homedir(), '.cache', 'youtube-mcp-tools', 'transcripts');

function cachePath(videoId: string): string {
    return path.join(CACHE_DIR, `${videoId}.json`);
}

function readTranscriptCache(videoId: string): VideoTranscript | undefined {
    if (CACHE_DISABLED) { return undefined; }
    try {
        const raw = fs.readFileSync(cachePath(videoId), 'utf8');
        return JSON.parse(raw) as VideoTranscript;
    } catch {
        return undefined;
    }
}

function writeTranscriptCache(videoId: string, transcript: VideoTranscript): void {
    if (CACHE_DISABLED) { return; }
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cachePath(videoId), JSON.stringify(transcript), 'utf8');
    } catch (e) {
        logErr(`Cache write failed for ${videoId}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

// ---------------------------------------------------------------------------
// Core construction
// ---------------------------------------------------------------------------
// The core is constructed even without an API key — transcript tools don't
// need one. Tools that *do* need a key call `assertApiKey()` first.

const apiKey = process.env.YOUTUBE_API_KEY ?? '';
const core = new YouTubeCore(apiKey, logErr);

if (!apiKey) {
    logErr('Note: YOUTUBE_API_KEY not set. Transcript-based tools work without it; search/details/analyze/flashcards will return an error until a key is provided.');
}

function assertApiKey(toolName: string): void {
    if (!apiKey) {
        throw new Error(
            `Tool '${toolName}' requires the YouTube Data API. Set the YOUTUBE_API_KEY environment variable. `
            + `Get a key at https://console.cloud.google.com/apis/credentials and enable the YouTube Data API v3.`,
        );
    }
}

/**
 * Patch `core.getTranscript` with a transparent filesystem cache. We do this
 * by wrapping rather than subclassing because the MCP server is the only
 * filesystem-aware caller; the core stays pure.
 */
const originalGetTranscript = core.getTranscript.bind(core);
core.getTranscript = async (videoId: string): Promise<VideoTranscript> => {
    const cached = readTranscriptCache(videoId);
    if (cached) {
        logErr(`cache hit ${videoId}`);
        return cached;
    }
    const fresh = await originalGetTranscript(videoId);
    writeTranscriptCache(videoId, fresh);
    return fresh;
};

const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool catalogue — sorted by what end-users hit most
// ---------------------------------------------------------------------------

const TOOLS = [
    // ------- No API key needed (works out of the box) -------
    {
        name: 'youtube_get_transcript',
        description:
            'Get the full transcript of a YouTube video as Markdown with clickable timestamps. '
            + '**No API key needed** — works on any public video that has captions. '
            + 'Each line is rendered as `[mm:ss](https://youtu.be/ID?t=secs) text`, so '
            + 'an AI client can cite a specific moment and the user can click to jump there. '
            + 'Cached on disk after the first fetch.',
        inputSchema: {
            type: 'object',
            properties: {
                video: {
                    type: 'string',
                    description: 'Video ID (e.g. `dQw4w9WgXcQ`) or any YouTube URL (`youtu.be/…`, `youtube.com/watch?v=…`, `youtube.com/shorts/…`).',
                },
                format: {
                    type: 'string',
                    enum: ['markdown', 'plain', 'segments'],
                    description: 'Output format. `markdown` (default) renders deep-link timestamps; `plain` is `[mm:ss] text`; `segments` returns the raw JSON array.',
                    default: 'markdown',
                },
            },
            required: ['video'],
        },
    },
    {
        name: 'youtube_search_transcript',
        description:
            'Search inside a single video\'s transcript and return matching moments with timestamps and deep-link URLs. '
            + '**No API key needed.** Ideal for "where in this 2-hour podcast did they mention X?" — '
            + 'far cheaper than dumping the whole transcript into the AI\'s context window.',
        inputSchema: {
            type: 'object',
            properties: {
                video: { type: 'string', description: 'Video ID or YouTube URL.' },
                query: { type: 'string', maxLength: 512, description: 'Substring to search for (case-insensitive), or a regex up to 512 characters.' },
                regex: { type: 'boolean', description: 'Treat `query` as a JS regex instead of plain substring.', default: false },
                contextSeconds: {
                    type: 'integer',
                    description: 'Pad each match with this many seconds of surrounding transcript on either side. 0 = matched line only.',
                    minimum: 0,
                    maximum: 120,
                    default: 10,
                },
                maxMatches: {
                    type: 'integer',
                    description: 'Maximum number of matches to return.',
                    minimum: 1,
                    maximum: 200,
                    default: 25,
                },
            },
            required: ['video', 'query'],
        },
    },
    {
        name: 'youtube_quota_status',
        description:
            'Show the current process\'s YouTube Data API quota usage (used / limit / remaining / reset estimate). '
            + 'No API key needed — just reports what this server has spent in-memory since startup.',
        inputSchema: { type: 'object', properties: {} },
    },

    // ------- API key required -------
    {
        name: 'youtube_search',
        description:
            'Search YouTube for videos matching a query. Returns up to `maxResults` results with id, title, channel, description, publish date, and thumbnail. '
            + '**Requires `YOUTUBE_API_KEY`** — costs 100 quota units per call (10,000/day default = ~100 searches/day).',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query.' },
                maxResults: { type: 'integer', description: 'Max results (1–50).', minimum: 1, maximum: 50, default: 10 },
            },
            required: ['query'],
        },
    },
    {
        name: 'youtube_get_video_details',
        description:
            'Fetch metadata for a single video: title, channel, description, duration (ISO 8601), view/like/comment counts, tags, caption availability. '
            + '**Requires `YOUTUBE_API_KEY`** — costs 1 quota unit.',
        inputSchema: {
            type: 'object',
            properties: { video: { type: 'string', description: 'Video ID or YouTube URL.' } },
            required: ['video'],
        },
    },
    {
        name: 'youtube_analyze_video',
        description:
            'Comprehensive analysis: summary, key points, topics, extracted concepts (term/technique/tool/person/theory) with mention counts, difficulty estimate, and observable quality signals (caption availability, word count, sentence length, engagement ratio). '
            + '**Requires `YOUTUBE_API_KEY`** — costs 1 quota unit plus a free transcript fetch.',
        inputSchema: {
            type: 'object',
            properties: { video: { type: 'string', description: 'Video ID or YouTube URL.' } },
            required: ['video'],
        },
    },
    {
        name: 'youtube_generate_flashcards',
        description:
            'Generate study flashcards (front/back/difficulty/tags) from a video\'s key points and concepts. '
            + '**Requires `YOUTUBE_API_KEY`** — costs 1 quota unit plus a free transcript fetch.',
        inputSchema: {
            type: 'object',
            properties: { video: { type: 'string', description: 'Video ID or YouTube URL.' } },
            required: ['video'],
        },
    },
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ---------------------------------------------------------------------------
// Argument helpers
// ---------------------------------------------------------------------------

interface ToolArgs { [k: string]: unknown }

function asString(v: unknown, name: string): string {
    if (typeof v !== 'string' || v.length === 0) {
        throw new Error(`Argument '${name}' must be a non-empty string`);
    }
    return v;
}

function asInt(v: unknown, name: string, fallback: number, min: number, max: number): number {
    if (v === undefined || v === null) { return fallback; }
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new Error(`Argument '${name}' must be an integer in [${min}, ${max}]`);
    }
    return Math.floor(n);
}

function asBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === 'boolean') { return v; }
    if (v === undefined || v === null) { return fallback; }
    if (v === 'true') { return true; }
    if (v === 'false') { return false; }
    return fallback;
}

/** Resolve a `video` arg into a bare 11-char video ID, accepting URLs. */
function asVideoId(v: unknown): string {
    return YouTubeCore.extractVideoId(asString(v, 'video'));
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as ToolArgs;

    try {
        switch (name) {
            // ----- No-key tools -----
            case 'youtube_get_transcript': {
                const videoId = asVideoId(args.video);
                const format = asString(args.format ?? 'markdown', 'format');
                if (format === 'segments') {
                    const t = await core.getTranscript(videoId);
                    return jsonResult(t);
                }
                if (format === 'plain') {
                    const text = await core.getFormattedTranscript(videoId);
                    return textResult(text);
                }
                const md = await core.getMarkdownTranscript(videoId);
                return textResult(md);
            }
            case 'youtube_search_transcript': {
                const videoId = asVideoId(args.video);
                const query = asString(args.query, 'query');
                const regex = asBool(args.regex, false);
                const contextSeconds = asInt(args.contextSeconds, 'contextSeconds', 10, 0, 120);
                const maxMatches = asInt(args.maxMatches, 'maxMatches', 25, 1, 200);
                const matches = await core.searchTranscript(videoId, query, { regex, contextSeconds, maxMatches });
                return jsonResult({
                    videoId,
                    query,
                    matches: matches.length,
                    results: matches,
                });
            }
            case 'youtube_quota_status': {
                return jsonResult(core.getQuotaStatus());
            }

            // ----- Key-requiring tools -----
            case 'youtube_search': {
                assertApiKey(name);
                const query = asString(args.query, 'query');
                const maxResults = asInt(args.maxResults, 'maxResults', 10, 1, 50);
                return jsonResult(await core.search(query, maxResults));
            }
            case 'youtube_get_video_details': {
                assertApiKey(name);
                return jsonResult(await core.getVideoDetails(asVideoId(args.video)));
            }
            case 'youtube_analyze_video': {
                assertApiKey(name);
                return jsonResult(await core.analyzeVideo(asVideoId(args.video)));
            }
            case 'youtube_generate_flashcards': {
                assertApiKey(name);
                return jsonResult(await core.generateFlashcards(asVideoId(args.video)));
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logErr(`Tool '${name}' failed: ${message}`);
        return {
            isError: true,
            content: [{ type: 'text', text: message }],
        };
    }
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function jsonResult(payload: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function textResult(text: string) {
    return { content: [{ type: 'text' as const, text }] };
}

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logErr(`${SERVER_NAME} v${SERVER_VERSION} ready on stdio${apiKey ? '' : ' (no API key — transcript tools only)'}`);
}

main().catch((e) => {
    logErr(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
});
