/**
 * YouTube Core
 *
 * Pure YouTube domain logic with **no VS Code dependencies**.
 * Used by both:
 *   - `YouTubeService` (the VS Code extension wrapper, adding SecretStorage,
 *     persistent quota, .env discovery, user prompts)
 *   - `src/mcp-server/index.ts` (the standalone MCP server, taking the API
 *     key from env vars and logging to stderr)
 *
 * Anything that touches `vscode` belongs in `youtubeService.ts`, not here.
 */

import * as https from 'https';
import { Worker } from 'node:worker_threads';
import { YoutubeTranscript } from 'youtube-transcript';

// ============================================================================
// PUBLIC TYPES (re-exported from youtubeService.ts)
// ============================================================================

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string;
    tags: string[];
    categoryId: string;
    duration: string;
    definition: string;
    caption: boolean;
    viewCount: number;
    likeCount: number;
    commentCount: number;
}

export interface TranscriptSegment {
    text: string;
    offset: number;
    duration: number;
}

export interface VideoTranscript {
    videoId: string;
    segments: TranscriptSegment[];
    fullText: string;
    language?: string;
}

export interface ContentSummary {
    brief: string;
    detailed: string;
    keyPoints: string[];
    topics: string[];
}

export interface ExtractedConcept {
    name: string;
    type: 'term' | 'technique' | 'tool' | 'person' | 'theory';
    definition?: string;
    mentions: number;
}

