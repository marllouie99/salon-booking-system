/**
 * Chat System JavaScript - Real-time Customer-Salon Communication
 */

// Ensure API_BASE_URL is defined (fallback if config.js hasn't loaded yet)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://web-production-e6265.up.railway.app';
    console.warn('⚠️ API_BASE_URL was undefined in chat.js, using fallback:', window.API_BASE_URL);
}

// Refresh access token if needed
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        console.log('No refresh token found, redirecting to login...');
        return null;
    }
    
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh: refreshToken })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            console.log('Access token refreshed successfully');
            return data.access;
        } else {
            console.error('Failed to refresh token, status:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
    }
}

// Make authenticated API call with automatic token refresh
async function authenticatedFetch(url, options = {}) {
    let accessToken = localStorage.getItem('access_token');
    
    if (!accessToken) {
        console.log('No access token, attempting to refresh...');
        accessToken = await refreshAccessToken();
        if (!accessToken) {
            throw new Error('Authentication required. Please log in.');
        }
    }
    
    // Add authorization header
    if (!options.headers) {
        options.headers = {};
    }
    options.headers['Authorization'] = `Bearer ${accessToken}`;
    
    // Only set Content-Type if not uploading files (FormData sets it automatically)
    if (!options.isFormData && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    
    // Remove the isFormData flag before sending
    delete options.isFormData;
    
    // Try the request
    let response = await fetch(url, options);
    
    // If 401, refresh token and retry once
    if (response.status === 401) {
        console.log('Received 401, token expired. Refreshing...');
        accessToken = await refreshAccessToken();
        
        if (accessToken) {
            options.headers['Authorization'] = `Bearer ${accessToken}`;
            response = await fetch(url, options);
        } else {
            throw new Error('Session expired. Please log in again.');
        }
    }
    
    return response;
}

class ChatManager {
    constructor() {
        this.chatContainer = null;
        this.messagesContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.chatToggle = null;
        this.currentChatId = null;
        this.currentSalonId = null;
        this.currentSalonName = '';
        this.isMinimized = true;
        this.unreadCount = 0;
        this.pollingInterval = null;
        this.userType = 'customer'; // 'customer' or 'salon'
        this.typingTimeout = null;
        this.isTyping = false;
        
        this.init();
    }
    
    init() {
        this.createChatUI();
        this.bindEvents();
        this.startPolling();
    }
    
    createChatUI() {
        // Create chat toggle button
        this.chatToggle = document.createElement('button');
        this.chatToggle.className = 'chat-toggle';
        this.chatToggle.innerHTML = '<i class="fas fa-comments"></i>';
        this.chatToggle.onclick = () => this.toggleChat();
        document.body.appendChild(this.chatToggle);
        
        // Create chat container
        this.chatContainer = document.createElement('div');
        this.chatContainer.className = 'chat-container hidden';
        // Get user type for header
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        const isSalonOwner = userData.user_type === 'salon_owner';
        
        this.chatContainer.innerHTML = `
            <div class="chat-header">
                <div>
                    <h3 id="chatTitle">Chat</h3>
                    ${isSalonOwner ? '<small style="font-size: 0.7rem; opacity: 0.8;">Browsing as Salon Owner</small>' : ''}
                </div>
                <div class="chat-header-actions">
                    ${isSalonOwner ? '<button class="chat-btn chat-switch-btn" onclick="if(window.salonChatManager){window.salonChatManager.showChat();}" title="Switch to Salon Owner View (Customer Messages)"><i class="fas fa-store"></i></button>' : ''}
                    <button class="chat-btn" onclick="window.activeChatManager.minimizeChat()" title="Minimize">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="chat-btn" onclick="window.activeChatManager.closeChat()" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-empty">
                    <i class="fas fa-comments"></i>
                    <h3>No Chat Selected</h3>
                    <p>Select a salon to start chatting</p>
                </div>
            </div>
            <div class="typing-indicator" id="typingIndicator" style="display: none;">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="chat-input" id="chatInput" style="display: none;">
                <input type="file" id="fileInput" accept="image/*,image/gif" style="display: none;">
                <button class="chat-attachment-btn" id="attachmentButton" title="Attach image">
                    <i class="fas fa-paperclip"></i>
                </button>
                <button class="chat-gif-btn" id="gifButton" title="Search GIFs">
                    <i class="fas fa-gift"></i>
                </button>
                <button class="chat-sticker-btn" id="stickerButton" title="Send Stickers">
                    <i class="fas fa-smile"></i>
                </button>
                <textarea class="chat-input-field" id="messageInput" placeholder="Type your message..." rows="1"></textarea>
                <button class="chat-send-btn" id="sendButton">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
            <div class="gif-picker" id="gifPicker" style="display: none;">
                <div class="gif-picker-header">
                    <input type="text" id="gifSearchInput" placeholder="Search GIFs..." class="gif-search-input">
                    <button class="gif-close-btn" onclick="window.activeChatManager.closeGifPicker()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="gif-results" id="gifResults">
                    <div class="gif-loading">Search for GIFs...</div>
                </div>
            </div>
            <div class="gif-picker" id="stickerPicker" style="display: none;">
                <div class="gif-picker-header">
                    <input type="text" id="stickerSearchInput" placeholder="Search Stickers..." class="gif-search-input">
                    <button class="gif-close-btn" onclick="window.activeChatManager.closeStickerPicker()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="gif-results" id="stickerResults">
                    <div class="gif-loading">Search for Stickers...</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.chatContainer);
        
        // Get references
        this.messagesContainer = document.getElementById('chatMessages');
        this.inputField = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.fileInput = document.getElementById('fileInput');
        this.attachmentButton = document.getElementById('attachmentButton');
        this.gifButton = document.getElementById('gifButton');
        this.gifPicker = document.getElementById('gifPicker');
        this.gifSearchInput = document.getElementById('gifSearchInput');
        this.gifResults = document.getElementById('gifResults');
        this.stickerButton = document.getElementById('stickerButton');
        this.stickerPicker = document.getElementById('stickerPicker');
        this.stickerSearchInput = document.getElementById('stickerSearchInput');
        this.stickerResults = document.getElementById('stickerResults');
        
        // Auto-resize textarea
        this.inputField.addEventListener('input', this.autoResize);
        
        // Typing indicator
        this.inputField.addEventListener('input', () => this.handleTyping());
        
        // File attachment
        this.attachmentButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // GIF picker
        this.gifButton.addEventListener('click', () => this.toggleGifPicker());
        this.gifSearchInput.addEventListener('input', (e) => this.searchGifs(e.target.value));
        
        // Sticker picker
        this.stickerButton.addEventListener('click', () => this.toggleStickerPicker());
        this.stickerSearchInput.addEventListener('input', (e) => this.searchStickers(e.target.value));
    }
    
    bindEvents() {
        // Send message on button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter (Shift+Enter for new line)
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Maximize chat when clicking header while minimized
        const chatHeader = this.chatContainer.querySelector('.chat-header');
        chatHeader.addEventListener('click', (e) => {
            // Only maximize if minimized and not clicking on buttons
            if (this.chatContainer.classList.contains('minimized') && 
                !e.target.closest('.chat-btn')) {
                this.maximizeChat();
            }
        });
        
        // Prevent closing when clicking inside chat
        this.chatContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Close chat when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.chatContainer.contains(e.target) && !this.chatToggle.contains(e.target)) {
                // Don't auto-close, just minimize
            }
        });
    }
    
    autoResize = () => {
        this.inputField.style.height = 'auto';
        this.inputField.style.height = Math.min(this.inputField.scrollHeight, 80) + 'px';
    }
    
    handleTyping() {
        if (!this.currentSalonId) return;
        
        // Clear existing timeout
        clearTimeout(this.typingTimeout);
        
        // Send typing status if not already typing
        if (!this.isTyping) {
            this.isTyping = true;
            // You can add API call here to notify salon
            console.log('User started typing');
        }
        
        // Stop typing after 2 seconds of inactivity
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            console.log('User stopped typing');
        }, 2000);
    }
    
    showTypingIndicator() {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.style.display = 'flex';
            this.scrollToBottom();
        }
    }
    
    hideTypingIndicator() {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) {
            typingEl.style.display = 'none';
        }
    }
    
    toggleChat() {
        if (this.chatContainer.classList.contains('hidden')) {
            this.showChat();
        } else if (this.chatContainer.classList.contains('minimized')) {
            this.maximizeChat();
        } else {
            this.minimizeChat();
        }
    }
    
    showChat() {
        this.chatContainer.classList.remove('hidden');
        this.chatContainer.classList.remove('minimized');
        this.chatToggle.style.display = 'none';
        this.isMinimized = false;
        
        // Load user chats if no current chat
        if (!this.currentChatId) {
            this.loadUserChats();
        }
    }
    
    showChatList() {
        // Reset current chat
        this.currentChatId = null;
        this.currentSalonId = null;
        this.currentSalonName = null;
        
        // Reset title
        document.getElementById('chatTitle').textContent = 'Your Chats';
        
        // Hide input field
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.style.display = 'none';
        }
        
        // Load chat list
        this.loadUserChats();
    }
    
    minimizeChat() {
        this.chatContainer.classList.add('minimized');
        this.chatToggle.style.display = 'block';
        this.isMinimized = true;
    }
    
    maximizeChat() {
        this.chatContainer.classList.remove('minimized');
        if (this.chatToggle) {
            this.chatToggle.style.display = 'none';
        }
        this.isMinimized = false;
        
        // Reload current chat if we have one
        if (this.currentChatId && this.currentSalonId) {
            this.openChat(this.currentChatId, this.currentSalonId, this.currentSalonName);
        }
    }
    
    closeChat() {
        this.chatContainer.classList.add('hidden');
        this.chatToggle.style.display = 'block';
        this.isMinimized = true;
    }
    
    async loadUserChats() {
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/chats/');
            const data = await response.json();
            
            if (response.ok) {
                this.displayChatList(data.chats);
            } else {
                this.showError(data.error || 'Failed to load chats');
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            if (error.message.includes('Authentication required') || error.message.includes('Session expired')) {
                this.showError('Please log in to use chat');
            } else {
                this.showError('Connection error');
            }
        }
    }
    
    displayChatList(chats) {
        if (chats.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-comments"></i>
                    <h3>No Chats Yet</h3>
                    <p>Start a conversation with a salon from their profile page</p>
                </div>
            `;
            return;
        }
        
        const chatListHTML = chats.map(chat => `
            <div class="chat-item" data-chat-id="${chat.id}" data-salon-id="${chat.salon.id}" data-salon-name="${chat.salon.name}">
                <div class="chat-item-info">
                    <div class="chat-item-name">${chat.salon.name}</div>
                    <div class="chat-item-last-message">
                        ${chat.last_message ? 
                            (chat.last_message.sender_type === 'customer' ? 'You: ' : '') + 
                            this.truncateText(chat.last_message.content, 30) 
                            : 'No messages yet'}
                    </div>
                </div>
                <div class="chat-item-meta">
                    <div class="chat-item-time">
                        ${chat.last_message ? this.formatTime(chat.last_message.sent_at) : ''}
                    </div>
                    ${chat.unread_count > 0 ? `<div class="chat-item-unread">${chat.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        this.messagesContainer.innerHTML = `
            <div class="chat-list">
                ${chatListHTML}
            </div>
        `;
        
        // Add click event listeners to chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = parseInt(item.dataset.chatId);
                const salonId = parseInt(item.dataset.salonId);
                const salonName = item.dataset.salonName;
                this.openChat(chatId, salonId, salonName);
            });
        });
        
        document.getElementById('chatTitle').textContent = 'Your Chats';
        document.getElementById('chatInput').style.display = 'none';
        
        // Update total unread count
        this.unreadCount = chats.reduce((total, chat) => total + chat.unread_count, 0);
        this.updateUnreadBadge();
    }
    
    async openChat(chatId, salonId, salonName) {
        console.log('Opening chat - chatId:', chatId, 'salonId:', salonId, 'salonName:', salonName);
        this.currentChatId = chatId;
        this.currentSalonId = salonId;
        this.currentSalonName = salonName;
        
        // Show chat window
        this.chatContainer.classList.remove('hidden');
        this.chatContainer.classList.remove('minimized');
        this.chatToggle.style.display = 'none';
        this.isMinimized = false;
        
        // Update title with back button
        const titleElement = document.getElementById('chatTitle');
        titleElement.innerHTML = `
            <button class="chat-back-btn" onclick="window.activeChatManager.showChatList()" title="Back to chat list">
                <i class="fas fa-arrow-left"></i>
            </button>
            ${salonName}
        `;
        
        document.getElementById('chatInput').style.display = 'flex';
        
        this.showLoading();
        
        try {
            const apiUrl = `${window.API_BASE_URL}/api/bookings/chat/${salonId}/`;
            console.log('Fetching messages from:', apiUrl);
            
            const response = await authenticatedFetch(apiUrl, {
                method: 'GET'
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            console.log('Messages received:', data.messages);
            
            if (response.ok) {
                this.displayMessages(data.messages);
                if (data.chat) {
                    this.currentChatId = data.chat.id;
                    console.log('Chat ID set to:', this.currentChatId);
                }
            } else {
                console.error('Error response:', data);
                this.showError(data.error || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading chat:', error);
            this.showError('Connection error');
        }
    }
    
    async startNewChat(salonId, salonName) {
        // First, check if we already have a chat with this salon
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/chats/');
            
            if (response.ok) {
                const data = await response.json();
                const chats = data.chats || [];
                console.log('All user chats:', chats);
                console.log('Looking for salon ID:', salonId, 'Type:', typeof salonId);
                
                const existingChat = chats.find(chat => {
                    console.log('Checking chat salon ID:', chat.salon.id, 'Type:', typeof chat.salon.id);
                    return chat.salon.id == salonId; // Use == for type coercion
                });
                
                if (existingChat) {
                    // Load existing conversation
                    console.log('Found existing chat, loading it...', existingChat);
                    await this.openChat(existingChat.id, salonId, salonName);
                    return;
                } else {
                    console.log('No existing chat found for this salon');
                }
            } else {
                console.error('Failed to fetch user chats:', response.status);
            }
        } catch (error) {
            console.error('Error checking for existing chat:', error);
        }
        
        // No existing chat found, create new conversation UI
        this.currentSalonId = salonId;
        this.currentSalonName = salonName;
        this.currentChatId = null;
        
        // Show chat window
        this.chatContainer.classList.remove('hidden');
        this.chatContainer.classList.remove('minimized');
        this.chatToggle.style.display = 'none';
        this.isMinimized = false;
        
        // Update title with back button
        const titleElement = document.getElementById('chatTitle');
        titleElement.innerHTML = `
            <button class="chat-back-btn" onclick="window.activeChatManager.showChatList()" title="Back to chat list">
                <i class="fas fa-arrow-left"></i>
            </button>
            ${salonName}
        `;
        
        // Show input field
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.style.display = 'flex';
        }
        
        // Clear messages and show empty conversation state
        this.messagesContainer.innerHTML = `
            <div class="chat-empty">
                <i class="fas fa-comment-dots"></i>
                <h3>Start a Conversation</h3>
                <p>Send a message to ${salonName}</p>
            </div>
        `;
        
        // Focus input
        setTimeout(() => {
            if (this.inputField) {
                this.inputField.focus();
            }
        }, 100);
    }
    
    displayMessages(messages) {
        console.log('displayMessages called with', messages.length, 'messages');
        console.log('messagesContainer:', this.messagesContainer);
        
        if (messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-comment-dots"></i>
                    <h3>Start a Conversation</h3>
                    <p>Send your first message to ${this.currentSalonName}</p>
                </div>
            `;
            return;
        }
        
        const messagesHTML = messages.map(message => {
            let contentHTML = '';
            // Check for image in multiple possible fields (image, image_url, or content for external URLs)
            const imageUrl = message.image || message.image_url;
            
            if ((message.message_type === 'image' || message.message_type === 'gif' || message.message_type === 'sticker') && imageUrl) {
                const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${window.API_BASE_URL}${imageUrl}`;
                const cssClass = message.message_type === 'sticker' ? 'chat-sticker' : 'chat-image';
                contentHTML = `<img src="${fullImageUrl}" alt="${message.message_type}" class="${cssClass}" onclick="window.open('${fullImageUrl}', '_blank')">`;
            } else if ((message.message_type === 'gif' || message.message_type === 'sticker') && message.content && message.content.startsWith('http')) {
                const cssClass = message.message_type === 'sticker' ? 'chat-sticker' : 'chat-image';
                contentHTML = `<img src="${message.content}" alt="${message.message_type}" class="${cssClass}" onclick="window.open('${message.content}', '_blank')">`;
            } else {
                contentHTML = this.escapeHtml(message.content || '[Image]');
            }
            
            // Profile picture - only show for other person's messages
            let profilePicHTML = '';
            let hasAvatar = false;
            if (message.sender_type === 'salon') {
                // Show salon's avatar in customer view
                hasAvatar = true;
                if (message.sender_profile_picture) {
                    const profileUrl = message.sender_profile_picture.startsWith('http') ? message.sender_profile_picture : `${window.API_BASE_URL}${message.sender_profile_picture}`;
                    profilePicHTML = `<img src="${profileUrl}" alt="${message.sender_name}" class="message-avatar">`;
                } else {
                    const initial = message.sender_name ? message.sender_name.charAt(0).toUpperCase() : 'S';
                    profilePicHTML = `<div class="message-avatar message-avatar-default">${initial}</div>`;
                }
            }
            
            return `
                <div class="message ${message.sender_type} ${hasAvatar ? 'has-avatar' : 'no-avatar'}">
                    ${profilePicHTML}
                    <div class="message-bubble">
                        <div class="message-content">${contentHTML}</div>
                        <div class="message-time">
                            ${this.formatTime(message.sent_at)}
                            ${message.sender_type === 'customer' && message.is_read ? '<i class="fas fa-check-double read-receipt"></i>' : ''}
                            ${message.sender_type === 'customer' && !message.is_read ? '<i class="fas fa-check read-receipt unread"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('Setting messages HTML, length:', messagesHTML.length);
        this.messagesContainer.innerHTML = messagesHTML;
        console.log('Messages container after setting HTML:', this.messagesContainer.innerHTML.substring(0, 100));
        
        // Remove salon owner view class for customer chat
        this.messagesContainer.classList.remove('salon-owner-view');
        this.scrollToBottom();
        
        // Mark messages as read
        this.markMessagesAsRead();
    }
    
    async sendMessage() {
        console.log('sendMessage called');
        const content = this.inputField.value.trim();
        console.log('Message content:', content);
        console.log('Current salon ID:', this.currentSalonId);
        
        if (!content) {
            console.log('No content, returning');
            return;
        }
        
        // Check if we have either a salon ID (customer chat) or customer ID (salon chat)
        if (!this.currentSalonId && !this.currentCustomerId) {
            console.log('No salon ID or customer ID, returning');
            alert('Please select a salon or chat first');
            return;
        }
        
        // If this is a salon chat (has currentCustomerId), use salon send function
        if (this.currentCustomerId && this.userType === 'salon') {
            this.sendSalonMessage(content);
            return;
        }
        
        console.log('Sending message to API...');
        
        // Disable send button
        this.sendButton.disabled = true;
        this.inputField.disabled = true;
        
        // Add message to UI immediately
        this.addMessageToUI('customer', content, new Date().toISOString());
        this.inputField.value = '';
        this.autoResize();
        try {
            const apiUrl = `${window.API_BASE_URL}/api/bookings/chat/${this.currentSalonId}/send/`;
            console.log('API URL:', apiUrl);
            
            const response = await authenticatedFetch(apiUrl, {
                method: 'POST',
                body: JSON.stringify({
                    content: content,
                    message_type: 'text'
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            console.log('Response data:', data);
            
            if (response.ok) {
                this.currentChatId = data.chat_id;
                console.log('Message sent successfully! Chat ID:', this.currentChatId);
                // Message already added to UI, just update with server data if needed
            } else {
                console.error('API error:', data);
                this.showError(data.error || 'Failed to send message');
                alert('Error: ' + (data.error || 'Failed to send message'));
                // Remove the message from UI on error
                this.removeLastMessage();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Connection error: ' + error.message);
            alert('Connection error: ' + error.message);
            this.removeLastMessage();
        } finally {
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.inputField.focus();
        }
    }
    
    addMessageToUI(senderType, content, sentAt) {
        // If messages container shows empty state, clear it
        if (this.messagesContainer.querySelector('.chat-empty')) {
            this.messagesContainer.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${senderType}`;
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            <div class="message-time">${this.formatTime(sentAt)}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    removeLastMessage() {
        const messages = this.messagesContainer.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }
    }
    
    showLoading() {
        this.messagesContainer.innerHTML = `
            <div class="chat-loading">
                <div class="loading-spinner"></div>
                Loading messages...
            </div>
        `;
    }
    
    showError(message) {
        this.messagesContainer.innerHTML = `
            <div class="chat-empty">
                <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    startPolling() {
        // Poll for new messages every 3 seconds when chat is active
        this.pollingInterval = setInterval(() => {
            if (this.currentChatId && !this.isMinimized) {
                this.checkForNewMessages();
            }
        }, 3000);
    }
    
    async checkForNewMessages() {
        if (!this.currentSalonId) return;
        
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/chat/${this.currentSalonId}/`, {
                method: 'GET'
            });
            
            const data = await response.json();
            
            if (response.ok && data.messages) {
                this.updateMessagesIfNew(data.messages);
            }
        } catch (error) {
            // Silently handle polling errors
            console.log('Polling error:', error);
        }
    }
    
    updateMessagesIfNew(newMessages) {
        const currentMessages = this.messagesContainer.querySelectorAll('.message');
        
        if (newMessages.length > currentMessages.length) {
            // New messages available, refresh display
            this.displayMessages(newMessages);
        }
    }
    
    updateUnreadBadge() {
        // Remove existing badge
        const existingBadge = this.chatToggle.querySelector('.unread-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Add new badge if there are unread messages
        if (this.unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-badge';
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            this.chatToggle.appendChild(badge);
            this.chatToggle.classList.add('has-unread');
        } else {
            this.chatToggle.classList.remove('has-unread');
        }
    }
    
    // Utility functions
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            return Math.floor(diff / 60000) + 'm ago';
        } else if (diff < 86400000) { // Less than 1 day
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async markMessagesAsRead() {
        if (!this.currentSalonId || !this.currentChatId) return;
        
        try {
            // Mark messages as read - need to implement proper endpoint or skip
            // await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/messages/mark-read/`, {
            //     method: 'POST'
            // });
        } catch (error) {
            console.log('Error marking messages as read:', error);
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Only image files are allowed');
            return;
        }
        
        // Preview and send
        this.sendImageMessage(file);
    }
    
    async sendImageMessage(file) {
        if (!this.currentSalonId && !this.currentCustomerId) {
            alert('Please select a salon or chat first');
            return;
        }
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('image', file);
        formData.append('content', '[Image]');
        formData.append('message_type', 'image');
        
        // Disable buttons
        this.sendButton.disabled = true;
        this.attachmentButton.disabled = true;
        
        // Show uploading indicator
        const uploadMsg = this.addMessageToUI('customer', '📤 Uploading image...', new Date().toISOString());
        
        try {
            // Choose endpoint based on user type
            const endpoint = (this.userType === 'salon' && this.currentCustomerId) 
                ? `${window.API_BASE_URL}/api/bookings/salon/chat/${this.currentCustomerId}/send/`
                : `${window.API_BASE_URL}/api/bookings/chat/${this.currentSalonId}/send/`;
                
            const response = await authenticatedFetch(endpoint, {
                method: 'POST',
                body: formData,
                isFormData: true
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Replace upload message with actual image
                this.removeLastMessage();
                // Backend returns 'image' field with the URL
                const imageUrl = data.image;
                if (imageUrl) {
                    this.addImageToUI('customer', imageUrl, data.sent_at || new Date().toISOString());
                } else {
                    console.error('No image URL in response:', data);
                    this.showError('Image uploaded but URL not found');
                }
                this.fileInput.value = ''; // Reset file input
            } else {
                this.removeLastMessage();
                this.showError(data.error || 'Failed to send image');
            }
        } catch (error) {
            console.error('Error sending image:', error);
            this.removeLastMessage();
            this.showError('Connection error');
        } finally {
            this.sendButton.disabled = false;
            this.attachmentButton.disabled = false;
        }
    }
    
    addImageToUI(senderType, imageUrl, sentAt) {
        if (!imageUrl) {
            console.error('addImageToUI called with undefined imageUrl');
            return;
        }
        
        if (this.messagesContainer.querySelector('.chat-empty')) {
            this.messagesContainer.innerHTML = '';
        }
        
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${window.API_BASE_URL}${imageUrl}`;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${senderType}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <img src="${fullImageUrl}" alt="Image" class="chat-image" onclick="window.open('${fullImageUrl}', '_blank')">
            </div>
            <div class="message-time">${this.formatTime(sentAt)}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
    
    toggleGifPicker() {
        if (this.gifPicker.style.display === 'none') {
            this.gifPicker.style.display = 'block';
            this.gifSearchInput.focus();
            // Load trending GIFs
            this.searchGifs('trending');
        } else {
            this.gifPicker.style.display = 'none';
        }
    }
    
    closeGifPicker() {
        this.gifPicker.style.display = 'none';
    }
    
    async searchGifs(query) {
        if (!query || query.trim() === '') {
            query = 'trending';
        }
        
        try {
            // Using Tenor API (no key needed for basic use, or get free key at https://tenor.com/developer)
            const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public demo key
            const limit = 20;
            const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${limit}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                this.displayGifs(data.results);
            } else {
                this.gifResults.innerHTML = '<div class="gif-loading">No GIFs found</div>';
            }
        } catch (error) {
            console.error('Error fetching GIFs:', error);
            this.gifResults.innerHTML = '<div class="gif-loading">Error loading GIFs</div>';
        }
    }
    
    displayGifs(gifs) {
        this.gifResults.innerHTML = gifs.map(gif => `
            <img src="${gif.media_formats.tinygif.url}" 
                 data-full-url="${gif.media_formats.gif.url}"
                 class="gif-item" 
                 onclick="window.activeChatManager.sendGif('${gif.media_formats.gif.url}')"
                 alt="GIF">
        `).join('');
    }
    
    async sendGif(gifUrl) {
        this.closeGifPicker();
        
        if (!this.currentSalonId && !this.currentCustomerId) {
            alert('Please select a salon or chat first');
            return;
        }
        
        // Show sending indicator
        const displayType = this.userType === 'salon' ? 'salon' : 'customer';
        this.addMessageToUI(displayType, '🎬 Sending GIF...', new Date().toISOString());
        this.sendButton.disabled = true;
        
        try {
            // Choose endpoint based on user type
            const endpoint = (this.userType === 'salon' && this.currentCustomerId) 
                ? `${window.API_BASE_URL}/api/bookings/salon/chat/${this.currentCustomerId}/send/`
                : `${window.API_BASE_URL}/api/bookings/chat/${this.currentSalonId}/send/`;
                
            const response = await authenticatedFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: gifUrl,
                    message_type: 'gif'
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            if (response.ok) {
                this.removeLastMessage();
                this.addImageToUI('customer', gifUrl, new Date().toISOString());
            } else {
                this.removeLastMessage();
                this.showError(data.error || 'Failed to send GIF');
            }
        } catch (error) {
            console.error('Error sending GIF:', error);
            this.removeLastMessage();
            this.showError('Connection error');
        } finally {
            this.sendButton.disabled = false;
        }
    }
    
    toggleStickerPicker() {
        if (this.stickerPicker.style.display === 'none') {
            this.stickerPicker.style.display = 'block';
            this.gifPicker.style.display = 'none'; // Close GIF picker
            this.stickerSearchInput.focus();
            // Load trending stickers
            this.searchStickers('happy');
        } else {
            this.stickerPicker.style.display = 'none';
        }
    }
    
    closeStickerPicker() {
        this.stickerPicker.style.display = 'none';
    }
    
    async searchStickers(query) {
        if (!query || query.trim() === '') {
            query = 'happy';
        }
        
        try {
            const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
            const limit = 20;
            // Search with sticker keyword and filter for transparent media
            const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query + ' transparent sticker')}&key=${apiKey}&limit=${limit}&media_filter=png_transparent,webp_transparent`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('Sticker API response:', data);
            
            if (data.results && data.results.length > 0) {
                // Filter for results that have transparent formats
                const transparentStickers = data.results.filter(s => 
                    s.media_formats.webp_transparent || s.media_formats.png_transparent
                );
                
                if (transparentStickers.length > 0) {
                    this.displayStickers(transparentStickers);
                } else {
                    // If no transparent, show all results
                    this.displayStickers(data.results);
                }
            } else {
                this.stickerResults.innerHTML = '<div class="gif-loading">No Stickers found</div>';
            }
        } catch (error) {
            console.error('Error fetching Stickers:', error);
            this.stickerResults.innerHTML = `<div class="gif-loading">Error: ${error.message}</div>`;
        }
    }
    
    displayStickers(stickers) {
        this.stickerResults.innerHTML = stickers.map(sticker => {
            // Use webp_transparent format from Tenor API
            const formats = sticker.media_formats || {};
            const stickerUrl = formats.webp_transparent?.url || formats.gif?.url;
            
            if (!stickerUrl) {
                console.warn('No valid sticker URL found:', sticker);
                return '';
            }
            
            return `
                <img src="${stickerUrl}" 
                     data-full-url="${stickerUrl}"
                     class="gif-item sticker-item" 
                     onclick="window.activeChatManager.sendSticker('${stickerUrl}')"
                     alt="Sticker">
            `;
        }).join('');
    }
    
    async sendSticker(stickerUrl) {
        this.closeStickerPicker();
        
        if (!this.currentSalonId && !this.currentCustomerId) {
            alert('Please select a salon or chat first');
            return;
        }
        
        // Show sending indicator
        const displayType = this.userType === 'salon' ? 'salon' : 'customer';
        this.addMessageToUI(displayType, '😊 Sending Sticker...', new Date().toISOString());
        this.sendButton.disabled = true;
        
        try {
            // Choose endpoint based on user type
            const endpoint = (this.userType === 'salon' && this.currentCustomerId) 
                ? `${window.API_BASE_URL}/api/bookings/salon/chat/${this.currentCustomerId}/send/`
                : `${window.API_BASE_URL}/api/bookings/chat/${this.currentSalonId}/send/`;
                
            const response = await authenticatedFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    content: stickerUrl,
                    message_type: 'sticker'
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.removeLastMessage();
                this.addImageToUI('customer', stickerUrl, new Date().toISOString());
            } else {
                this.removeLastMessage();
                this.showError(data.error || 'Failed to send Sticker');
            }
        } catch (error) {
            console.error('Error sending Sticker:', error);
            this.removeLastMessage();
            this.showError('Connection error');
        } finally {
            this.sendButton.disabled = false;
        }
    }
    
    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        if (this.chatContainer) {
            this.chatContainer.remove();
        }
        
        if (this.chatToggle) {
            this.chatToggle.remove();
        }
    }
}

