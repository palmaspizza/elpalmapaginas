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
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Escuchar nuevos mensajes
        this.chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            this.displayMessage(message);
        });
    }

    sendMessage() {
        const text = this.inputField.value.trim();
        if (!text) return;
        
        const message = {
            sender: this.playerName,
            senderId: this.playerId,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        this.chatRef.push(message);
        this.inputField.value = '';
    }

    displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (message.type === 'system') {
            messageDiv.classList.add('system');
            messageDiv.textContent = message.text;
        } else {
            const senderSpan = document.createElement('span');
            senderSpan.className = 'sender';
            senderSpan.textContent = message.sender + ': ';
            messageDiv.appendChild(senderSpan);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = message.text;
            messageDiv.appendChild(textSpan);
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
        this.chatRef.off();
        this.sendButton.removeEventListener('click', () => this.sendMessage());
        this.inputField.removeEventListener('keypress', () => {});
    }
}

window.Chat = Chat;