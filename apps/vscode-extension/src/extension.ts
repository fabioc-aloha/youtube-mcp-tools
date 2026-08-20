import * as vscode from 'vscode';
import { YouTubeApiClient, VideoAnalysis } from './mcpClient';
import { SearchResultsProvider } from './views/searchResults';
import { RecentVideosProvider } from './views/recentVideos';
import { FlashcardsProvider } from './views/flashcards';
import { StatusBarManager } from './statusBar';

let apiClient: YouTubeApiClient;
let statusBar: StatusBarManager;
let searchResultsProvider: SearchResultsProvider;
let recentVideosProvider: RecentVideosProvider;
let flashcardsProvider: FlashcardsProvider;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('YouTube MCP Tools');
    outputChannel.appendLine('YouTube MCP Tools extension activating...');

    // Initialize the in-process YouTube API client.
    // (The standalone MCP server lives in src/mcp-server/index.ts and runs
    // as a separate process when invoked via .vscode/mcp.json or npx.)
    apiClient = new YouTubeApiClient(outputChannel);
    apiClient.initializeStorage(context);

    // Initialize status bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Initialize tree view providers
    searchResultsProvider = new SearchResultsProvider();
    recentVideosProvider = new RecentVideosProvider(context.globalState);
    flashcardsProvider = new FlashcardsProvider();

    // Register tree views
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('youtubeMcp.searchResults', searchResultsProvider),
        vscode.window.registerTreeDataProvider('youtubeMcp.recentVideos', recentVideosProvider),
        vscode.window.registerTreeDataProvider('youtubeMcp.flashcards', flashcardsProvider)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('youtubeMcp.search', searchCommand),
        vscode.commands.registerCommand('youtubeMcp.analyzeVideo', analyzeVideoCommand),
        vscode.commands.registerCommand('youtubeMcp.getTranscript', getTranscriptCommand),
        vscode.commands.registerCommand('youtubeMcp.generateFlashcards', generateFlashcardsCommand),
        vscode.commands.registerCommand('youtubeMcp.showQuotaStatus', showQuotaStatusCommand),
        vscode.commands.registerCommand('youtubeMcp.openSettings', openSettingsCommand),
        vscode.commands.registerCommand('youtubeMcp.refreshHistory', refreshHistoryCommand),
        vscode.commands.registerCommand('youtubeMcp.setApiKey', setApiKeyCommand)
    );

    // Check API key on startup
    const hasApiKey = await apiClient.hasApiKey();
    if (!hasApiKey) {
        statusBar.setStatus('warning', 'API Key not configured');
        const action = await vscode.window.showWarningMessage(
            'YouTube API key not configured. Some features will be unavailable.',
            'Set API Key',
            'Learn More'
        );
        if (action === 'Set API Key') {
            vscode.commands.executeCommand('youtubeMcp.setApiKey');
        } else if (action === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://console.cloud.google.com/apis/credentials'));
        }
    } else {
        statusBar.setStatus('ready', 'Ready');
    }

    outputChannel.appendLine('YouTube MCP Tools extension activated!');
}

async function searchCommand(): Promise<void> {
    const query = await vscode.window.showInputBox({
        prompt: 'Search YouTube',
        placeHolder: 'Enter search query...'
    });

    if (!query) { return; }

    statusBar.setStatus('loading', 'Searching...');
    outputChannel.appendLine(`Searching for: ${query}`);

    try {
        const config = vscode.workspace.getConfiguration('youtubeMcp');
        const maxResults = config.get<number>('maxResults', 10);

        const results = await apiClient.search(query, maxResults);
        searchResultsProvider.setResults(results);
        statusBar.setStatus('ready', `Found ${results.length} results`);

        // Focus the search results view
        vscode.commands.executeCommand('youtubeMcp.searchResults.focus');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed';
        statusBar.setStatus('error', message);
        vscode.window.showErrorMessage(`Search failed: ${message}`);
    }
}

