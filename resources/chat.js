// Get VS Code API
const vscode = acquireVsCodeApi();

// DOM elements
const messagesArea = document.getElementById('messages-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');
const cliStatus = document.getElementById('cli-status');
const modelSessionUsage = document.getElementById('model-session-usage');
const modelTokenUsage = document.getElementById('model-token-usage');
const modelName = document.getElementById('model-name');

// State
let isConnected = false;
let isLoading = false;

// Initialize the chat interface
function init() {
    setupEventListeners();
    updateConnectionStatus(false);
    
    // Request initial status from extension
    vscode.postMessage({
        type: 'requestStatus'
    });
}

function setupEventListeners() {
    // Send button click
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea based on content
    messageInput.addEventListener('input', autoResizeTextarea);

    // Add CLI control buttons
    addCLIControlButtons();
    
    // Listen for messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data;
        handleMessageFromExtension(message);
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isLoading || !isConnected) {
        return;
    }
    
    // Add user message to chat
    addMessage('user', text);
    
    // Clear input
    messageInput.value = '';
    
    // Show loading state
    setLoading(true);
    
    // Send message to extension
    vscode.postMessage({
        type: 'chatMessage',
        text: text,
        timestamp: Date.now()
    });
}

function handleMessageFromExtension(message) {
    console.log('Received message from extension:', message);
    
    switch (message.type) {
        case 'cliResponse':
            setLoading(false);
            addMessage('assistant', message.content);
            break;
            
        case 'error':
            setLoading(false);
            addErrorMessage(message.content);
            break;
            
        case 'statusUpdate':
            updateConnectionStatus(message.connected);
            updateCliStatus(message.cliStatus);
            break;
            
        case 'connected':
            updateConnectionStatus(true);
            removeWelcomeMessage();
            break;
            
        case 'disconnected':
            updateConnectionStatus(false);
            setLoading(false);
            break;

        case 'modelUsageChange':
            updateModelUsage(message.usage);
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
}

function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    // 處理換行符 - 將 \n 轉換為 <br> 標籤
    const formattedContent = content.replace(/\n/g, '<br>');
    bubbleDiv.innerHTML = formattedContent;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timeDiv);
    
    // Remove welcome message if it exists
    removeWelcomeMessage();
    
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function addErrorMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant error';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.style.backgroundColor = 'var(--vscode-errorForeground)';
    bubbleDiv.style.color = 'var(--vscode-editor-background)';
    
    // 處理錯誤訊息中的換行符
    const formattedContent = (`Error: ${content}`).replace(/\n/g, '<br>');
    bubbleDiv.innerHTML = formattedContent;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(timeDiv);
    
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function setLoading(loading) {
    isLoading = loading;
    
    if (loading) {
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.className = 'message assistant';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'loading-message';
        
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'loading-dots';
        dotsDiv.innerHTML = '<span></span><span></span><span></span>';
        
        bubbleDiv.appendChild(dotsDiv);
        loadingDiv.appendChild(bubbleDiv);
        
        messagesArea.appendChild(loadingDiv);
        scrollToBottom();
        
        // Disable input
        messageInput.disabled = true;
        sendButton.disabled = true;
    } else {
        // Remove loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Enable input if connected
        if (isConnected) {
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
        connectionStatus.textContent = '● Connected';
        connectionStatus.className = 'connected';
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    } else {
        connectionStatus.textContent = '● Disconnected';
        connectionStatus.className = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
    }
}

function updateModelUsage(usage) {
    if (usage.session_context_string) {
        modelSessionUsage.textContent = `Session: ${usage.session_context_string}`;
    } else if (usage.token_usage_string) {
        modelTokenUsage.textContent = `Tokens: ${usage.token_usage_string}`;
    } else if (usage.current_model) {
        modelName.textContent = `Model: ${usage.current_model}`;
    }
}

function updateCliStatus(status) {
    cliStatus.textContent = `CLI: ${status}`;
}

function removeWelcomeMessage() {
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function autoResizeTextarea() {
    // Reset height to get the correct scrollHeight
    messageInput.style.height = 'auto';
    
    // Calculate the new height
    const maxHeight = parseFloat(getComputedStyle(messageInput).maxHeight);
    const newHeight = Math.min(messageInput.scrollHeight, maxHeight);
    
    // Set the new height
    messageInput.style.height = newHeight + 'px';
}

function addCLIControlButtons() {
    // 在狀態欄添加 CLI 控制按鈕
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'cli-controls';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '8px';

        const startButton = document.createElement('button');
        startButton.id = 'start-cli-button';
        startButton.textContent = 'Start CLI';
        startButton.onclick = () => {
            vscode.postMessage({
                type: 'startCLI',
                timestamp: Date.now()
            });
        };

        const stopButton = document.createElement('button');
        stopButton.id = 'stop-cli-button';
        stopButton.textContent = 'Stop CLI';
        stopButton.onclick = () => {
            vscode.postMessage({
                type: 'stopCLI',
                timestamp: Date.now()
            });
        };

        controlsDiv.appendChild(startButton);
        controlsDiv.appendChild(stopButton);
        statusBar.appendChild(controlsDiv);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}