// Salon Owner Chat Manager
class SalonChatManager {
    constructor() {
        this.userType = 'salon';
        // Don't create UI - reuse the existing chatManager's UI
        this.messagesContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.chatContainer = null;
        this.chatToggle = null;
        this.currentSalonId = null;
        this.ownedSalons = [];
        this.currentSalonName = '';
    }
    
    // Borrow UI elements from the main chat manager
    borrowUI() {
        if (window.chatManager) {
            this.messagesContainer = window.chatManager.messagesContainer || document.getElementById('chatMessages');
            this.inputField = window.chatManager.inputField || document.getElementById('messageInput');
            this.sendButton = window.chatManager.sendButton || document.getElementById('sendButton');
            this.fileInput = window.chatManager.fileInput || document.getElementById('fileInput');
            this.attachmentButton = window.chatManager.attachmentButton || document.getElementById('attachmentButton');
            this.chatContainer = window.chatManager.chatContainer;
            this.chatToggle = window.chatManager.chatToggle;
            
            // Override the main chat manager's properties so it uses salon chat logic
            window.chatManager.userType = 'salon';
            window.chatManager.currentCustomerId = this.currentCustomerId;
        }
    }
    
    showChat() {
        console.log('SalonChatManager.showChat() called');
        this.borrowUI();
        console.log('UI borrowed, chatContainer:', this.chatContainer);
        
        if (this.chatContainer) {
            this.chatContainer.classList.remove('hidden');
            this.chatContainer.classList.remove('minimized');
            if (this.chatToggle) {
                this.chatToggle.style.display = 'none';
            }
            console.log('Chat container shown, loading chats...');
        } else {
            console.error('Chat container not found!');
        }
        this.bindSalonEvents();
        this.loadUserChats();
    }
    