async function analyzeVideoCommand(videoId?: string): Promise<void> {
    if (!videoId) {
        videoId = await vscode.window.showInputBox({
            prompt: 'Enter YouTube Video ID or URL',
            placeHolder: 'dQw4w9WgXcQ or https://youtube.com/watch?v=...'
        });
    }

    if (!videoId) { return; }

    // Extract video ID from URL if needed
    videoId = extractVideoId(videoId);

    statusBar.setStatus('loading', 'Analyzing...');
    outputChannel.appendLine(`Analyzing video: ${videoId}`);

    try {
        const analysis = await apiClient.analyzeVideo(videoId);

        // Add to recent videos
        recentVideosProvider.addVideo({
            id: videoId,
            title: analysis.title || videoId,
            channelTitle: analysis.channelTitle || 'Unknown',
            analyzedAt: new Date().toISOString()
        });

        // Show analysis in a new editor
        const doc = await vscode.workspace.openTextDocument({
            content: formatAnalysis(analysis),
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);

        statusBar.setStatus('ready', 'Analysis complete');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed';
        statusBar.setStatus('error', message);
        vscode.window.showErrorMessage(`Analysis failed: ${message}`);
    }
}

async function getTranscriptCommand(videoId?: string): Promise<void> {
    if (!videoId) {
        videoId = await vscode.window.showInputBox({
            prompt: 'Enter YouTube Video ID or URL',
            placeHolder: 'dQw4w9WgXcQ'
        });
    }

    if (!videoId) { return; }
    videoId = extractVideoId(videoId);

    statusBar.setStatus('loading', 'Fetching transcript...');

    try {
        const transcript = await apiClient.getTranscript(videoId);

        const doc = await vscode.workspace.openTextDocument({
            content: transcript,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);

        statusBar.setStatus('ready', 'Transcript loaded');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get transcript';
        statusBar.setStatus('error', message);
        vscode.window.showErrorMessage(`Transcript failed: ${message}`);
    }
}

async function generateFlashcardsCommand(videoId?: string): Promise<void> {
    if (!videoId) {
        videoId = await vscode.window.showInputBox({
            prompt: 'Enter YouTube Video ID or URL',
            placeHolder: 'dQw4w9WgXcQ'
        });
    }

    if (!videoId) { return; }
    videoId = extractVideoId(videoId);

    statusBar.setStatus('loading', 'Generating flashcards...');

    try {
        const flashcards = await apiClient.generateFlashcards(videoId);
        flashcardsProvider.setFlashcards(flashcards);

        // Focus the flashcards view
        vscode.commands.executeCommand('youtubeMcp.flashcards.focus');
        statusBar.setStatus('ready', `Generated ${flashcards.length} flashcards`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate flashcards';
        statusBar.setStatus('error', message);
        vscode.window.showErrorMessage(`Flashcard generation failed: ${message}`);
    }
}

async function showQuotaStatusCommand(): Promise<void> {
    try {
        const quota = await apiClient.getQuotaStatus();
        const message = `YouTube API Quota\n\nUsed: ${quota.used} / ${quota.limit}\nRemaining: ${quota.remaining}\nResets: ${quota.resetsAt}`;
        vscode.window.showInformationMessage(message, { modal: true });
    } catch {
        vscode.window.showErrorMessage('Failed to get quota status');
    }
}

function openSettingsCommand(): void {
    vscode.commands.executeCommand('workbench.action.openSettings', 'youtubeMcp');
}

function refreshHistoryCommand(): void {
    recentVideosProvider.refresh();
}

async function setApiKeyCommand(): Promise<void> {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your YouTube Data API v3 key',
        placeHolder: 'AIza...',
        password: true, // Hide the input
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (!value.startsWith('AIza') && value.length < 30) {
                return 'This doesn\'t look like a valid YouTube API key';
            }
            return null;
        }
    });

    if (!apiKey) { return; }

    statusBar.setStatus('loading', 'Validating API key...');

    try {
        // Validate the API key
        const validation = await apiClient.validateApiKey(apiKey.trim());

        if (!validation.valid) {
            statusBar.setStatus('error', 'Invalid API key');
            vscode.window.showErrorMessage(`API key validation failed: ${validation.error}`);
            return;
        }

        // Store securely
        await apiClient.setApiKey(apiKey.trim());
        statusBar.setStatus('ready', 'API key saved');

        if (validation.error) {
            // Valid but with warning (e.g., quota exceeded)
            vscode.window.showWarningMessage(`API key saved. Note: ${validation.error}`);
        } else {
            vscode.window.showInformationMessage('YouTube API key saved securely!');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save API key';
        statusBar.setStatus('error', message);
        vscode.window.showErrorMessage(message);
    }
}

function extractVideoId(input: string): string {
    // Handle full URLs
    const urlPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of urlPatterns) {
        const match = input.match(pattern);
        if (match) { return match[1]; }
    }

    return input;
}

