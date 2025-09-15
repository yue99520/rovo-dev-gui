// Get VS Code API
const vscode = acquireVsCodeApi();

// DOM elements
const messagesArea = document.getElementById('messages-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');
const cliStatus = document.getElementById('cli-status');

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
    
    // Enter key in input
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
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
            
        default:
            console.log('Unknown message type:', message.type);
    }
}

function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;
    
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
    bubbleDiv.textContent = `Error: ${content}`;
    
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

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}