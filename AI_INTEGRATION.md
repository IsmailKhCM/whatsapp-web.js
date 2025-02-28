# AI Integration for WhatsApp Web.js

## Overview
Integrate AI capabilities directly into WhatsApp Web.js through a dedicated AI bot. This bot not only manages intelligent multi-turn conversations but also supports template-based message parsing to reliably process structured commands and queries.

## Core Features

### 1. Full WhatsApp AI Bot Integration

#### Bot Initialization and Configuration
Integrate a full AI bot that manages conversation context, performs tasks via function calls, and handles both dynamic interactions and structured inputs.

```javascript
const { Client, LocalAuth, AIAssistant } = require('@ismailkhcm/whatsapp-web.js');

// Initialize the client with a full AI bot setup
const client = new Client({
    authStrategy: new LocalAuth(),
    ai: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        assistantId: process.env.OPENAI_ASSISTANT_ID,
        defaultModel: 'gpt-4-turbo-preview'
    }
});

client.on('message', async (msg) => {
    // Use a full bot to handle conversation flow and task execution
    if (!msg.fromMe) {
        const response = await client.ai.ask(msg.body);
        await msg.reply(response);
    }
});
```

#### Features
- **Multi-Turn Conversation Management:**  
  Maintain context, track conversation threads, and dynamically adapt responses.
- **Dynamic Function Execution:**  
  Leverage function calling to execute commands like order processing or inventory checks.
- **Proactive Interactions:**  
  Enable notifications, error handling, and user feedback within the conversation flow.

### 2. Template-Based Message Parsing

#### Structured Command Parsing
Incorporate the built-in `TemplateParser` class that takes defined templates and processes messages accordingly. This ensures that specific commands follow a predictable format and yield deterministic outputs.

```javascript
const { Client, LocalAuth, TemplateParser } = require('whatsapp-web.js');

// Create a client
const client = new Client({
    authStrategy: new LocalAuth()
});

// Create a template parser
const parser = new TemplateParser(client);

// Define a template for orders
const orderTemplate = {
    fields: {
        command: { type: 'string', required: true },
        item: { type: 'string', required: true },
        quantity: { type: 'number', required: true },
        address: { type: 'string', required: false }
    }
};

// Add the template
parser.addTemplate('order', orderTemplate);

client.on('message', async (msg) => {
    // Parse the message using the 'order' template
    const parsed = parser.parseMessage(msg.body, 'order');
    
    if (parsed.isValid && parsed.command === 'order') {
        // Handle valid order
        await msg.reply(`Order received: ${parsed.quantity}x ${parsed.item}`);
        
        if (parsed.address) {
            await msg.reply(`Will be delivered to: ${parsed.address}`);
        } else {
            await msg.reply('Please provide a delivery address with address:your address');
        }
    } else if (parsed.command === 'order') {
        // Handle invalid order
        await msg.reply(`Invalid order. Errors: ${parsed.errors.join(', ')}`);
    }
});
```

The `TemplateParser` class supports:
- Defining structured templates with field types and validation rules
- Automatic type conversion (string, number, boolean, array)
- Validation with detailed error messages
- Generating templates from example messages
- Custom parsing logic through extension

For more details, see the [Template Parser documentation](./docs/TEMPLATE_PARSER.md).

### 3. AI Message Processing

#### Smart Reply Suggestions
```javascript
// Enable smart replies with a focus on both freeform and templated inputs
client.enableSmartReplies({
    threshold: 0.7,
    maxSuggestions: 3
});

client.on('message', async (msg) => {
    const suggestions = await msg.getSmartReplies();
    console.log('Suggested responses:', suggestions);
});
```

#### Sentiment Analysis
```javascript
client.on('message', async (msg) => {
    const sentiment = await msg.analyzeSentiment();
    if (sentiment.score < -0.5) {
        // Handle negative sentiment scenarios
    }
});
```

### 4. Content Moderation

#### Automatic Content Filtering
```javascript
client.enableContentModeration({
    toxicity: true,
    spam: true,
    customRules: [
        // Add custom moderation rules as needed
    ]
});
```

### 5. Language Processing

#### Translation
```javascript
client.on('message', async (msg) => {
    if (msg.body.startsWith('!translate')) {
        const translated = await msg.translate('en');
        await msg.reply(translated);
    }
});
```

#### Language Detection
```javascript
client.on('message', async (msg) => {
    const lang = await msg.detectLanguage();
    console.log(`Message language: ${lang}`);
});
```

## Advanced Features

### 1. Conversation Management

#### Thread Memory
Maintain conversation context across multiple messages and sessions.
```javascript
const thread = await client.ai.createThread(msg.chat.id);
await thread.addContext('user preferences', userPrefs);
const response = await thread.ask(msg.body);
```

### 2. Function Calling

#### Custom Function Integration
```javascript
client.ai.registerFunctions({
    checkInventory: async (product) => {
        // Check product inventory
    },
    processOrder: async (order) => {
        // Process order
    }
});
```

### 3. Multi-Modal Support

#### Image Understanding
```javascript
client.on('message', async (msg) => {
    if (msg.hasMedia) {
        const description = await msg.describeImage();
        await msg.reply(`I see: ${description}`);
    }
});
```

