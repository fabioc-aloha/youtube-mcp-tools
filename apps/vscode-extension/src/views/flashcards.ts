import * as vscode from 'vscode';
import { Flashcard } from '../mcpClient';

export class FlashcardsProvider implements vscode.TreeDataProvider<FlashcardItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FlashcardItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private flashcards: Flashcard[] = [];

    setFlashcards(flashcards: Flashcard[]): void {
        this.flashcards = flashcards;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: FlashcardItem): vscode.TreeItem {
        return element;
    }

    getChildren(): FlashcardItem[] {
        if (this.flashcards.length === 0) {
            return [new FlashcardItem('No flashcards', '', 'empty')];
        }
        return this.flashcards.map(f => new FlashcardItem(f.front, f.back, f.difficulty));
    }
}

class FlashcardItem extends vscode.TreeItem {
    constructor(
        front: string,
        back: string,
        difficulty: string
    ) {
        super(front, vscode.TreeItemCollapsibleState.None);

        if (difficulty === 'empty') {
            this.iconPath = new vscode.ThemeIcon('note');
            this.description = 'Use "Generate Flashcards" on a video';
        } else {
            const icons: Record<string, string> = {
                easy: 'circle-filled',
                medium: 'circle-outline',
                hard: 'circle-slash'
            };
            this.iconPath = new vscode.ThemeIcon(icons[difficulty] || 'note');
            this.tooltip = `Answer: ${back}`;
            this.description = difficulty;
        }
    }
}