function formatAnalysis(analysis: VideoAnalysis): string {
    const formatNumber = (n: number | undefined): string => n ? n.toLocaleString() : 'N/A';
    const formatDuration = (d: string | undefined): string => {
        if (!d) { return 'N/A'; }
        // Parse ISO 8601 duration (PT1H2M3S)
        const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) { return d; }
        const [, h, m, s] = match;
        const parts = [];
        if (h) { parts.push(`${h}h`); }
        if (m) { parts.push(`${m}m`); }
        if (s) { parts.push(`${s}s`); }
        return parts.join(' ') || 'N/A';
    };

    let md = `# ${analysis.title || 'Video Analysis'}

**Channel:** ${analysis.channelTitle || 'Unknown'}
**Duration:** ${formatDuration(analysis.duration)}
**Views:** ${formatNumber(analysis.viewCount)} | **Likes:** ${formatNumber(analysis.likeCount)}

---

## Summary
${analysis.summary?.brief || 'No summary available'}

### Detailed
${analysis.summary?.detailed || 'No detailed summary available'}

## Key Points
${(analysis.summary?.keyPoints || []).map((p: string) => `- ${p}`).join('\n') || 'None identified'}

## Topics
${(analysis.summary?.topics || []).map((t: string) => `\`${t}\``).join(' • ') || 'None identified'}
`;

    // Add concepts if available
    const concepts = analysis.concepts;
    if (concepts?.concepts && concepts.concepts.length > 0) {
        md += `\n## Key Concepts\n`;
        md += `**Difficulty:** ${concepts.difficulty || 'Unknown'}\n\n`;

        for (const concept of concepts.concepts.slice(0, 10)) {
            md += `### ${concept.name}\n`;
            if (concept.definition) {
                md += `${concept.definition}\n`;
            }
            md += `*Type: ${concept.type} | Mentions: ${concept.mentions}*\n\n`;
        }

        if (concepts.prerequisites && concepts.prerequisites.length > 0) {
            md += `**Prerequisites:** ${concepts.prerequisites.join(', ')}\n`;
        }
    }

    // Add quality signals (v0.3.0+ — observable signals, not opaque scores)
    const q = analysis.quality;
    if (q) {
        md += `\n## Quality Signals\n`;
        md += `| Signal | Value |\n|--------|-------|\n`;
        md += `| Has captions | ${q.hasCaptions ? 'yes' : 'no'} |\n`;
        md += `| Word count | ${q.wordCount.toLocaleString()} |\n`;
        md += `| Avg sentence length | ${q.avgSentenceLength} words |\n`;
        md += `| Engagement (likes/views) | ${(q.engagementRatio * 100).toFixed(2)}% |\n`;
        md += `| Transcript segments | ${q.transcriptSegmentCount} |\n`;
        md += `\n*These are observable signals, not opinion scores. Interpret per your use case.*\n`;
    }

    md += `\n---\n*Generated by YouTube MCP Tools v0.3.0*\n`;

    return md;
}

export function deactivate(): void {
    outputChannel?.dispose();
}
