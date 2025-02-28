'use strict';

/**
 * AI Provider Interface
 * Abstract class for AI providers
 */
class AIProvider {
    /**
     * Create a new AI provider instance
     * @param {Object} options - Provider options
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Generate a response from the AI
     * @param {string} systemPrompt - System prompt
     * @param {Array<Object>} messages - Message history
     * @param {Object} options - Request options
     * @returns {Promise<Object>} AI response
     */
    async generateResponse(systemPrompt, messages, options = {}) {
        console.log('Using default AIProvider implementation with options:', options);
        throw new Error('Method not implemented');
    }

    /**
     * Create a provider instance
     * @param {string} provider - Provider name
     * @param {Object} options - Provider options
     * @returns {AIProvider} Provider instance
     */
    static create(provider, options = {}) {
        const Provider = AIProvider.providers[provider];
        if (!Provider) {
            throw new Error(`Unsupported AI provider: ${provider}`);
        }
        return new Provider(options);
    }
}

/**
 * Registered providers
 * @type {Object.<string, typeof AIProvider>}
 */
AIProvider.providers = {};

/**
 * Register a provider
 * @param {string} name - Provider name
 * @param {typeof AIProvider} Provider - Provider class
 */
AIProvider.registerProvider = (name, Provider) => {
    AIProvider.providers[name] = Provider;
};

/**
 * OpenAI Provider
 * @extends {AIProvider}
 */
class OpenAIProvider extends AIProvider {
    constructor(options = {}) {
        super(options);
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel || 'gpt-4-turbo-preview';
    }

    async generateResponse(systemPrompt, messages, options = {}) {
        const OpenAI = await import('openai');
        const openai = new OpenAI({ apiKey: this.apiKey });

        const completion = await openai.chat.completions.create({
            model: options.model || this.defaultModel,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            temperature: options.temperature || this.options.temperature || 0.7,
            max_tokens: options.maxTokens || this.options.maxTokens || 500,
            functions: options.functions,
            function_call: options.functionCall || 'auto'
        });

        return completion.choices[0]?.message;
    }
}

/**
 * Anthropic Provider
 * @extends {AIProvider}
 */
class AnthropicProvider extends AIProvider {
    constructor(options = {}) {
        super(options);
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel || 'claude-3-opus-20240229';
    }

    async generateResponse(systemPrompt, messages, options = {}) {
        const Anthropic = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic.Anthropic({ apiKey: this.apiKey });

        // Convert messages to Anthropic format
        const formattedMessages = messages.map(msg => {
            if (msg.role === 'assistant') return { role: 'assistant', content: msg.content };
            if (msg.role === 'user') return { role: 'user', content: msg.content };
            if (msg.role === 'function') {
                return { 
                    role: 'user', 
                    content: `Function result from ${msg.name}: ${msg.content}`
                };
            }
            return null;
        }).filter(Boolean);

        // Add system prompt as a user message at the beginning
        formattedMessages.unshift({
            role: 'user',
            content: `System: ${systemPrompt}`
        });

        const response = await anthropic.messages.create({
            model: options.model || this.defaultModel,
            messages: formattedMessages,
            max_tokens: options.maxTokens || this.options.maxTokens || 1024,
            temperature: options.temperature || this.options.temperature || 0.7
        });

        return {
            role: 'assistant',
            content: response.content[0].text
        };
    }
}

/**
 * Google AI Provider
 * @extends {AIProvider}
 */
class GoogleAIProvider extends AIProvider {
    constructor(options = {}) {
        super(options);
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel || 'gemini-pro';
    }

    async generateResponse(systemPrompt, messages, options = {}) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({ model: options.model || this.defaultModel });

        // Convert messages to Google AI format
        const formattedMessages = [];
        
        // Add system prompt as a user message at the beginning
        formattedMessages.push({
            role: 'user',
            parts: [{ text: `System: ${systemPrompt}` }]
        });
        
        // Add the rest of the messages
        for (const msg of messages) {
            if (msg.role === 'assistant') {
                formattedMessages.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.role === 'user') {
                formattedMessages.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.role === 'function') {
                formattedMessages.push({
                    role: 'user',
                    parts: [{ text: `Function result from ${msg.name}: ${msg.content}` }]
                });
            }
        }

        const result = await model.generateContent({
            contents: formattedMessages,
            generationConfig: {
                temperature: options.temperature || this.options.temperature || 0.7,
                maxOutputTokens: options.maxTokens || this.options.maxTokens || 1024
            }
        });

        return {
            role: 'assistant',
            content: result.response.text()
        };
    }
}

/**
 * Local AI Provider (using Ollama)
 * @extends {AIProvider}
 */
class LocalAIProvider extends AIProvider {
    constructor(options = {}) {
        super(options);
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.defaultModel = options.defaultModel || 'llama3';
    }

    async generateResponse(systemPrompt, messages, options = {}) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model || this.defaultModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                options: {
                    temperature: options.temperature || this.options.temperature || 0.7
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return {
            role: 'assistant',
            content: result.message.content
        };
    }
}

// Register providers
AIProvider.registerProvider('openai', OpenAIProvider);
AIProvider.registerProvider('anthropic', AnthropicProvider);
AIProvider.registerProvider('google', GoogleAIProvider);
AIProvider.registerProvider('local', LocalAIProvider);

module.exports = AIProvider; 