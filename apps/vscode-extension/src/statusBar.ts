import * as vscode from 'vscode';

type StatusType = 'ready' | 'loading' | 'warning' | 'error';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'youtubeMcp.showQuotaStatus';
        this.setStatus('ready', 'YouTube MCP');
        this.statusBarItem.show();
    }

    setStatus(type: StatusType, message: string): void {
        const icons: Record<StatusType, string> = {
            ready: '$(play-circle)',
            loading: '$(sync~spin)',
            warning: '$(warning)',
            error: '$(error)'
        };

        this.statusBarItem.text = `${icons[type]} ${message}`;

        switch (type) {
            case 'error':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case 'warning':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            default:
                this.statusBarItem.backgroundColor = undefined;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