## Implementation

### 1. AI Provider Interface
```typescript
interface AIProvider {
    ask(prompt: string, context?: any): Promise<string>;
    createThread(chatId: string): Promise<Thread>;
    analyzeContent(content: any): Promise<Analysis>;
    // ... other methods
}
```

### 2. Thread Management
```typescript
interface Thread {
    id: string;
    chatId: string;
    addContext(key: string, value: any): Promise<void>;
    getContext(): Promise<any>;
    ask(prompt: string): Promise<string>;
    // ... other methods
}
```

### 3. Content Analysis
```typescript
interface Analysis {
    sentiment: number;
    language: string;
    toxicity?: number;
    spam?: boolean;
    entities?: Entity[];
    // ... other properties
}
```

### 4. Template Parser
```typescript
interface TemplateParser {
    parseMessage(message: string, template: MessageTemplate): ParsedMessage;
    validateParsedMessage(parsed: ParsedMessage, template: MessageTemplate): boolean;
    generateTemplate(examples: string[]): MessageTemplate;
}

interface MessageTemplate {
    fields: {
        [key: string]: {
            type: 'string' | 'number' | 'boolean' | 'array';
            required: boolean;
            pattern?: string;
        }
    };
    examples?: string[];
}

interface ParsedMessage {
    [key: string]: any;
    isValid: boolean;
    errors?: string[];
}
```

## Configuration

### 1. Provider Settings
```javascript
{
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    assistantId: process.env.OPENAI_ASSISTANT_ID,
    defaultModel: 'gpt-4-turbo-preview',
    options: {
        temperature: 0.7,
        maxTokens: 500
    }
}
```

### 2. Memory Settings
```javascript
{
    memoryType: 'persistent',  // or 'session'
    storageProvider: 'redis',  // or 'memory', 'file'
    ttl: 3600,  // Time to live in seconds
    maxThreads: 1000
}
```

### 3. Template Settings
```javascript
{
    defaultTemplates: {
        order: {
            fields: {
                product: { type: 'string', required: true },
                quantity: { type: 'number', required: true },
                address: { type: 'string', required: false }
            },
            examples: [
                '!order product:iPhone quantity:1',
                '!order product:Laptop quantity:2 address:123 Main St'
            ]
        },
        help: {
            fields: {
                command: { type: 'string', required: false }
            },
            examples: [
                '!help',
                '!help command:order'
            ]
        }
    }
}
```

## Usage Examples

### 1. Customer Service Bot
```javascript
const bot = new AIAssistant({
    role: 'customer_service',
    knowledge: './customer_service_data',
    responses: {
        greeting: 'Hello! How can I help you today?',
        farewell: 'Thank you for contacting us!'
    }
});

client.on('message', async (msg) => {
    if (msg.fromMe) return;
    const response = await bot.handleCustomerQuery(msg);
    await msg.reply(response);
});
```

### 2. Language Learning Assistant
```javascript
const languageBot = new AIAssistant({
    role: 'language_tutor',
    languages: ['en', 'es', 'fr'],
    features: {
        correction: true,
        explanation: true,
        examples: true
    }
});

client.on('message', async (msg) => {
    const correction = await languageBot.correct(msg.body);
    await msg.reply(correction);
});
```

### 3. Template-Based Command Parsing
```javascript
client.on('message', async (msg) => {
    if (msg.body.startsWith('!order')) {
        const template = client.ai.templates.get('order');
        const parsed = client.ai.parseMessage(msg.body, template);
        
        if (parsed.isValid) {
            await msg.reply(`Processing order for ${parsed.product} (Quantity: ${parsed.quantity})`);
            // Process the order with the structured data
            const orderResult = await processOrder(parsed);
            await msg.reply(`Order status: ${orderResult.status}`);
        } else {
            await msg.reply(`Invalid order format. Example: !order product:iPhone quantity:1`);
        }
    }
});
```

## Security and Privacy

### 1. Data Handling
- **Encryption & Compliance:**  
  Ensure end-to-end encryption, anonymize sensitive data, and follow data retention policies compliant with regulations like GDPR.
- **Secure API Key Management:**  
  Use environment variables or secrets management tools to protect API keys.

### 2. Rate Limiting
- **Throttling and Cost Control:**  
  Implement API call limits and message frequency controls to manage costs and prevent abuse.
- **User-based Quotas:**  
  Set different limits for different users or user groups.

### 3. Error Handling
- **Robust and Graceful:**  
  Include try-catch blocks in asynchronous operations, use fallback responses when external AI services are unavailable, and provide clear error reporting.
- **Fallback Mechanisms:**  
  Implement fallback responses and degraded operation modes when AI services are unavailable.

## Future Enhancements

### 1. Additional AI Providers
- [ ] Anthropic Claude
- [ ] Google Gemini
- [ ] Local LLMs

### 2. Advanced Features
- [ ] Voice message transcription
- [ ] Image generation
- [ ] Code analysis
- [ ] Document summarization

### 3. Integration Tools
- [ ] Web dashboard for administration
- [ ] Detailed analytics and monitoring
- [ ] Custom training modules for specialized use cases 