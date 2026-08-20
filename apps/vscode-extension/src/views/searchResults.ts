import * as vscode from 'vscode';
import { VideoSearchResult } from '../mcpClient';

export class SearchResultsProvider implements vscode.TreeDataProvider<VideoItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<VideoItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private results: VideoSearchResult[] = [];

    setResults(results: VideoSearchResult[]): void {
        this.results = results;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: VideoItem): vscode.TreeItem {
        return element;
    }

    getChildren(): VideoItem[] {
        if (this.results.length === 0) {
            return [new VideoItem('No results', 'Use "YouTube MCP: Search" to find videos', '', 'info')];
        }
        return this.results.map(r => new VideoItem(r.title, r.channelTitle, r.id, 'video'));
    }
}

class VideoItem extends vscode.TreeItem {
    constructor(
        public readonly title: string,
        public readonly subtitle: string,
        public readonly videoId: string,
        type: 'video' | 'info'
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.description = subtitle;

        if (type === 'video') {
            this.iconPath = new vscode.ThemeIcon('play');
            this.contextValue = 'video';
            this.command = {
                command: 'youtubeMcp.analyzeVideo',
                title: 'Analyze Video',
                arguments: [videoId]
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
