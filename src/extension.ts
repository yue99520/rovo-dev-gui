// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChatProvider } from './chatProvider';
import { getWebviewContent } from './webviewContent';
import { CLIManager, CLIStatus, CLIManagerEvents, ModelUsage } from './cliManager';

// Global variables
let chatWebviewPanel: vscode.WebviewPanel | undefined = undefined;
let cliManager: CLIManager | undefined = undefined;

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

	// 初始化 CLI Manager
	initializeCLIManager();
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
				case 'startCLI':
					startCLI();
					break;
				case 'stopCLI':
					stopCLI();
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

	// 發送訊息到 CLI 程序
	if (cliManager && cliManager.isRunning()) {
		const success = cliManager.sendMessage(text);
		if (!success) {
			// 如果發送失敗，顯示錯誤訊息
			if (chatWebviewPanel) {
				chatWebviewPanel.webview.postMessage({
					type: 'error',
					content: 'Failed to send message to CLI process',
					timestamp: Date.now()
				});
			}
		}
	} else {
		// CLI 未運行，嘗試啟動
		if (chatWebviewPanel) {
			chatWebviewPanel.webview.postMessage({
				type: 'error',
				content: 'CLI process not running. Please start the CLI first.',
				timestamp: Date.now()
			});
		}
	}
}

function sendStatusUpdate() {
	if (chatWebviewPanel) {
		const isConnected = cliManager ? cliManager.isRunning() : false;
		const status = cliManager ? cliManager.getStatus() : CLIStatus.NOT_STARTED;

		chatWebviewPanel.webview.postMessage({
			type: 'statusUpdate',
			connected: isConnected,
			cliStatus: status
		});
	}
}

function initializeCLIManager() {
	const events: CLIManagerEvents = {
		onOutput: (data: string) => {
			// 將 CLI 輸出發送到聊天介面
			if (chatWebviewPanel) {
				chatWebviewPanel.webview.postMessage({
					type: 'cliResponse',
					content: data.trim(),
					timestamp: Date.now()
				});
			}
		},
		onError: (error: string) => {
			// 將 CLI 錯誤發送到聊天介面
			if (chatWebviewPanel) {
				chatWebviewPanel.webview.postMessage({
					type: 'error',
					content: error.trim(),
					timestamp: Date.now()
				});
			}
		},
		onStatusChange: (status: CLIStatus) => {
			// 更新狀態顯示
			sendStatusUpdate();
		},
		onModelUsageChange: (usage: ModelUsage) => {
			if (chatWebviewPanel) {
				chatWebviewPanel.webview.postMessage({
					type: 'modelUsageChange',
					usage: usage,
				});
			}
		}
	};

	cliManager = new CLIManager(events);
}

async function startCLI() {
	if (!cliManager) {
		console.error('CLI Manager not initialized');
		return;
	}

	if (cliManager.isRunning()) {
		console.log('CLI already running');
		return;
	}

	const success = await cliManager.start();
	if (success) {
		if (chatWebviewPanel) {
			chatWebviewPanel.webview.postMessage({
				type: 'cliResponse',
				content: 'Starting acli rovodev run...',
				timestamp: Date.now()
			});
		}
	} else {
		if (chatWebviewPanel) {
			chatWebviewPanel.webview.postMessage({
				type: 'error',
				content: 'Failed to start CLI process. Make sure "acli" is installed and accessible.',
				timestamp: Date.now()
			});
		}
	}
}

function stopCLI() {
	if (!cliManager) {
		console.error('CLI Manager not initialized');
		return;
	}

	cliManager.stop().then((success) => {
		if (chatWebviewPanel) {
			if (success) {
				chatWebviewPanel.webview.postMessage({
					type: 'cliResponse',
					content: 'CLI process stopped.',
					timestamp: Date.now()
				});
			}
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (cliManager) {
		cliManager.dispose();
	}
}
