// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChatProvider } from './chatProvider';
import { getWebviewContent } from './webviewContent';

// Global variables
let chatWebviewPanel: vscode.WebviewPanel | undefined = undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rovo-dev-gui" is now active!');

	// Create chat provider for the sidebar
	const chatProvider = new ChatProvider();
	vscode.window.registerTreeDataProvider('rovoChatView', chatProvider);

	// Register commands
	const helloWorldDisposable = vscode.commands.registerCommand('rovo-dev-gui.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Rovo Dev GUI!');
	});

	const openChatDisposable = vscode.commands.registerCommand('rovo-dev-gui.openChat', () => {
		openChatPanel(context);
	});

	context.subscriptions.push(helloWorldDisposable, openChatDisposable);
}

function openChatPanel(context: vscode.ExtensionContext) {
	// If panel already exists, reveal it
	if (chatWebviewPanel) {
		chatWebviewPanel.reveal(vscode.ViewColumn.Two);
		return;
	}

	// Create new webview panel
	chatWebviewPanel = vscode.window.createWebviewPanel(
		'rovoChatPanel',
		'Rovo AI Chat',
		vscode.ViewColumn.Two,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources')]
		}
	);

	// Set the webview content
	chatWebviewPanel.webview.html = getWebviewContent(chatWebviewPanel.webview, context.extensionUri);

	// Handle messages from the webview
	chatWebviewPanel.webview.onDidReceiveMessage(
		message => {
			switch (message.type) {
				case 'chatMessage':
					handleChatMessage(message.text, message.timestamp);
					break;
				case 'requestStatus':
					sendStatusUpdate();
					break;
				default:
					console.log('Unknown message type:', message.type);
			}
		},
		undefined,
		context.subscriptions
	);

	// Handle panel disposal
	chatWebviewPanel.onDidDispose(
		() => {
			chatWebviewPanel = undefined;
		},
		null,
		context.subscriptions
	);

	// Send initial status
	setTimeout(() => {
		sendStatusUpdate();
	}, 100);
}

function handleChatMessage(text: string, timestamp: number) {
	console.log('Received chat message:', text);
	
	// For now, just echo the message back as a simple test
	// In Phase 2, this will be sent to the CLI process
	setTimeout(() => {
		if (chatWebviewPanel) {
			chatWebviewPanel.webview.postMessage({
				type: 'cliResponse',
				content: `Echo: ${text}`,
				timestamp: Date.now()
			});
		}
	}, 1000); // Simulate processing delay
}

function sendStatusUpdate() {
	if (chatWebviewPanel) {
		chatWebviewPanel.webview.postMessage({
			type: 'statusUpdate',
			connected: true, // For now, always connected in Phase 1
			cliStatus: 'Ready (Mock Mode)'
		});
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
