import * as vscode from 'vscode';

export class ChatProvider implements vscode.TreeDataProvider<ChatItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChatItem | undefined | null | void> = new vscode.EventEmitter<ChatItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChatItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChatItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ChatItem): Thenable<ChatItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                new ChatItem('Start Chat Session', vscode.TreeItemCollapsibleState.None, 'start-chat'),
                new ChatItem('Chat History', vscode.TreeItemCollapsibleState.Collapsed, 'history')
            ]);
        } else if (element.contextValue === 'history') {
            // Return chat history items (empty for now)
            return Promise.resolve([]);
        }
        return Promise.resolve([]);
    }
}

export class ChatItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        
        if (contextValue === 'start-chat') {
            this.command = {
                command: 'rovo-dev-gui.openChat',
                title: 'Open Chat',
                arguments: []
            };
            this.iconPath = new vscode.ThemeIcon('comment-discussion');
        }
    }
}