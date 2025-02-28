# Human Handoff System

The Human Handoff System in WhatsApp Web.js provides a seamless way to transfer conversations between AI assistants and human operators. This is particularly useful for customer support scenarios where you might need human intervention for complex issues or want to automate routine inquiries.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Handoff Process](#handoff-process)
4. [Human Operator Integration](#human-operator-integration)
5. [API Reference](#api-reference)
6. [Examples](#examples)

## Overview

The Human Handoff System allows you to:

- Transfer conversations from AI to human operators
- Queue and manage conversations waiting for human assistance
- Provide context and history to human operators
- Transfer conversations back to AI with summary information
- Detect handoff commands in user messages
- Automatically trigger handoffs based on AI responses or errors

## Setup

To use the Human Handoff System, you need to initialize a client with AI enabled and register human operator handlers:

```javascript
const { Client, LocalAuth } = require('@ismailkhcm/whatsapp-web.js');

// Create a client with AI enabled
const client = new Client({
    authStrategy: new LocalAuth(),
    ai: {
        enabled: true,
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview'
    }
});

// Register human operator handlers
client.registerHumanHandlers({
    onHandoff: async (chatId, thread, handoffState) => {
        // Called when a conversation is handed off to a human
        console.log(`Chat ${chatId} handed off to human. Reason: ${handoffState.reason}`);
        // Assign to operator, add to queue, etc.
    },
    
    onMessage: async (chatId, message, handoffState) => {
        // Called when a message is received while in human mode
        console.log(`Message from ${chatId}: ${message}`);
        // Forward to operator dashboard, etc.
        
        // Return response or null
        return {
            handled: true,
            response: "An agent will respond shortly."
        };
    },
    
    onRelease: async (chatId, thread, releaseInfo) => {
        // Called when a conversation is released back to the AI
        console.log(`Chat ${chatId} released back to AI. Summary: ${releaseInfo.summary}`);
        // Clean up operator assignment, etc.
    }
});
```

## Handoff Process

### Triggering a Handoff

A handoff can be triggered in several ways:

1. **User Command**: When a user sends a message containing `#handoff`, `#human`, or `#agent`
2. **AI Decision**: When the AI's response contains `[handoff]` or `[human needed]`
3. **Manual Trigger**: By calling `client.handoffToHuman(chatId, reason, metadata)`
4. **Error Handling**: Automatically on AI processing errors if `handoffOnError` is enabled

### During Human Mode

When a chat is in human mode:

1. All messages are routed to the `onMessage` handler
2. The AI will not automatically respond to messages
3. The `client.isInHumanMode(chatId)` method returns `true`
4. The chat appears in the list returned by `client.getHumanModeChats()`

### Releasing Back to AI

To release a conversation back to AI control:

```javascript
await client.releaseToAI(chatId, "Customer had billing issue. Resolved by providing refund.", {
    ticketId: "12345",
    resolution: "refund_issued"
});
```

## Human Operator Integration

The Human Handoff System is designed to integrate with external operator dashboards or CRM systems. You can:

1. **Queue Management**: Implement a queue system for chats waiting for human assistance
2. **Operator Assignment**: Assign chats to specific operators
3. **Conversation History**: Provide conversation history and context to operators
4. **Status Tracking**: Track the status of chats in human mode
5. **Notifications**: Notify operators of new assignments or messages

## API Reference

### Client Methods

#### `client.handoffToHuman(chatId, reason, metadata)`

Transfers a conversation to human mode.

- `chatId`: The chat ID
- `reason`: Reason for the handoff
- `metadata`: Additional metadata

Returns: `Promise<boolean>` - Success status

#### `client.releaseToAI(chatId, summary, metadata)`

Releases a conversation back to AI control.

- `chatId`: The chat ID
- `summary`: Summary of the human interaction
- `metadata`: Additional metadata

Returns: `Promise<boolean>` - Success status

#### `client.isInHumanMode(chatId)`

Checks if a chat is in human mode.

- `chatId`: The chat ID

Returns: `boolean` - Whether the chat is in human mode

#### `client.getHumanModeChats()`

Gets all chats currently in human mode.

Returns: `Array<HandoffState>` - Array of handoff states

#### `client.registerHumanHandlers(handlers)`

Registers human operator handlers.

- `handlers`: Object containing handler functions
  - `onHandoff`: Called when a conversation is handed off to a human
  - `onMessage`: Called when a message is received while in human mode
  - `onRelease`: Called when a conversation is released back to the AI

### Processing Messages

When processing messages with the handoff system:

```javascript
const result = await client.processMessage(message, {
    chatId: msg.from,
    fallbackToAI: true,
    handoffOnError: true
});

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
}
```

## Examples

### Basic Handoff System

```javascript
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    // Process the message with handoff awareness
    const result = await client.processMessage(msg.body, {
        chatId: msg.from,
        fallbackToAI: true,
        handoffOnError: true
    });
    
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
        await msg.reply("I'm not sure how to respond to that.");
    }
});
```

### Operator Dashboard Commands

```javascript
// Check if this is a command for the operator dashboard
if (msg.body.startsWith('!operator')) {
    const parts = msg.body.split(' ');
    const command = parts[1];
    
    if (command === 'respond' && parts.length >= 4) {
        const chatId = parts[2];
        const response = parts.slice(3).join(' ');
        
        if (humanOperators.assigned[chatId]) {
            // Send response to user
            await client.sendMessage(chatId, response);
            console.log(`Sent response to ${chatId}: ${response}`);
        } else {
            await msg.reply(`Error: Chat ${chatId} is not assigned to an operator`);
        }
    } else if (command === 'release' && parts.length >= 4) {
        const chatId = parts[2];
        const summary = parts.slice(3).join(' ');
        
        if (client.isInHumanMode(chatId)) {
            await client.releaseToAI(chatId, summary);
            await msg.reply(`Released chat ${chatId} back to AI with summary: ${summary}`);
        } else {
            await msg.reply(`Error: Chat ${chatId} is not in human mode`);
        }
    } else if (command === 'list') {
        // List all chats in human mode
        const humanChats = client.getHumanModeChats();
        if (humanChats.length === 0) {
            await msg.reply('No chats currently in human mode');
        } else {
            const chatList = humanChats.map(chat => 
                `- ${chat.chatId} (${chat.reason})`
            ).join('\n');
            
            await msg.reply(`Chats in human mode:\n${chatList}`);
        }
    }
}
```

For a complete example, see the [human_handoff.js](../examples/human_handoff.js) file in the examples directory. 