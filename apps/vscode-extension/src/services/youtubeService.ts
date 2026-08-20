/**
 * YouTube Service
 *
 * VS Code wrapper around `YouTubeCore`. Handles:
 *   - Secure API key resolution (SecretStorage > settings > .env > env var)
 *   - Cross-session quota persistence via `Memento`
 *   - User-facing warnings via `vscode.window`
 *
 * The pure HTTP / analysis logic lives in `youtubeCore.ts` so the standalone
 * MCP server can use it without dragging in `vscode`.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    YouTubeCore,
    QuotaHooks,
    SearchResultItem,
    YouTubeVideo,
    VideoTranscript,
    VideoAnalysisResult,
    FlashcardItem,
    QuotaInfo,
} from './youtubeCore';

// Re-export types so existing imports keep working.
export type {
    YouTubeVideo,
    TranscriptSegment,
    VideoTranscript,
    ContentSummary,
    ExtractedConcept,
    ConceptExtraction,
    QualitySignals,
    SearchResultItem,
    FlashcardItem,
    QuotaInfo,
    VideoAnalysisResult,
} from './youtubeCore';

/**
 * @deprecated Use `QualitySignals`. Retained for one release as a typed alias
 * so external code that imported `QualityAssessment` keeps compiling.
 */
export type { QualitySignals as QualityAssessment } from './youtubeCore';

/** @deprecated kept temporarily for any downstream import. */
export interface YouTubeSearchResult {
    id: string;
    type: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string;
}

export class YouTubeService {
    private outputChannel: vscode.OutputChannel;
    private globalState: vscode.Memento | null = null;
    private secretStorage: vscode.SecretStorage | null = null;
    private core: YouTubeCore | null = null;
    private cachedApiKey: string | null = null;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.log('YouTube Service initialized');
    }

    initializeStorage(context: vscode.ExtensionContext): void {
        this.globalState = context.globalState;
        this.secretStorage = context.secrets;
        this.log('Storage initialized');
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[YouTubeService] ${message}`);
    }

    private buildQuotaHooks(): QuotaHooks {
        return {
            load: () => ({
                used: this.globalState?.get<number>('quotaUsed', 0) ?? 0,
                resetDate: this.globalState?.get<string>('quotaResetDate', '') ?? '',
            }),
            save: (used, resetDate) => {
                void this.globalState?.update('quotaUsed', used);
                void this.globalState?.update('quotaResetDate', resetDate);
            },
            onWarning: (pct) => {
                void vscode.window.showWarningMessage(
                    `YouTube API quota is ${pct}% used. Consider limiting requests.`,
                );
            },
        };
    }

    private async ensureCore(): Promise<YouTubeCore> {
        const apiKey = await this.getApiKey();
        if (this.core && apiKey === this.cachedApiKey) {
            return this.core;
        }
        if (this.core && this.cachedApiKey !== apiKey) {
            this.core.setApiKey(apiKey);
            this.cachedApiKey = apiKey;
            return this.core;
        }
        this.core = new YouTubeCore(apiKey, msg => this.log(msg), this.buildQuotaHooks());
        this.cachedApiKey = apiKey;
        return this.core;
    }

    /**
     * Resolve API key. Priority: SecretStorage > VS Code settings > .env > env var.
     * If found in plain settings, migrates to SecretStorage.
     */
    async getApiKey(): Promise<string> {
        if (this.secretStorage) {
            const secret = await this.secretStorage.get('youtubeMcp.apiKey');
            if (secret) { return secret; }
        }
        const config = vscode.workspace.getConfiguration('youtubeMcp');
        const settingsKey = config.get<string>('apiKey', '');
        if (settingsKey) {
            if (this.secretStorage) {
                await this.secretStorage.store('youtubeMcp.apiKey', settingsKey);
                this.log('Migrated API key from settings to SecretStorage');
            }
            return settingsKey;
        }
        const envKey = this.readEnvFile();
        if (envKey) {
            this.log('Using API key from .env file');
            return envKey;
        }
        if (process.env.YOUTUBE_API_KEY) {
            this.log('Using API key from environment variable');
            return process.env.YOUTUBE_API_KEY;
        }
        throw new Error(
            'YouTube API key not configured. Use "YouTube MCP: Set API Key" command or add to settings.',
        );
    }

    async setApiKey(apiKey: string): Promise<void> {
        if (!this.secretStorage) { throw new Error('Secret storage not initialized'); }
        await this.secretStorage.store('youtubeMcp.apiKey', apiKey);
        this.cachedApiKey = apiKey;
        if (this.core) { this.core.setApiKey(apiKey); }
        this.log('API key stored securely');
    }

    async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
        const probe = new YouTubeCore(apiKey, msg => this.log(msg));
        return probe.validateApiKey();
    }

    private readEnvFile(): string | null {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return null; }
        const envPath = path.join(folders[0].uri.fsPath, '.env');
        try {
            if (!fs.existsSync(envPath)) { return null; }
            const content = fs.readFileSync(envPath, 'utf-8');
            const match = content.match(/^YOUTUBE_API_KEY=(.+)$/m);
            return match?.[1]?.trim() ?? null;
        } catch (e) {
            this.log(`Could not read .env: ${e}`);
            return null;
        }
    }

    async search(query: string, maxResults = 10): Promise<SearchResultItem[]> {
        return (await this.ensureCore()).search(query, maxResults);
    }

    async getVideoDetails(videoId: string): Promise<YouTubeVideo> {
        return (await this.ensureCore()).getVideoDetails(videoId);
    }

    async getTranscript(videoId: string): Promise<VideoTranscript> {
        return (await this.ensureCore()).getTranscript(videoId);
    }

    async getFormattedTranscript(videoId: string): Promise<string> {
        return (await this.ensureCore()).getFormattedTranscript(videoId);
    }

    async analyzeVideo(videoId: string): Promise<VideoAnalysisResult> {
        return (await this.ensureCore()).analyzeVideo(videoId);
    }

    async generateFlashcards(videoId: string): Promise<FlashcardItem[]> {
        return (await this.ensureCore()).generateFlashcards(videoId);
    }

    getQuotaStatus(): QuotaInfo {
        if (!this.core) {
            const used = this.globalState?.get<number>('quotaUsed', 0) ?? 0;
            return {
                used,
                limit: 10000,
                remaining: 10000 - used,
                resetsAt: 'unknown',
            };
        }
        return this.core.getQuotaStatus();
    }

    resetQuotaCounter(): void {
        this.core?.resetQuotaCounter();
        void this.globalState?.update('quotaUsed', 0);
    }
}
