class Chat {
    constructor(gameId, playerId, playerName, database) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.playerName = playerName;
        this.database = database;
        this.chatRef = database.ref(`games/${gameId}/chat`);
        this.messagesContainer = document.getElementById('chat-messages');
        this.inputField = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-chat-btn');
        this.setupListeners();
    }

    setupListeners() {
        this.sendClickHandler = () => this.sendMessage();
        this.keyHandler = (e) => { if (e.key === 'Enter') this.sendMessage(); };
        
        this.sendButton.addEventListener('click', this.sendClickHandler);
        this.inputField.addEventListener('keypress', this.keyHandler);
        
        this.messageHandler = (snapshot) => {
            const message = snapshot.val();
            this.displayMessage(message);
        };
        this.chatRef.on('child_added', this.messageHandler);
    }

    sendMessage() {
        const text = this.inputField.value.trim();
        if (!text) return;
        
        this.chatRef.push({
            sender: this.playerName,
            senderId: this.playerId,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            type: 'user'
        });
        this.inputField.value = '';
    }

    displayMessage(message) {
        const messageDiv = document.createElement('div');
        if (message.type === 'system') {
            messageDiv.className = 'chat-message system';
            messageDiv.textContent = message.text;
        } else {
            messageDiv.className = 'chat-message';
            const senderSpan = document.createElement('span');
            senderSpan.className = 'sender';
            senderSpan.textContent = message.sender + ': ';
            messageDiv.appendChild(senderSpan);
            messageDiv.appendChild(document.createTextNode(message.text));
        }
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    sendSystemMessage(text) {
        this.chatRef.push({
            type: 'system',
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    destroy() {
        this.sendButton.removeEventListener('click', this.sendClickHandler);
        this.inputField.removeEventListener('keypress', this.keyHandler);
        this.chatRef.off('child_added', this.messageHandler);
    }
}

window.Chat = Chat;