export interface ConceptExtraction {
    concepts: ExtractedConcept[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    prerequisites: string[];
}

/**
 * Measurable quality signals for the video, derived from observable properties
 * (caption availability, length, structural metadata) — **not** opinion scores.
 *
 * v0.2.x had an `overall` 0-100 score derived from a private formula; that
 * was opaque and overclaimed precision. v0.3.0 returns only signals callers
 * can interpret themselves.
 */
export interface QualitySignals {
    /** Whether YouTube auto-detected captions. */
    hasCaptions: boolean;
    /** Number of words in transcript or description. */
    wordCount: number;
    /** Average words per sentence (lower ≈ easier to follow). */
    avgSentenceLength: number;
    /** likes / views, or 0 when views are zero. Two-decimal precision. */
    engagementRatio: number;
    /** Number of timed transcript segments (0 means no transcript). */
    transcriptSegmentCount: number;
}

export interface SearchResultItem {
    id: string;
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnailUrl?: string;
}

export interface VideoAnalysisResult {
    videoId: string;
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    duration: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    summary: ContentSummary;
    concepts: ConceptExtraction;
    quality: QualitySignals;
}

export interface FlashcardItem {
    id: string;
    front: string;
    back: string;
    difficulty: 'easy' | 'medium' | 'hard';
    type: string;
    tags: string[];
}

export interface QuotaInfo {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
}

export type Logger = (message: string) => void;

interface RawTranscriptSegment {
    text: string;
    duration: number;
    offset: number;
    lang?: string;
}

type TranscriptTimestampUnit = 'milliseconds' | 'seconds';

const REGEX_SEARCH_TIMEOUT_MS = 250;
const MAX_REGEX_QUERY_LENGTH = 512;
const REGEX_WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');

try {
    const matcher = new RegExp(workerData.query, 'i');
    const matches = [];
    for (let index = 0; index < workerData.texts.length && matches.length < workerData.maxMatches; index += 1) {
        if (matcher.test(workerData.texts[index])) {
            matches.push(index);
        }
    }
    parentPort.postMessage({ matches });
} catch (error) {
    parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
`;

export function normalizeTranscriptTimings(
    segments: ReadonlyArray<Pick<RawTranscriptSegment, 'offset' | 'duration'>>,
    unit: TranscriptTimestampUnit,
): Array<Pick<TranscriptSegment, 'offset' | 'duration'>> {
    const multiplier = unit === 'milliseconds' ? 1 / 1000 : 1;
    return segments.map((segment) => ({
        offset: segment.offset * multiplier,
        duration: segment.duration * multiplier,
    }));
}

function captionTimestampUnit(xml: string): TranscriptTimestampUnit | undefined {
    if (/<p\s+t="\d+"\s+d="\d+"/.test(xml)) {
        return 'milliseconds';
    }
    if (/<text\s+start="[^"]*"\s+dur="[^"]*">/.test(xml)) {
        return 'seconds';
    }
    return undefined;
}

function isCaptionRequest(input: Parameters<typeof globalThis.fetch>[0]): boolean {
    const source = typeof input === 'string'
        ? input
        : input instanceof URL
            ? input.href
            : input.url;
    try {
        const url = new URL(source);
        return url.hostname.endsWith('.youtube.com') && url.pathname === '/api/timedtext';
    } catch {
        return false;
    }
}

function inferTranscriptTimestampUnit(segments: ReadonlyArray<RawTranscriptSegment>): TranscriptTimestampUnit {
    const largestDuration = Math.max(0, ...segments.map((segment) => segment.duration));
    return largestDuration >= 100 ? 'milliseconds' : 'seconds';
}

function isRegexMatchIndexList(value: unknown): value is number[] {
    return Array.isArray(value) && value.every((index) => Number.isInteger(index) && index >= 0);
}

async function findRegexMatchIndexes(query: string, texts: string[], maxMatches: number): Promise<Set<number>> {
    if (query.length > MAX_REGEX_QUERY_LENGTH) {
        throw new Error(`Regex queries cannot exceed ${MAX_REGEX_QUERY_LENGTH} characters.`);
    }

    return new Promise<Set<number>>((resolve, reject) => {
        let settled = false;
        const worker = new Worker(REGEX_WORKER_SOURCE, {
            eval: true,
            workerData: { query, texts, maxMatches },
            resourceLimits: { maxOldGenerationSizeMb: 16, stackSizeMb: 4 },
        });
        const timeout = setTimeout(() => {
            finish(() => reject(new Error(`Regex transcript search exceeded ${REGEX_SEARCH_TIMEOUT_MS}ms and was stopped.`)));
        }, REGEX_SEARCH_TIMEOUT_MS);

        function finish(callback: () => void): void {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            worker.removeAllListeners();
            void worker.terminate();
            callback();
        }

        worker.once('message', (message: unknown) => {
            if (typeof message !== 'object' || message === null) {
                finish(() => reject(new Error('Regex transcript search returned an invalid result.')));
                return;
            }
            const result = message as { matches?: unknown; error?: unknown };
            if (typeof result.error === 'string') {
                finish(() => reject(new Error(`Invalid regex query: ${result.error}`)));
                return;
            }
            const matches = result.matches;
            if (!isRegexMatchIndexList(matches)) {
                finish(() => reject(new Error('Regex transcript search returned invalid match indexes.')));
                return;
            }
            finish(() => resolve(new Set(matches)));
        });
        worker.once('error', (error) => {
            finish(() => reject(new Error(`Regex transcript search failed: ${error.message}`)));
        });
        worker.once('exit', (code) => {
            if (code !== 0) {
                finish(() => reject(new Error(`Regex transcript search worker exited with code ${code}.`)));
            }
        });
    });
}

// ============================================================================
// INTERNAL YOUTUBE API SHAPES
// ============================================================================

interface YouTubeApiThumbnail { url: string; width?: number; height?: number; }
interface YouTubeApiThumbnails {
    default?: YouTubeApiThumbnail;
    medium?: YouTubeApiThumbnail;
    high?: YouTubeApiThumbnail;
    standard?: YouTubeApiThumbnail;
    maxres?: YouTubeApiThumbnail;
}
interface YouTubeApiSnippet {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: YouTubeApiThumbnails;
    tags?: string[];
    categoryId?: string;
}
interface YouTubeApiContentDetails {
    duration?: string;
    definition?: string;
    caption?: string;
}
interface YouTubeApiStatistics {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
}
interface YouTubeApiSearchItem {
    id?: { videoId?: string };
    snippet?: YouTubeApiSnippet;
}
interface YouTubeApiVideoItem {
    id?: string;
    snippet?: YouTubeApiSnippet;
    contentDetails?: YouTubeApiContentDetails;
    statistics?: YouTubeApiStatistics;
}
interface YouTubeApiSearchResponse { items?: YouTubeApiSearchItem[]; }
interface YouTubeApiVideoResponse { items?: YouTubeApiVideoItem[]; }

// ============================================================================
// CORE
// ============================================================================

/**
 * Hooks the host environment can supply for quota tracking.
 *
 * The extension uses VS Code Memento for cross-session persistence; the MCP
 * server uses a no-op (in-memory) hook. Both are fine — quota tracking is a
 * usage indicator, not a security boundary (YouTube enforces real limits
 * server-side).
 */
export interface QuotaHooks {
    load(): { used: number; resetDate: string };
    save(used: number, resetDate: string): void;
    /** Optional warning sink; called when usage crosses ~80%. */
    onWarning?(percentUsed: number): void;
}

const NOOP_QUOTA: QuotaHooks = {
    load: () => ({ used: 0, resetDate: '' }),
    save: () => undefined,
};

export class YouTubeCore {
    private readonly DAILY_QUOTA_LIMIT = 10000;
    private readonly API_BASE = 'https://www.googleapis.com/youtube/v3';
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY_MS = 1000;
    private readonly MIN_REQUEST_INTERVAL_MS = 100;

    private quotaUsed = 0;
    private quotaResetDate = '';
    private lastRequestTime = 0;
    private warnedAtPercent = 0;

    constructor(
        private apiKey: string,
        private readonly log: Logger = () => undefined,
        private readonly quotaHooks: QuotaHooks = NOOP_QUOTA,
    ) {
        this.loadQuota();
    }

    /**
     * Extract a YouTube video ID from a URL or bare ID. Accepts:
     * - Bare 11-char IDs (`dQw4w9WgXcQ`)
     * - youtu.be short links (`https://youtu.be/dQw4w9WgXcQ`)
     * - watch URLs (`https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120`)
     * - embed URLs (`https://www.youtube.com/embed/dQw4w9WgXcQ`)
     * - shorts (`https://www.youtube.com/shorts/dQw4w9WgXcQ`)
     * - live (`https://www.youtube.com/live/dQw4w9WgXcQ`)
     * Throws if the input doesn't yield a plausible 11-char ID.
     */
    static extractVideoId(input: string): string {
        if (typeof input !== 'string' || input.length === 0) {
            throw new Error('extractVideoId: input must be a non-empty string');
        }
        const trimmed = input.trim();
        // Bare 11-char ID — fastest path.
        if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) { return trimmed; }
        const patterns = [
            /(?:youtube\.com\/watch\?[^#]*[?&]?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/|youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
            /^([A-Za-z0-9_-]{11})/, // fallback: leading 11 chars
        ];
        for (const re of patterns) {
            const m = trimmed.match(re);
            if (m) { return m[1]; }
        }
        throw new Error(`Could not extract a YouTube video ID from: ${trimmed.slice(0, 80)}`);
    }

    /** Build a deep-link URL that jumps to a specific timestamp in a video. */
    static deepLink(videoId: string, offsetSeconds: number): string {
        const t = Math.max(0, Math.floor(offsetSeconds));
        return `https://youtu.be/${videoId}?t=${t}`;
    }

    /** Update the API key in place (used when the user re-keys). */
    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
    }

    private loadQuota(): void {
        const today = new Date().toISOString().split('T')[0];
        const persisted = this.quotaHooks.load();
        if (persisted.resetDate === today) {
            this.quotaUsed = persisted.used;
            this.quotaResetDate = today;
        } else {
            this.quotaUsed = 0;
            this.quotaResetDate = today;
            this.quotaHooks.save(0, today);
        }
    }

    private trackQuota(cost: number): void {
        this.quotaUsed += cost;
        this.quotaHooks.save(this.quotaUsed, this.quotaResetDate);
        const pct = Math.round((this.quotaUsed / this.DAILY_QUOTA_LIMIT) * 100);
        if (pct >= 80 && pct > this.warnedAtPercent) {
            this.warnedAtPercent = pct;
            this.quotaHooks.onWarning?.(pct);
        }
    }

    private async applyRateLimit(): Promise<void> {
        const elapsed = Date.now() - this.lastRequestTime;
        if (elapsed < this.MIN_REQUEST_INTERVAL_MS) {
            await new Promise(r => setTimeout(r, this.MIN_REQUEST_INTERVAL_MS - elapsed));
        }
        this.lastRequestTime = Date.now();
    }

    /** Validate the configured API key with one cheap request. */
    async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
        try {
            const params = new URLSearchParams({
                part: 'snippet', q: 'test', type: 'video',
                maxResults: '1', key: this.apiKey,
            });
            await this.httpGet<unknown>(`${this.API_BASE}/search?${params}`);
            return { valid: true };
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            if (/API key not valid|forbidden|403/i.test(msg)) {
                return { valid: false, error: 'Invalid API key' };
            }
            if (/quota/i.test(msg)) {
                return { valid: true, error: 'API key valid but quota exceeded' };
            }
            return { valid: false, error: msg };
        }
    }

