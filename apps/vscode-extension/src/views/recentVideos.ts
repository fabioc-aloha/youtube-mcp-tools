import * as vscode from 'vscode';

interface RecentVideo {
    id: string;
    title: string;
    channelTitle: string;
    analyzedAt: string;
}

export class RecentVideosProvider implements vscode.TreeDataProvider<RecentVideoItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<RecentVideoItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private videos: RecentVideo[] = [];
    private storage: vscode.Memento;

    constructor(globalState: vscode.Memento) {
        this.storage = globalState;
        this.videos = globalState.get('recentVideos', []);
    }

    addVideo(video: RecentVideo): void {
        // Remove if already exists
        this.videos = this.videos.filter(v => v.id !== video.id);
        // Add to front
        this.videos.unshift(video);
        // Keep only last 20
        this.videos = this.videos.slice(0, 20);
        // Save
        this.storage.update('recentVideos', this.videos);
        this._onDidChangeTreeData.fire(undefined);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: RecentVideoItem): vscode.TreeItem {
        return element;
    }

    getChildren(): RecentVideoItem[] {
        if (this.videos.length === 0) {
            return [new RecentVideoItem('No recent videos', '', '', true)];
        }
        return this.videos.map(v => new RecentVideoItem(v.title, v.channelTitle, v.id, false));
    }
}

class RecentVideoItem extends vscode.TreeItem {
    constructor(
        title: string,
        subtitle: string,
        videoId: string,
        isEmpty: boolean
    ) {
        super(title, vscode.TreeItemCollapsibleState.None);
        this.description = subtitle;

        if (isEmpty) {
            this.iconPath = new vscode.ThemeIcon('history');
        } else {
            this.iconPath = new vscode.ThemeIcon('play');
            this.contextValue = 'recentVideo';
            this.command = {
                command: 'youtubeMcp.analyzeVideo',
                title: 'Analyze Video',
                arguments: [videoId]
            };
        }
    }
}