    bindSalonEvents() {
        // Rebind send button to salon's sendMessage
        if (this.sendButton) {
            // Remove old event listeners by cloning and replacing
            const newSendButton = this.sendButton.cloneNode(true);
            this.sendButton.parentNode.replaceChild(newSendButton, this.sendButton);
            this.sendButton = newSendButton;
            
            // Update references in both managers
            this.sendButton.addEventListener('click', () => this.sendMessage());
            if (window.chatManager) {
                window.chatManager.sendButton = newSendButton;
            }
        }
        
        // Rebind input field events
        if (this.inputField) {
            const newInputField = this.inputField.cloneNode(true);
            this.inputField.parentNode.replaceChild(newInputField, this.inputField);
            this.inputField = newInputField;
            
            this.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Re-add auto-resize
            this.inputField.addEventListener('input', () => {
                this.inputField.style.height = 'auto';
                this.inputField.style.height = Math.min(this.inputField.scrollHeight, 80) + 'px';
            });
            
            // Update reference in chatManager too
            if (window.chatManager) {
                window.chatManager.inputField = newInputField;
            }
        }
        
        // Rebind file attachment button
        if (this.attachmentButton && this.fileInput) {
            const newAttachmentBtn = this.attachmentButton.cloneNode(true);
            this.attachmentButton.parentNode.replaceChild(newAttachmentBtn, this.attachmentButton);
            this.attachmentButton = newAttachmentBtn;
            
            const newFileInput = this.fileInput.cloneNode(true);
            this.fileInput.parentNode.replaceChild(newFileInput, this.fileInput);
            this.fileInput = newFileInput;
            
            this.attachmentButton.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            
            // Update references
            if (window.chatManager) {
                window.chatManager.attachmentButton = newAttachmentBtn;
                window.chatManager.fileInput = newFileInput;
            }
        }
    }
    
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
    
