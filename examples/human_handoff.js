const { Client, LocalAuth } = require('../index');

// Create a client with AI enabled
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
    },
    ai: {
        enabled: true,
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview'
    }
});

// Simulated human operator dashboard
const humanOperators = {
    available: ['operator1', 'operator2'],
    assigned: {},
    queue: []
};

// Register human operator handlers
client.registerHumanHandlers({
    // Called when a conversation is handed off to a human
    // eslint-disable-next-line no-unused-vars
    onHandoff: async (chatId, thread, handoffState) => {
        console.log(`[HANDOFF] Chat ${chatId} handed off to human. Reason: ${handoffState.reason || 'No reason provided'}`);
        
        // Check if we have available operators
        if (humanOperators.available.length > 0) {
            // Assign to first available operator
            const operator = humanOperators.available.shift();
            humanOperators.assigned[chatId] = {
                operator,
                handoffState,
                thread,
                messages: []
            };
            
            console.log(`[HANDOFF] Chat ${chatId} assigned to ${operator}`);
            
            // Notify the user
            const contact = await client.getContactById(chatId);
            await client.sendMessage(chatId, 
                `You've been connected with ${operator}. They'll assist you shortly.`);
            
            // In a real system, you would notify the operator through your dashboard
            console.log(`[OPERATOR NOTIFICATION] ${operator}: New chat assigned from ${contact.pushname || contact.number} (Reason: ${handoffState.reason || 'No reason provided'})`);
        } else {
            // Add to queue
            humanOperators.queue.push({
                chatId,
                handoffState,
                thread
            });
            
            console.log(`[HANDOFF] No operators available. Chat ${chatId} added to queue. Handoff reason: ${handoffState.reason || 'No reason provided'}`);
            
            // Notify the user
            await client.sendMessage(chatId, 
                'All our agents are currently busy. You\'ve been added to the queue and will be assisted shortly.');
        }
    },
    
    // Called when a message is received while in human mode
    onMessage: async (chatId, message, handoffState) => {
        console.log(`[HUMAN MODE] Message from ${chatId}: ${message}`);
        
        // Check if this chat is assigned to an operator
        if (humanOperators.assigned[chatId]) {
            const assignment = humanOperators.assigned[chatId];
            
            // Store message in conversation history
            assignment.messages.push({
                from: 'user',
                content: message,
                timestamp: Date.now()
            });
            
            // In a real system, you would forward this to the operator's dashboard
            console.log(`[OPERATOR MESSAGE] To ${assignment.operator}: ${message}`);
            
            // Return null to indicate no automatic response
            return {
                handled: false,
                response: null
            };
        } else {
            // Chat is in queue or unassigned
            return {
                handled: true,
                response: 'You\'re currently in our queue. An agent will be with you shortly.'
            };
        }
    },
    
    // Called when a conversation is released back to the AI
    onRelease: async (chatId, thread, releaseInfo) => {
        console.log(`[RELEASE] Chat ${chatId} released back to AI. Summary: ${releaseInfo.summary}`);
        
        // Clean up operator assignment
        if (humanOperators.assigned[chatId]) {
            const operator = humanOperators.assigned[chatId].operator;
            delete humanOperators.assigned[chatId];
            
            // Make operator available again
            humanOperators.available.push(operator);
            console.log(`[RELEASE] Operator ${operator} is now available`);
            
            // Check if there are chats in queue
            if (humanOperators.queue.length > 0) {
                const nextChat = humanOperators.queue.shift();
                
                // Recursive call to handle the next chat
                await client.ai._humanHandlers.onHandoff(
                    nextChat.chatId, 
                    nextChat.thread, 
                    nextChat.handoffState
                );
            }
        }
        
        // Notify the user
        await client.sendMessage(chatId, 
            'You\'ve been transferred back to our AI assistant. ' + 
            'If you need human assistance again, just type #human.');
    }
});

// Listen for QR code
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

// Listen for ready event
client.on('ready', () => {
    console.log('Client is ready!');
});

// Listen for messages
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    try {
        // Check if this is a command for the simulated operator dashboard
        if (msg.body.startsWith('!operator')) {
            const parts = msg.body.split(' ');
            const command = parts[1];
            
            if (command === 'respond' && parts.length >= 4) {
                const chatId = parts[2];
                const response = parts.slice(3).join(' ');
                
                if (humanOperators.assigned[chatId]) {
                    // Store operator response
                    humanOperators.assigned[chatId].messages.push({
                        from: 'operator',
                        content: response,
                        timestamp: Date.now()
                    });
                    
                    // Send response to user
                    await client.sendMessage(chatId, response);
                    console.log(`[OPERATOR] Sent response to ${chatId}: ${response}`);
                } else {
                    await msg.reply(`Error: Chat ${chatId} is not assigned to an operator`);
                }
                return;
            } else if (command === 'release' && parts.length >= 4) {
                const chatId = parts[2];
                const summary = parts.slice(3).join(' ');
                
                if (client.isInHumanMode(chatId)) {
                    await client.releaseToAI(chatId, summary);
                    await msg.reply(`Released chat ${chatId} back to AI with summary: ${summary}`);
                } else {
                    await msg.reply(`Error: Chat ${chatId} is not in human mode`);
                }
                return;
            } else if (command === 'list') {
                // List all chats in human mode
                const humanChats = client.getHumanModeChats();
                if (humanChats.length === 0) {
                    await msg.reply('No chats currently in human mode');
                } else {
                    const chatList = humanChats.map(chat => 
                        `- ${chat.chatId} (${chat.reason}): ${humanOperators.assigned[chat.chatId] ? 
                            'Assigned to ' + humanOperators.assigned[chat.chatId].operator : 
                            'In queue'}`
                    ).join('\n');
                    
                    await msg.reply(`Chats in human mode:\n${chatList}`);
                }
                return;
            } else if (command === 'help') {
                await msg.reply(
                    'Operator commands:\n' +
                    '!operator respond [chatId] [message] - Send a response to a user\n' +
                    '!operator release [chatId] [summary] - Release a chat back to AI\n' +
                    '!operator list - List all chats in human mode\n' +
                    '!operator help - Show this help message'
                );
                return;
            }
        }
        
        // Process the message with handoff awareness
        const result = await client.processMessage(msg.body, {
            chatId: msg.from,
            fallbackToAI: true,
            handoffOnError: true,
            aiOptions: {
                temperature: 0.7
            }
        });
        
        console.log(`[PROCESS] Message type: ${result.type}`);
        
        // Handle the result based on type
        if (result.type === 'ai' || result.type === 'handoff') {
            if (result.response) {
                await msg.reply(result.response);
            }
        } else if (result.type === 'human') {
            // Human mode - message already handled by onMessage handler
            if (result.response) {
                await msg.reply(result.response);
            }
        } else if (result.type === 'unmatched') {
            await msg.reply('I\'m not sure how to respond to that.');
        }
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Initialize the client
client.initialize(); 