    private async httpGet<T>(url: string): Promise<T> {
        await this.applyRateLimit();
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                return await this.httpGetInternal<T>(url);
            } catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                const msg = lastError.message;
                const retryable = /429|503|ECONNRESET|ETIMEDOUT/.test(msg);
                if (!retryable || attempt === this.MAX_RETRIES - 1) { throw lastError; }
                const delay = this.BASE_DELAY_MS * Math.pow(2, attempt);
                this.log(`Request failed, retrying in ${delay}ms (${attempt + 1}/${this.MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw lastError ?? new Error('Request failed after retries');
    }

    private httpGetInternal<T>(url: string): Promise<T> {
        return new Promise((resolve, reject) => {
            https.get(url, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 400) {
                            const parsed = JSON.parse(data) as { error?: { message?: string } };
                            const errMsg = parsed.error?.message ?? `HTTP ${res.statusCode}`;
                            reject(new Error(`${res.statusCode}: ${errMsg}`));
                        } else {
                            resolve(JSON.parse(data) as T);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async search(query: string, maxResults = 10): Promise<SearchResultItem[]> {
        this.log(`search "${query}" (max ${maxResults})`);
        const params = new URLSearchParams({
            part: 'snippet', q: query, type: 'video',
            maxResults: String(maxResults), key: this.apiKey,
        });
        const response = await this.httpGet<YouTubeApiSearchResponse>(`${this.API_BASE}/search?${params}`);
        this.trackQuota(100);
        return (response.items ?? []).map(item => ({
            id: item.id?.videoId ?? '',
            title: item.snippet?.title ?? '',
            channelTitle: item.snippet?.channelTitle ?? '',
            description: item.snippet?.description ?? '',
            publishedAt: item.snippet?.publishedAt ?? '',
            thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
        }));
    }

    async getVideoDetails(videoId: string): Promise<YouTubeVideo> {
        this.log(`getVideoDetails ${videoId}`);
        const params = new URLSearchParams({
            part: 'snippet,contentDetails,statistics', id: videoId, key: this.apiKey,
        });
        const response = await this.httpGet<YouTubeApiVideoResponse>(`${this.API_BASE}/videos?${params}`);
        this.trackQuota(1);
        if (!response.items || response.items.length === 0) {
            throw new Error(`Video not found: ${videoId}`);
        }
        const item = response.items[0];
        return {
            id: item.id ?? videoId,
            title: item.snippet?.title ?? '',
            description: item.snippet?.description ?? '',
            channelId: item.snippet?.channelId ?? '',
            channelTitle: item.snippet?.channelTitle ?? '',
            publishedAt: item.snippet?.publishedAt ?? '',
            thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? '',
            tags: item.snippet?.tags ?? [],
            categoryId: item.snippet?.categoryId ?? '',
            duration: item.contentDetails?.duration ?? '',
            definition: item.contentDetails?.definition ?? '',
            caption: item.contentDetails?.caption === 'true',
            viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
            likeCount: parseInt(item.statistics?.likeCount ?? '0', 10),
            commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
        };
    }

    async getTranscript(videoId: string): Promise<VideoTranscript> {
        this.log(`getTranscript ${videoId}`);
        // We use the `youtube-transcript` package because YouTube's public
        // page format changes frequently (player config, signed timedtext
        // URLs, PoToken-protected endpoints, locale variants). The library
        // tracks those upstream so we don't have to. No API key needed.
        let raw: RawTranscriptSegment[];
        let timestampUnit: TranscriptTimestampUnit | undefined;
        const fetchWithCaptionDetection: typeof globalThis.fetch = async (input, init) => {
            const response = await globalThis.fetch(input, init);
            if (isCaptionRequest(input)) {
                timestampUnit = captionTimestampUnit(await response.clone().text());
            }
            return response;
        };
        try {
            raw = await YoutubeTranscript.fetchTranscript(videoId, { fetch: fetchWithCaptionDetection });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Normalise the most common failure modes for callers.
            if (/disabled|no transcript|transcripts? are disabled/i.test(msg)) {
                throw new Error(`No captions available for video ${videoId}: ${msg}`);
            }
            if (/unavailable|video unavailable/i.test(msg)) {
                throw new Error(`Video ${videoId} is unavailable: ${msg}`);
            }
            throw new Error(`Transcript fetch failed for ${videoId}: ${msg}`);
        }
        const unit = timestampUnit ?? inferTranscriptTimestampUnit(raw);
        if (!timestampUnit) {
            this.log(`Could not identify caption timestamp units for ${videoId}; inferred ${unit}.`);
        }
        const timings = normalizeTranscriptTimings(raw, unit);
        const segments: TranscriptSegment[] = raw.map((segment, index) => ({
            text: YouTubeCore.decodeHtmlEntities(segment.text).trim(),
            ...timings[index],
        }));
        return {
            videoId,
            segments,
            fullText: segments.map(s => s.text).join(' '),
            language: raw[0]?.lang ?? 'en',
        };
    }

    async getFormattedTranscript(videoId: string): Promise<string> {
        const t = await this.getTranscript(videoId);
        return t.segments.map(s => `[${YouTubeCore.formatTimestamp(s.offset)}] ${s.text}`).join('\n');
    }

    /**
     * Like `getFormattedTranscript` but renders each timestamp as a Markdown
     * deep-link to the specific moment in the video. Designed for AI-chat
     * surfaces where the model can quote a passage and the user can click
     * the timestamp to jump there.
     */
    async getMarkdownTranscript(videoId: string): Promise<string> {
        const t = await this.getTranscript(videoId);
        return t.segments
            .map(s => {
                const ts = YouTubeCore.formatTimestamp(s.offset);
                const url = YouTubeCore.deepLink(videoId, s.offset);
                return `[\`${ts}\`](${url}) ${s.text}`;
            })
            .join('\n');
    }

    /**
     * Search within a video's transcript. Returns matching segments with
     * timestamps and deep-link URLs. Case-insensitive plain substring match
     * by default; pass `regex: true` for regex semantics.
     *
     * Optionally pads each match with `contextSeconds` of surrounding
     * segments, useful when the answer to a question spans multiple lines.
     */
    async searchTranscript(
        videoId: string,
        query: string,
        opts: { regex?: boolean; contextSeconds?: number; maxMatches?: number } = {},
    ): Promise<Array<{
        offset: number;
        timestamp: string;
        url: string;
        text: string;
        matchedSegmentOffset: number;
    }>> {
        const { regex = false, contextSeconds = 0, maxMatches = 50 } = opts;
        if (!query || query.length === 0) {
            throw new Error('searchTranscript: query must be a non-empty string');
        }
        const t = await this.getTranscript(videoId);
        const regexMatchIndexes = regex
            ? await findRegexMatchIndexes(query, t.segments.map((segment) => segment.text), maxMatches)
            : undefined;
        const needle = query.toLowerCase();

        const out: Array<{
            offset: number;
            timestamp: string;
            url: string;
            text: string;
            matchedSegmentOffset: number;
        }> = [];

        for (let i = 0; i < t.segments.length && out.length < maxMatches; i++) {
            const matches = regex
                ? regexMatchIndexes?.has(i) === true
                : t.segments[i].text.toLowerCase().includes(needle);
            if (!matches) { continue; }
            const center = t.segments[i];
            // Expand outward by contextSeconds in both directions.
            let start = i, end = i;
            if (contextSeconds > 0) {
                while (start > 0 && center.offset - t.segments[start - 1].offset <= contextSeconds) { start--; }
                while (end < t.segments.length - 1 && t.segments[end + 1].offset - center.offset <= contextSeconds) { end++; }
            }
            const text = t.segments.slice(start, end + 1).map(s => s.text).join(' ');
            out.push({
                offset: center.offset,
                timestamp: YouTubeCore.formatTimestamp(center.offset),
                url: YouTubeCore.deepLink(videoId, center.offset),
                text,
                matchedSegmentOffset: center.offset,
            });
        }
        return out;
    }

    private static decodeHtmlEntities(text: string): string {
        return text
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
    }

    private static formatTimestamp(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
    }

    async analyzeVideo(videoId: string): Promise<VideoAnalysisResult> {
        const video = await this.getVideoDetails(videoId);
        let transcript: VideoTranscript;
        try {
            transcript = await this.getTranscript(videoId);
        } catch {
            transcript = { videoId, segments: [], fullText: video.description || '' };
        }
        return {
            videoId,
            title: video.title,
            channelTitle: video.channelTitle,
            description: video.description,
            publishedAt: video.publishedAt,
            duration: video.duration,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            commentCount: video.commentCount,
            summary: this.generateSummary(video, transcript),
            concepts: this.extractConcepts(video, transcript),
            quality: this.qualitySignals(video, transcript),
        };
    }

    private generateSummary(video: YouTubeVideo, t: VideoTranscript): ContentSummary {
        const text = t.fullText || video.description;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const brief = sentences[0]?.trim() ?? `Video about ${video.title}`;
        const detailed = sentences.slice(0, 5).join('. ').trim() + '.';
        const indicator = /\b(important|key|main|first|second|third|step|tip|remember|note|crucial)\b/i;
        const keyPoints = sentences.filter(s => indicator.test(s)).slice(0, 5).map(s => s.trim());
        if (keyPoints.length === 0 && video.tags.length > 0) {
            keyPoints.push(...video.tags.slice(0, 3).map(tag => `Topic: ${tag}`));
        }
        return { brief, detailed, keyPoints, topics: this.extractTopics(video, text) };
    }

    private extractTopics(video: YouTubeVideo, text: string): string[] {
        const topics = new Set<string>();
        video.tags.slice(0, 5).forEach(tag => topics.add(tag.toLowerCase()));
        const patterns = [
            /\b(tutorial|guide|how to|introduction|overview|review)\b/gi,
            /\b(programming|coding|development|software)\b/gi,
            /\b(javascript|typescript|python|react|node|api)\b/gi,
            /\b(machine learning|ai|data science|analytics)\b/gi,
        ];
        for (const p of patterns) {
            const matches = text.match(p);
            matches?.slice(0, 2).forEach(m => topics.add(m.toLowerCase()));
        }
        return Array.from(topics).slice(0, 8);
    }

    private extractConcepts(video: YouTubeVideo, t: VideoTranscript): ConceptExtraction {
        const text = t.fullText || video.description;
        const techTerms = text.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g) ?? [];
        const counts = new Map<string, number>();
        techTerms.forEach(term => {
            if (term.length > 3) {
                const key = term.toLowerCase();
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        });
        const concepts: ExtractedConcept[] = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, n]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                type: 'term',
                mentions: n,
            }));
        const wordCount = Math.max(1, text.split(/\s+/).length);
        const density = techTerms.length / wordCount;
        const difficulty: ConceptExtraction['difficulty'] =
            density > 0.1 ? 'advanced' : density > 0.05 ? 'intermediate' : 'beginner';
        return { concepts, difficulty, prerequisites: video.tags.slice(0, 3) };
    }

    /**
     * Measurable signals only — no opaque "overall" score. Callers can
     * surface or ignore each as they see fit.
     */
    private qualitySignals(video: YouTubeVideo, t: VideoTranscript): QualitySignals {
        const text = t.fullText || video.description;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const avgSentenceLength = sentences.length > 0
            ? Math.round((wordCount / sentences.length) * 10) / 10
            : 0;
        const ratio = video.viewCount > 0 ? video.likeCount / video.viewCount : 0;
        return {
            hasCaptions: video.caption,
            wordCount,
            avgSentenceLength,
            engagementRatio: Math.round(ratio * 10000) / 10000,
            transcriptSegmentCount: t.segments.length,
        };
    }

    async generateFlashcards(videoId: string): Promise<FlashcardItem[]> {
        const video = await this.getVideoDetails(videoId);
        let transcript: VideoTranscript;
        try {
            transcript = await this.getTranscript(videoId);
        } catch {
            transcript = { videoId, segments: [], fullText: video.description };
        }
        const concepts = this.extractConcepts(video, transcript);
        const summary = this.generateSummary(video, transcript);
        const cards: FlashcardItem[] = [];
        summary.keyPoints.forEach((point, i) => cards.push({
            id: `kp-${i}`,
            front: `What is a key point from "${video.title}"?`,
            back: point,
            difficulty: 'easy',
            type: 'key-point',
            tags: summary.topics.slice(0, 3),
        }));
        concepts.concepts.slice(0, 5).forEach((c, i) => cards.push({
            id: `concept-${i}`,
            front: `What is "${c.name}" in the context of this video?`,
            back: c.definition ?? `A ${c.type} mentioned ${c.mentions} times in the video.`,
            difficulty:
                concepts.difficulty === 'advanced' ? 'hard' :
                    concepts.difficulty === 'intermediate' ? 'medium' : 'easy',
            type: 'definition',
            tags: [c.type, ...summary.topics.slice(0, 2)],
        }));
        if (summary.topics.length > 0) {
            cards.push({
                id: 'topics-0',
                front: `What topics are covered in "${video.title}"?`,
                back: summary.topics.join(', '),
                difficulty: 'easy',
                type: 'application',
                tags: summary.topics,
            });
        }
        return cards;
    }

    getQuotaStatus(): QuotaInfo {
        return {
            used: this.quotaUsed,
            limit: this.DAILY_QUOTA_LIMIT,
            remaining: this.DAILY_QUOTA_LIMIT - this.quotaUsed,
            resetsAt: this.nextResetTime(),
        };
    }

    private nextResetTime(): string {
        const now = new Date();
        const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const tomorrow = new Date(pst);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const hours = Math.ceil((tomorrow.getTime() - pst.getTime()) / (1000 * 60 * 60));
        return `~${hours} hours (midnight PT)`;
    }

    resetQuotaCounter(): void {
        this.quotaUsed = 0;
    }
}
