import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Get URIs for CSS and JS files
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'chat.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'chat.js'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Rovo AI Chat</title>
</head>
<body>
    <div id="chat-container">
        <div id="status-bar">
            <span id="connection-status">● Disconnected</span>
            <span id="cli-status">CLI: Not Started</span>
        </div>
        <div id="messages-area">
            <div class="welcome-message">
                <h3>Welcome to Rovo AI Chat</h3>
                <p>Start chatting with your AI assistant. Messages will be processed through the CLI backend.</p>
            </div>
        </div>
        <div id="input-area">
            <div id="input-container">
                <input type="text" id="message-input" placeholder="Type your message..." disabled>
                <button id="send-button" disabled>
                    <span>Send</span>
                </button>
            </div>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
}