    showLoading() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="chat-loading">
                    <div class="loading-spinner"></div>
                    Loading messages...
                </div>
            `;
        }
    }
    
    showError(message) {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
                    <h3>Error</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + 'm ago';
        } else if (diff < 86400000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async loadUserChats(salonId = null) {
        try {
            // Build URL with salon_id query param if provided
            let url = `${window.API_BASE_URL}/api/bookings/salon/chats/`;
            if (salonId) {
                url += `?salon_id=${salonId}`;
            }
            
            const response = await authenticatedFetch(url);
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentSalonId = data.current_salon.id;
                this.currentSalonName = data.current_salon.name;
                this.ownedSalons = data.owned_salons;
                this.displaySalonChatList(data.chats);
            } else {
                this.showError(data.error || 'Failed to load chats');
            }
        } catch (error) {
            console.error('Error loading salon chats:', error);
            this.showError('Connection error');
        }
    }
    
    displaySalonChatList(chats) {
        // Build salon selector if user has multiple salons
        let salonSelectorHTML = '';
        if (this.ownedSalons.length > 1) {
            salonSelectorHTML = `
                <div class="salon-selector">
                    <label><i class="fas fa-store"></i> Viewing:</label>
                    <select id="salonSelect" onchange="window.salonChatManager.switchSalon(this.value)">
                        ${this.ownedSalons.map(salon => `
                            <option value="${salon.id}" ${salon.is_active ? 'selected' : ''}>
                                ${salon.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }
        
        if (chats.length === 0) {
            this.messagesContainer.innerHTML = `
                ${salonSelectorHTML}
                <div class="chat-empty">
                    <i class="fas fa-comments"></i>
                    <h3>No Customer Chats</h3>
                    <p>Customers will appear here when they message you</p>
                </div>
            `;
            document.getElementById('chatTitle').textContent = `Customer Chats - ${this.currentSalonName}`;
            document.getElementById('chatInput').style.display = 'none';
            return;
        }
        
        const chatListHTML = chats.map(chat => `
            <div class="chat-item" data-chat-id="${chat.id}" data-salon-id="${chat.salon.id}" data-salon-name="${chat.salon.name}">
                <div class="chat-item-info">
                    <div class="chat-item-name">${chat.salon.name}</div>
                    <div class="chat-item-last-message">
                        ${chat.last_message ? 
                            (chat.last_message.sender_type === 'customer' ? 'You: ' : '') + 
                            this.truncateText(chat.last_message.content, 30) 
                            : 'No messages yet'}
                    </div>
                </div>
                <div class="chat-item-meta">
                    <div class="chat-item-time">
                        ${chat.last_message ? this.formatTime(chat.last_message.sent_at) : ''}
                    </div>
                    ${chat.unread_count > 0 ? `<div class="chat-item-unread">${chat.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        this.messagesContainer.innerHTML = `
            ${salonSelectorHTML}
            <div class="chat-list">
                ${chatListHTML}
            </div>
        `;
        
        // Add click event listeners to chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = parseInt(item.dataset.chatId);
                const salonId = parseInt(item.dataset.salonId);
                const salonName = item.dataset.salonName;
                window.activeChatManager.openChat(chatId, salonId, salonName);
            });
        });
        
        document.getElementById('chatTitle').textContent = `Customer Chats - ${this.currentSalonName}`;
        document.getElementById('chatInput').style.display = 'none';
    }
    
    async openSalonChat(customerId, customerName) {
        console.log('Opening salon chat:', customerId, customerName);
        this.currentCustomerId = customerId;
        this.currentCustomerName = customerName;
        this.borrowUI(); // Call borrowUI after setting currentCustomerId
        // currentSalonId is already set from loadUserChats
        
        const titleElement = document.getElementById('chatTitle');
        const inputElement = document.getElementById('chatInput');
        
        // Add back button to title
        if (titleElement) {
            titleElement.innerHTML = `
                <button class="chat-back-btn" onclick="window.salonChatManager.showChat()" title="Back to chat list">
                    <i class="fas fa-arrow-left"></i>
                </button>
                ${customerName}
            `;
        }
        if (inputElement) inputElement.style.display = 'flex';
        
        console.log('Current salon ID for sending messages:', this.currentSalonId);
        
        this.showLoading();
        
        try {
            // Get chat messages - fetch with current salon ID
            let url = `${window.API_BASE_URL}/api/bookings/salon/chats/`;
            if (this.currentSalonId) {
                url += `?salon_id=${this.currentSalonId}`;
            }
            
            const response = await authenticatedFetch(url);
            
            const data = await response.json();
            console.log('Salon chats response:', data);
            
            if (response.ok) {
                // Find the specific chat by customer ID and get its messages
                const chat = data.chats.find(c => c.customer.id === customerId);
                if (chat && chat.messages) {
                    this.displayMessages(chat.messages);
                } else {
                    // No messages yet or need to fetch separately
                    this.messagesContainer.innerHTML = `
                        <div class="chat-empty">
                            <i class="fas fa-comment-dots"></i>
                            <h3>Start Conversation</h3>
                            <p>Send a message to ${customerName}</p>
                        </div>
                    `;
                    this.messagesContainer.classList.add('salon-owner-view');
                    if (inputElement) inputElement.style.display = 'flex';
                }
            } else {
                this.showError(data.error || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading salon chat:', error);
            this.showError('Connection error: ' + error.message);
        }
    }
    
    displayMessages(messages) {
        console.log('Displaying messages:', messages);
        this.borrowUI();
        
        if (!messages || messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="chat-empty">
                    <i class="fas fa-comment-dots"></i>
                    <h3>No Messages Yet</h3>
                    <p>Start the conversation</p>
                </div>
            `;
            // Add salon owner view class
            this.messagesContainer.classList.add('salon-owner-view');
            return;
        }
        
        const messagesHTML = messages.map(message => {
            let contentHTML = '';
            // Check for image in multiple possible fields (image, image_url, or content for external URLs)
            const imageUrl = message.image || message.image_url;
            
            if ((message.message_type === 'image' || message.message_type === 'gif' || message.message_type === 'sticker') && imageUrl) {
                const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${window.API_BASE_URL}${imageUrl}`;
                const cssClass = message.message_type === 'sticker' ? 'chat-sticker' : 'chat-image';
                contentHTML = `<img src="${fullImageUrl}" alt="${message.message_type}" class="${cssClass}" onclick="window.open('${fullImageUrl}', '_blank')">`;
            } else if ((message.message_type === 'gif' || message.message_type === 'sticker') && message.content && message.content.startsWith('http')) {
                const cssClass = message.message_type === 'sticker' ? 'chat-sticker' : 'chat-image';
                contentHTML = `<img src="${message.content}" alt="${message.message_type}" class="${cssClass}" onclick="window.open('${message.content}', '_blank')">`;
            } else {
                contentHTML = this.escapeHtml(message.content || '[Image]');
            }
            
            // Profile picture - only show for customer's messages in salon view
            let profilePicHTML = '';
            let hasAvatar = false;
            if (message.sender_type === 'customer') {
                // Show customer's avatar in salon owner view
                hasAvatar = true;
                if (message.sender_profile_picture) {
                    const profileUrl = message.sender_profile_picture.startsWith('http') ? message.sender_profile_picture : `${window.API_BASE_URL}${message.sender_profile_picture}`;
                    profilePicHTML = `<img src="${profileUrl}" alt="${message.sender_name}" class="message-avatar">`;
                } else {
                    const initial = message.sender_name ? message.sender_name.charAt(0).toUpperCase() : 'C';
                    profilePicHTML = `<div class="message-avatar message-avatar-default">${initial}</div>`;
                }
            }
            
            // Use original sender_type as class (salon CSS handles positioning differently)
            return `
                <div class="message ${message.sender_type} ${hasAvatar ? 'has-avatar' : 'no-avatar'}">
                    ${profilePicHTML}
                    <div class="message-bubble">
                        <div class="message-content">${contentHTML}</div>
                        <div class="message-time">${this.formatTime(message.sent_at)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.messagesContainer.innerHTML = messagesHTML;
        // Add salon owner view class for proper message alignment
        this.messagesContainer.classList.add('salon-owner-view');
        this.scrollToBottom();
    }
    
    async sendMessage() {
        this.borrowUI();
        if (!this.inputField) {
            console.error('Input field not found!');
            return;
        }
        const content = this.inputField.value.trim();
        console.log('Salon sending message:', content, 'to customer:', this.currentCustomerId);
        
        if (!content || !this.currentCustomerId) {
            console.log('No content or customer ID:', {content, customerId: this.currentCustomerId});
            return;
        }
        
        // Disable send button
        this.sendButton.disabled = true;
        this.inputField.disabled = true;
        
        // Add message to UI immediately (use 'salon' class for salon messages)
        this.addMessageToUI('salon', content, new Date().toISOString());
        this.inputField.value = '';
        if (this.inputField.style) {
            this.inputField.style.height = 'auto';
        }
        
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/salon/chat/${this.currentCustomerId}/send/`, {
                method: 'POST',
                body: JSON.stringify({
                    content: content,
                    message_type: 'text'
                })
            });
            
            const data = await response.json();
            console.log('Send message response:', data);
            
            if (!response.ok) {
                this.showError(data.error || 'Failed to send message');
                this.removeLastMessage();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Connection error');
            this.removeLastMessage();
        } finally {
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.inputField.focus();
        }
    }
    
    addMessageToUI(senderType, content, sentAt) {
        this.borrowUI();
        // If messages container shows empty state, clear it
        if (this.messagesContainer.querySelector('.chat-empty')) {
            this.messagesContainer.innerHTML = '';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${senderType}`;
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            <div class="message-time">${this.formatTime(sentAt)}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    removeLastMessage() {
        this.borrowUI();
        const messages = this.messagesContainer.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }
    }
    
    switchSalon(salonId) {
        console.log('Switching to salon:', salonId);
        this.showLoading();
        this.loadUserChats(parseInt(salonId));
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Only image files are allowed');
            return;
        }
        
        // Preview and send
        this.sendImageMessage(file);
    }
    
    async sendImageMessage(file) {
        if (!this.currentChatId) {
            alert('Please open a chat first');
            return;
        }
        
        this.borrowUI();
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('image', file);
        formData.append('content', '[Image]');
        formData.append('message_type', 'image');
        
        // Disable buttons
        this.sendButton.disabled = true;
        this.attachmentButton.disabled = true;
        
        // Show uploading indicator
        this.addMessageToUI('salon', '📤 Uploading image...', new Date().toISOString());
        
        try {
            const response = await authenticatedFetch(`${window.API_BASE_URL}/api/bookings/salon/chat/${this.currentChatId}/send/`, {
                method: 'POST',
                body: formData,
                isFormData: true
            });
            
            const data = await response.json();
            console.log('Image upload response:', data);
            
            if (response.ok) {
                // Replace upload message with actual image
                this.removeLastMessage();
                if (data.image_url) {
                    this.addImageToUI('salon', data.image_url, new Date().toISOString());
                } else {
                    console.error('No image_url in response:', data);
                    this.addMessageToUI('salon', 'Image sent but URL not available', new Date().toISOString());
                }
                this.fileInput.value = ''; // Reset file input
            } else {
                console.error('Upload failed:', data);
                this.removeLastMessage();
                this.showError(data.error || 'Failed to send image');
            }
        } catch (error) {
            console.error('Error sending image:', error);
            this.removeLastMessage();
            this.showError('Connection error');
        } finally {
            this.sendButton.disabled = false;
            this.attachmentButton.disabled = false;
        }
    }
    
    addImageToUI(senderType, imageUrl, sentAt) {
        this.borrowUI();
        if (this.messagesContainer.querySelector('.chat-empty')) {
            this.messagesContainer.innerHTML = '';
        }
        
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${window.API_BASE_URL}${imageUrl}`;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${senderType}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <img src="${fullImageUrl}" alt="Image" class="chat-image" onclick="window.open('${fullImageUrl}', '_blank')">
            </div>
            <div class="message-time">${this.formatTime(sentAt)}</div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.classList.add('salon-owner-view');
        this.scrollToBottom();
    }
}

// Global chat manager instances
let chatManager;
let salonChatManager;

// Initialize chat based on user type
function initializeChat() {
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    // Always create customer chat manager for chatting WITH salons
    chatManager = new ChatManager();
    window.activeChatManager = chatManager;
    window.chatManager = chatManager;
    
    // Additionally create salon chat manager if user is salon owner (for receiving customer messages)
    if (userData.user_type === 'salon_owner') {
        salonChatManager = new SalonChatManager();
        window.salonChatManager = salonChatManager;
        // Keep chatManager as active for browsing and chatting with salons
    }
}

// Function to start chat with a specific salon (called from salon profile pages)
function startChatWithSalon(salonId, salonName) {
    console.log('startChatWithSalon called:', salonId, salonName);
    
    // Check if user is logged in
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert('Please log in to chat with salons');
        window.location.href = '/index.html';
        return;
    }
    
    // Initialize chat manager if not already initialized
    if (!chatManager && !salonChatManager) {
        console.log('Initializing chat manager...');
        initializeChat();
    }
    
    // Wait a moment for initialization, then start chat
    setTimeout(() => {
        if (chatManager) {
            console.log('Starting new chat...');
            chatManager.startNewChat(salonId, salonName);
        } else if (window.activeChatManager) {
            console.log('Using active chat manager...');
            window.activeChatManager.startNewChat(salonId, salonName);
        } else {
            console.error('Chat manager not available');
            alert('Chat system is loading. Please try again in a moment.');
        }
    }, 100);
}

// Make function available globally
window.startChatWithSalon = startChatWithSalon;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chat.js loaded - DOMContentLoaded');
    
    // Only initialize if user is logged in
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
        console.log('User logged in, initializing chat...');
        initializeChat();
    } else {
        console.log('User not logged in, chat not initialized');
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (chatManager) {
        chatManager.destroy();
    }
    if (salonChatManager) {
        salonChatManager.destroy();
    }
});
