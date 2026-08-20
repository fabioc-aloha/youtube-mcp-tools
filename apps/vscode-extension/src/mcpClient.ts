/**
 * YouTube API Client (extension-side)
 *
 * Renamed from `YouTubeMcpClient` in v0.3.0 — the original name suggested it
 * spoke MCP, but it never did. The actual MCP server lives in
 * `src/mcp-server/index.ts`. This class is the in-process adapter the
 * extension UI uses to talk to `YouTubeService`.
 *
 * The file is still named `mcpClient.ts` to avoid churning every import in
 * one go; rename in v0.4.0.
 */
import * as vscode from 'vscode';
import { YouTubeService } from './services/youtubeService';
import type {
    SearchResultItem,
    FlashcardItem,
} from './services/youtubeService';

export interface VideoSearchResult {
    id: string;
    title: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnailUrl?: string;
}

/**
 * Shape returned to the extension UI. Mirrors `YouTubeCore.VideoAnalysisResult`
 * but kept here as a stable façade — UI code should depend on this shape, not
 * on the core directly.
 */
export interface VideoAnalysis {
    title: string;
    channelTitle: string;
    description?: string;
    duration?: string;
    viewCount?: number;
    likeCount?: number;
    summary?: {
        brief: string;
        detailed: string;
        keyPoints: string[];
        topics: string[];
    };
    concepts?: {
        concepts: Array<{
            name: string;
            type: string;
            definition?: string;
            mentions: number;
        }>;
        difficulty: string;
        prerequisites: string[];
    };
    /**
     * Measurable quality signals (v0.3.0+). The previous opaque
     * `overall`/`clarity`/`depth`/`structure`/`engagement` 0–100 scores were
     * removed because the formula was undocumented and overclaimed precision.
     */
    quality?: {
        hasCaptions: boolean;
        wordCount: number;
        avgSentenceLength: number;
        engagementRatio: number;
        transcriptSegmentCount: number;
    };
}

export interface Flashcard {
    id: string;
    front: string;
    back: string;
    difficulty: string;
    type?: string;
    tags?: string[];
}

export interface QuotaStatus {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
}

export class YouTubeApiClient {
    private outputChannel: vscode.OutputChannel;
    private youtubeService: YouTubeService;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.youtubeService = new YouTubeService(outputChannel);
        this.outputChannel.appendLine('YouTube API client initialized');
    }

    initializeStorage(context: vscode.ExtensionContext): void {
        this.youtubeService.initializeStorage(context);
    }

    async setApiKey(apiKey: string): Promise<void> {
        await this.youtubeService.setApiKey(apiKey);
    }

    async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
        return this.youtubeService.validateApiKey(apiKey);
    }

    async hasApiKey(): Promise<boolean> {
        try {
            await this.youtubeService.getApiKey();
            return true;
        } catch {
            return false;
        }
    }

    async search(query: string, maxResults = 10): Promise<VideoSearchResult[]> {
        const results = await this.youtubeService.search(query, maxResults);
        return results.map((r: SearchResultItem) => ({
            id: r.id,
            title: r.title,
            channelTitle: r.channelTitle,
            description: r.description,
            publishedAt: r.publishedAt,
            thumbnailUrl: r.thumbnailUrl,
        }));
    }

    async analyzeVideo(videoId: string): Promise<VideoAnalysis> {
        const analysis = await this.youtubeService.analyzeVideo(videoId);
        return {
            title: analysis.title,
            channelTitle: analysis.channelTitle,
            description: analysis.description,
            duration: analysis.duration,
            viewCount: analysis.viewCount,
            likeCount: analysis.likeCount,
            summary: {
                brief: analysis.summary.brief,
                detailed: analysis.summary.detailed,
                keyPoints: analysis.summary.keyPoints,
                topics: analysis.summary.topics,
            },
            concepts: {
                concepts: analysis.concepts.concepts.map(c => ({
                    name: c.name,
                    type: c.type,
                    definition: c.definition,
                    mentions: c.mentions,
                })),
                difficulty: analysis.concepts.difficulty,
                prerequisites: analysis.concepts.prerequisites,
            },
            quality: { ...analysis.quality },
        };
    }

    async getTranscript(videoId: string): Promise<string> {
        return this.youtubeService.getFormattedTranscript(videoId);
    }

    async generateFlashcards(videoId: string): Promise<Flashcard[]> {
        const flashcards = await this.youtubeService.generateFlashcards(videoId);
        return flashcards.map((f: FlashcardItem) => ({
            id: f.id,
            front: f.front,
            back: f.back,
            difficulty: f.difficulty,
            type: f.type,
            tags: f.tags,
        }));
    }

    async getQuotaStatus(): Promise<QuotaStatus> {
        return this.youtubeService.getQuotaStatus();
    }

    resetQuota(): void {
        this.youtubeService.resetQuotaCounter();
    }
}

/**
 * @deprecated Use `YouTubeApiClient`. Alias kept through v0.3.x; remove in v0.4.0.
 */
export const YouTubeMcpClient = YouTubeApiClient;
export type YouTubeMcpClient = YouTubeApiClient;
