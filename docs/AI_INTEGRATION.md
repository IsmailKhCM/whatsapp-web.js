# AI Integration for WhatsApp Web.js

This document provides a comprehensive guide to using the AI integration features in WhatsApp Web.js.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [AI Assistant](#ai-assistant)
4. [Template Parser](#template-parser)
5. [Hybrid Processing](#hybrid-processing)
6. [Storage Options](#storage-options)
7. [AI Providers](#ai-providers)
8. [Middleware System](#middleware-system)
9. [Function Calling](#function-calling)
10. [Human Handoff System](#human-handoff-system)
11. [Examples](#examples)

## Overview

WhatsApp Web.js now includes powerful AI integration features that allow you to:

- Process messages with AI models from various providers
- Parse structured commands using templates
- Maintain conversation context across messages
- Store conversation history in various storage backends
- Use middleware for pre/post-processing
- Execute functions called by the AI

These features enable you to build sophisticated chatbots and assistants that can handle both structured commands and natural language conversations.

## Setup

To use the AI integration features, you need to configure them when creating a Client instance:

```javascript
const { Client, LocalAuth } = require('@ismailkhcm/whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    // AI configuration
    ai: {
        enabled: true,
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview',
        storageProvider: 'memory', // or 'mongodb', 'sql'
        storageOptions: {
            // Provider-specific options
        }
    },
    // Template parser configuration
    templateParser: {
        enabled: true,
        defaultTemplates: {
            // Template definitions
        }
    }
});
```

## AI Assistant

The AI Assistant provides a way to interact with AI models and maintain conversation context.

### Basic Usage

```javascript
// Ask a question
const response = await client.ai.ask(chatId, 'What is the capital of France?');
console.log(response); // "The capital of France is Paris."

// Create a thread for multi-turn conversations
const thread = await client.ai.createThread(chatId);
await thread.addContext('user_name', 'John');
const response1 = await thread.ask('What is the weather today?');
const response2 = await thread.ask('Should I bring an umbrella?');
```

### Configuration Options

The AI Assistant supports the following configuration options:

- `provider`: AI provider to use ('openai', 'anthropic', 'google', 'local')
- `apiKey`: API key for the AI provider
- `defaultModel`: Default model to use
- `options`: Provider-specific options (temperature, maxTokens, etc.)
- `memoryType`: Type of memory to use ('session', 'persistent')
- `storageProvider`: Storage provider for threads ('memory', 'mongodb', 'sql')
- `ttl`: Time-to-live for threads in seconds
- `maxThreads`: Maximum number of threads to keep in memory

### Statistics

You can get statistics about the AI assistant:

```javascript
const stats = client.ai.getStats();
console.log(stats);
// {
//   requests: 100,
//   errors: 2,
//   errorRate: 0.02,
//   averageResponseTime: 250,
//   requestsPerMinute: 10,
//   uptime: 300000,
//   activeThreads: 5
// }
```

## Template Parser

The Template Parser allows you to define structured command templates and parse messages against them.

### Basic Usage

```javascript
// Define a template
const orderTemplate = {
    fields: {
        command: { type: 'string', required: true },
        item: { type: 'string', required: true },
        quantity: { type: 'number', required: true },
        address: { type: 'string', required: false }
    }
};

// Add the template
client.templateParser.addTemplate('order', orderTemplate);

// Parse a message
const message = '!order item:pizza quantity:2 address:123 Main St';
const parsed = client.templateParser.parseMessage(message, 'order');

if (parsed.isValid) {
    console.log(`Order: ${parsed.quantity}x ${parsed.item}`);
    if (parsed.address) {
        console.log(`Delivery to: ${parsed.address}`);
    }
} else {
    console.log(`Invalid order: ${parsed.errors.join(', ')}`);
}
```

### Template Definition

A template is defined as an object with the following structure:

```javascript
{
    fields: {
        fieldName: {
            type: 'string' | 'number' | 'boolean' | 'array',
            required: true | false,
            pattern: 'regex pattern' // Optional
        },
        // More fields...
    },
    examples: [
        // Optional example messages
        '!command field1:value1 field2:value2'
    ]
}
```

### Generating Templates from Examples

You can generate templates from example messages:

```javascript
const examples = [
    '!order item:pizza quantity:2 address:123 Main St',
    '!order item:burger quantity:1',
    '!order item:salad quantity:3 address:456 Oak Ave'
];

const generatedTemplate = client.templateParser.generateTemplate(examples);
client.templateParser.addTemplate('order', generatedTemplate);
```

## Hybrid Processing

The Client class provides a `processMessage` method that combines template parsing and AI processing:

```javascript
const result = await client.processMessage(message, {
    templates: ['order', 'weather'],
    fallbackToAI: true,
    aiOptions: {
        temperature: 0.7
    }
});

if (result.type === 'template') {
    console.log(`Template: ${result.template}`);
    console.log(`Data: ${JSON.stringify(result.data)}`);
} else if (result.type === 'ai') {
    console.log(`AI response: ${result.response}`);
} else {
    console.log('No match');
}
```

## Storage Options

The AI Assistant supports different storage options for threads:

### Memory Storage

In-memory storage (default):

```javascript
ai: {
    storageProvider: 'memory'
}
```

### MongoDB Storage

Store threads in MongoDB:

```javascript
ai: {
    storageProvider: 'mongodb',
    storageOptions: {
        uri: 'mongodb://localhost:27017',
        dbName: 'whatsapp_web_js',
        collectionName: 'threads'
    }
}
```

### SQL Storage

Store threads in SQL database:

```javascript
ai: {
    storageProvider: 'sql',
    storageOptions: {
        dialect: 'sqlite', // or 'mysql', 'postgres', etc.
        storage: 'threads.sqlite', // for SQLite
        // For other dialects:
        // host: 'localhost',
        // database: 'whatsapp_web_js',
        // username: 'user',
        // password: 'password'
    }
}
```

## AI Providers

The AI Assistant supports multiple AI providers:

### OpenAI

```javascript
ai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: 'gpt-4-turbo-preview'
}
```

### Anthropic

```javascript
ai: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: 'claude-3-opus-20240229'
}
```

### Google AI

```javascript
ai: {
    provider: 'google',
    apiKey: process.env.GOOGLE_API_KEY,
    defaultModel: 'gemini-pro'
}
```

### Local AI (Ollama)

```javascript
ai: {
    provider: 'local',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3'
}
```

## Middleware System

The AI Assistant supports middleware for pre/post-processing:

```javascript
// Logging middleware
client.ai.use(async (context, next) => {
    console.log(`Processing message from ${context.chatId}: ${context.prompt}`);
    await next();
    console.log(`AI response: ${context.response}`);
});

// Content filtering middleware
client.ai.use(async (context, next) => {
    if (containsSensitiveContent(context.prompt)) {
        context.response = "I can't process that request.";
        return;
    }
    await next();
});

// Rate limiting middleware
client.ai.use(async (context, next) => {
    const userRequests = getUserRequestCount(context.chatId);
    if (userRequests > 100) {
        context.response = "You've reached your request limit for today.";
        return;
    }
    await next();
    incrementUserRequestCount(context.chatId);
});
```

## Function Calling

The AI Assistant supports function calling:

```javascript
// Register functions
client.ai.registerFunctions({
    getWeather: async ({ location, units = 'metric' }) => {
        // Get weather data
        return { temperature: 22, condition: 'Sunny', location, units };
    },
    searchProducts: async ({ query, limit = 5 }) => {
        // Search products
        return [
            { id: 1, name: 'Product 1', price: 10 },
            { id: 2, name: 'Product 2', price: 20 }
        ].slice(0, limit);
    }
});

// The AI can call these functions when needed
const response = await client.ai.ask(chatId, 'What\'s the weather in New York?');
// AI will call getWeather({ location: 'New York' }) and include the result in its response
```

## Human Handoff System

The Human Handoff System provides a seamless way to transfer conversations between AI assistants and human operators. This is particularly useful for customer support scenarios where you might need human intervention for complex issues.

### Setting Up Human Handoff

```javascript
// Register human operator handlers
client.registerHumanHandlers({
    // Called when a conversation is handed off to a human
    onHandoff: async (chatId, thread, handoffState) => {
        console.log(`Chat ${chatId} handed off to human. Reason: ${handoffState.reason}`);
        // Assign to operator, add to queue, etc.
    },
    
    // Called when a message is received while in human mode
    onMessage: async (chatId, message, handoffState) => {
        console.log(`Message from ${chatId}: ${message}`);
        // Forward to operator dashboard, etc.
        
        return {
            handled: true,
            response: "An agent will respond shortly."
        };
    },
    
    // Called when a conversation is released back to the AI
    onRelease: async (chatId, thread, releaseInfo) => {
        console.log(`Chat ${chatId} released back to AI. Summary: ${releaseInfo.summary}`);
        // Clean up operator assignment, etc.
    }
});
```

### Triggering a Handoff

A handoff can be triggered in several ways:

1. **User Command**: When a user sends a message containing `#handoff`, `#human`, or `#agent`
2. **AI Decision**: When the AI's response contains `[handoff]` or `[human needed]`
3. **Manual Trigger**: By calling `client.handoffToHuman(chatId, reason, metadata)`
4. **Error Handling**: Automatically on AI processing errors if `handoffOnError` is enabled

```javascript
// Manual handoff
await client.handoffToHuman(chatId, "Complex billing issue", {
    priority: "high",
    category: "billing"
});

// Process message with handoff awareness
const result = await client.processMessage(message, {
    chatId: msg.from,
    fallbackToAI: true,
    handoffOnError: true
});
```

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

### Integration with External Systems

The Human Handoff System is designed to integrate with external operator dashboards or CRM systems:

```javascript
// Example of a simple operator dashboard
const humanOperators = {
    available: ['operator1', 'operator2'],
    assigned: {},
    queue: []
};

client.registerHumanHandlers({
    onHandoff: async (chatId, thread, handoffState) => {
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
            
            // Notify the user
            await client.sendMessage(chatId, 
                `You've been connected with ${operator}. They'll assist you shortly.`);
        } else {
            // Add to queue
            humanOperators.queue.push({
                chatId,
                handoffState,
                thread
            });
            
            // Notify the user
            await client.sendMessage(chatId, 
                "All our agents are currently busy. You've been added to the queue and will be assisted shortly.");
        }
    }
});
```

For more details, see the [Human Handoff documentation](./HUMAN_HANDOFF.md).

## Examples

### Basic AI Chat

```javascript
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    const response = await client.ai.ask(msg.from, msg.body);
    await msg.reply(response);
});
```

### Template-Based Command Handling

```javascript
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    const parsed = client.templateParser.parseMessage(msg.body, 'order');
    
    if (parsed.isValid) {
        await msg.reply(`Order received: ${parsed.quantity}x ${parsed.item}`);
        
        if (parsed.address) {
            await msg.reply(`Will be delivered to: ${parsed.address}`);
        } else {
            await msg.reply('Please provide a delivery address with address:your address');
        }
    }
});
```

### Hybrid Processing

```javascript
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    const result = await client.processMessage(msg.body, {
        templates: ['order', 'weather', 'help'],
        fallbackToAI: true
    });
    
    if (result.type === 'template') {
        // Handle structured command
        if (result.template === 'order') {
            await msg.reply(`Order received: ${result.data.quantity}x ${result.data.item}`);
        } else if (result.template === 'weather') {
            await msg.reply(`Weather for ${result.data.city}: Sunny, 22°C`);
        }
    } else if (result.type === 'ai') {
        // AI handled the message
        await msg.reply(result.response);
    } else {
        // No match
        await msg.reply("I'm not sure how to respond to that.");
    }
});
```

### Multi-Turn Conversation

```javascript
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    const thread = await client.ai.createThread(msg.from);
    
    // Add context from user profile
    const contact = await msg.getContact();
    thread.addContext('user_name', contact.name || contact.pushname);
    
    // Process the message
    const response = await thread.ask(msg.body);
    await msg.reply(response);
});
```

For more examples, see the [examples directory](../examples/).

## Advanced Configuration

For advanced configuration options and more detailed examples, please refer to the [API Reference](./API_REFERENCE.md). 