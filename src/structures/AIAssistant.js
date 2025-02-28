'use strict';

const Base = require('./Base');
const Thread = require('./Thread');
const ThreadStorage = require('./storage/ThreadStorage');

/**
 * AI Assistant for WhatsApp Web
 * @extends {Base}
 */
class AIAssistant extends Base {
    constructor(client, options = {}) {
        super(client);

        /**
         * AI provider configuration
         * @type {Object}
         */
        this.config = {
            provider: options.provider || 'openai',
            apiKey: options.apiKey,
            assistantId: options.assistantId,
            defaultModel: options.defaultModel || 'gpt-4-turbo-preview',
            options: {
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 500,
                ...options.options
            }
        };

        /**
         * Memory configuration
         * @type {Object}
         */
        this.memory = {
            type: options.memoryType || 'session',
            provider: options.storageProvider || 'memory',
            ttl: options.ttl || 3600,
            maxThreads: options.maxThreads || 1000,
            ...options.storageOptions
        };

        /**
         * Thread storage provider
         * @type {ThreadStorage}
         * @private
         */
        this._storage = ThreadStorage.create(this.memory.provider, {
            ...this.memory,
            client: this
        });

        /**
         * Active threads (in-memory cache)
         * @type {Map<string, Thread>}
         * @private
         */
        this._threads = new Map();

        /**
         * Custom functions
         * @type {Map<string, Function>}
         * @private
         */
        this._functions = new Map();

        /**
         * Middleware stack
         * @type {Array<Function>}
         * @private
         */
        this._middleware = [];

        /**
         * Statistics
         * @type {Object}
         * @private
         */
        this._stats = {
            requests: 0,
            errors: 0,
            startTime: Date.now(),
            requestTimes: []
        };

        /**
         * Handoff state for each chat
         * @type {Map<string, HandoffState>}
         * @private
         */
        this._handoffState = new Map();

        /**
         * Human operator handlers
         * @type {Object}
         * @private
         */
        this._humanHandlers = {
            onHandoff: null,
            onMessage: null,
            onRelease: null
        };
    }

    /**
     * Add middleware to the AI processing pipeline
     * @param {Function} middleware - Middleware function
     * @returns {AIAssistant} This AI assistant
     */
    use(middleware) {
        this._middleware.push(middleware);
        return this;
    }

    /**
     * Execute middleware chain
     * @param {Object} context - Context object
     * @returns {Promise<Object>} Processed context
     * @private
     */
    async _executeMiddleware(context) {
        let index = 0;
        
        const next = async () => {
            if (index < this._middleware.length) {
                const middleware = this._middleware[index++];
                await middleware(context, next);
            }
        };
        
        await next();
        return context;
    }

    /**
     * Ask a question to the AI assistant
     * @param {string} chatId - The chat ID
     * @param {string} prompt - The question or prompt
     * @param {Object} [options] - Additional options
     * @returns {Promise<string>} The assistant's response
     */
    async ask(chatId, prompt, options = {}) {
        // Check if this chat is in human mode
        if (this.isInHumanMode(chatId) && !options.ignoreHandoffState) {
            throw new Error('Cannot use AI to respond while in human mode. Use releaseToAI first or set ignoreHandoffState option.');
        }
        
        const startTime = Date.now();
        this._stats.requests++;
        
        try {
            // Create context object
            const context = {
                chatId,
                prompt,
                options,
                response: null,
                thread: null,
                error: null
            };
            
            // Execute middleware (pre-processing)
            await this._executeMiddleware(context);
            
            // If middleware set a response, return it
            if (context.response) {
                return context.response;
            }
            
            // Get or create thread
            let thread = context.thread || this._threads.get(chatId);
            if (!thread) {
                thread = await this.createThread(chatId);
                context.thread = thread;
            }
            
            // Ask the question
            context.response = await thread.ask(prompt, options);
            
            // Update stats
            const requestTime = Date.now() - startTime;
            this._stats.requestTimes.push(requestTime);
            if (this._stats.requestTimes.length > 100) {
                this._stats.requestTimes.shift();
            }
            
            return context.response;
        } catch (error) {
            this._stats.errors++;
            
            // If fallback response is provided, return it
            if (options.fallbackResponse) {
                return options.fallbackResponse;
            }
            
            // Re-throw the error
            throw error;
        }
    }

    /**
     * Create a new thread for a chat
     * @param {string} chatId - The chat ID
     * @returns {Promise<Thread>} The created thread
     */
    async createThread(chatId) {
        // Clean up old threads if needed
        if (this._threads.size >= this.memory.maxThreads) {
            await this._cleanupOldThreads();
        }

        // Try to load existing thread from storage
        let threadData = await this._storage.getThread(chatId);
        
        // Create new thread if not found
        if (!threadData) {
            threadData = {
                chatId,
                context: {},
                history: [],
                lastUsed: Date.now()
            };
        }

        const thread = new Thread(this, chatId, threadData);
        this._threads.set(chatId, thread);
        return thread;
    }

    /**
     * Save thread data to storage
     * @param {Thread} thread - Thread to save
     * @returns {Promise<void>}
     */
    async saveThread(thread) {
        const threadData = {
            chatId: thread.chatId,
            context: thread.getContext(),
            history: thread._history,
            lastUsed: thread.lastUsed
        };
        
        await this._storage.saveThread(threadData);
    }

    /**
     * Register custom functions
     * @param {Object.<string, Function>} functions - Functions to register
     */
    registerFunctions(functions) {
        for (const [name, fn] of Object.entries(functions)) {
            this._functions.set(name, fn);
        }
    }

    /**
     * Clean up old threads
     * @private
     */
    async _cleanupOldThreads() {
        const threads = Array.from(this._threads.entries());
        threads.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        
        // Remove oldest threads until we're under the limit
        while (this._threads.size >= this.memory.maxThreads) {
            const [chatId, thread] = threads.shift();
            // Save thread before removing from memory
            await this.saveThread(thread);
            this._threads.delete(chatId);
        }
    }

    /**
     * Get statistics about the AI assistant
     * @returns {Object} Statistics
     */
    getStats() {
        const totalTime = this._stats.requestTimes.reduce((sum, time) => sum + time, 0);
        const avgTime = this._stats.requestTimes.length > 0 
            ? totalTime / this._stats.requestTimes.length 
            : 0;
        
        const uptime = Date.now() - this._stats.startTime;
        const requestsPerMinute = this._stats.requests / (uptime / 60000);
        
        return {
            requests: this._stats.requests,
            errors: this._stats.errors,
            errorRate: this._stats.requests > 0 
                ? this._stats.errors / this._stats.requests 
                : 0,
            averageResponseTime: avgTime,
            requestsPerMinute,
            uptime,
            activeThreads: this._threads.size
        };
    }

    /**
     * Analyze sentiment of a message
     * @param {string} text - Text to analyze
     * @returns {Promise<Object>} Sentiment analysis result
     */
    async analyzeSentiment(text) {
        const prompt = `Analyze the sentiment of this text and return a score between -1 (very negative) and 1 (very positive): "${text}"`;
        const response = await this.ask('system', prompt);
        const score = parseFloat(response) || 0;
        return {
            score,
            text,
            isPositive: score > 0,
            isNegative: score < 0,
            isNeutral: score === 0
        };
    }

    /**
     * Get smart reply suggestions
     * @param {string} text - Message to get suggestions for
     * @param {Object} [options] - Additional options
     * @returns {Promise<string[]>} Array of suggested replies
     */
    async getSmartReplies(text, options = {}) {
        const prompt = `Generate ${options.maxSuggestions || 3} natural, contextually appropriate responses to this message: "${text}"`;
        const response = await this.ask('system', prompt);
        return response.split('\n').map(r => r.trim()).filter(Boolean);
    }

    /**
     * Detect language of text
     * @param {string} text - Text to analyze
     * @returns {Promise<string>} Detected language code
     */
    async detectLanguage(text) {
        const prompt = `What is the ISO language code of this text? Just return the 2-letter code: "${text}"`;
        return (await this.ask('system', prompt)).trim().toLowerCase();
    }

    /**
     * Translate text
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code
     * @returns {Promise<string>} Translated text
     */
    async translate(text, targetLang) {
        const prompt = `Translate this text to ${targetLang}: "${text}"`;
        return (await this.ask('system', prompt)).trim();
    }

    /**
     * Register human operator handlers
     * @param {Object} handlers - Handler functions
     * @param {Function} handlers.onHandoff - Called when a conversation is handed off to a human
     * @param {Function} handlers.onMessage - Called when a message is received while in human mode
     * @param {Function} handlers.onRelease - Called when a conversation is released back to the AI
     */
    registerHumanHandlers(handlers = {}) {
        if (handlers.onHandoff && typeof handlers.onHandoff === 'function') {
            this._humanHandlers.onHandoff = handlers.onHandoff;
        }
        
        if (handlers.onMessage && typeof handlers.onMessage === 'function') {
            this._humanHandlers.onMessage = handlers.onMessage;
        }
        
        if (handlers.onRelease && typeof handlers.onRelease === 'function') {
            this._humanHandlers.onRelease = handlers.onRelease;
        }
    }

    /**
     * Hand off a conversation to a human operator
     * @param {string} chatId - The chat ID
     * @param {string} reason - Reason for the handoff
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<boolean>} Success status
     */
    async handoffToHuman(chatId, reason = '', metadata = {}) {
        // Get or create thread to preserve context
        let thread = this._threads.get(chatId);
        if (!thread) {
            thread = await this.createThread(chatId);
        }

        // Update handoff state
        const handoffState = {
            isHumanMode: true,
            handoffTime: Date.now(),
            reason,
            metadata,
            threadId: thread.chatId
        };
        
        this._handoffState.set(chatId, handoffState);
        
        // Save handoff state to thread context
        thread.addContext('handoffState', handoffState);
        await this.saveThread(thread);
        
        // Notify human operator if handler is registered
        if (this._humanHandlers.onHandoff) {
            try {
                await this._humanHandlers.onHandoff(chatId, thread, handoffState);
            } catch (error) {
                console.error('Error in human handoff handler:', error);
            }
        }
        
        return true;
    }

    /**
     * Release a conversation back to the AI
     * @param {string} chatId - The chat ID
     * @param {string} summary - Summary of the human interaction
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<boolean>} Success status
     */
    async releaseToAI(chatId, summary = '', metadata = {}) {
        // Check if the chat is in human mode
        if (!this.isInHumanMode(chatId)) {
            return false;
        }
        
        // Get thread
        let thread = this._threads.get(chatId);
        if (!thread) {
            thread = await this.createThread(chatId);
        }
        
        // Update handoff state
        this._handoffState.delete(chatId);
        
        // Add summary to thread context
        if (summary) {
            thread.addContext('humanInteractionSummary', summary);
            
            // Add summary to thread history as a system message
            thread._history.push({
                role: 'system',
                content: `Human operator summary: ${summary}`
            });
        }
        
        // Add metadata to thread context
        if (metadata && Object.keys(metadata).length > 0) {
            thread.addContext('releaseMetadata', metadata);
        }
        
        await this.saveThread(thread);
        
        // Notify human operator if handler is registered
        if (this._humanHandlers.onRelease) {
            try {
                await this._humanHandlers.onRelease(chatId, thread, { summary, metadata });
            } catch (error) {
                console.error('Error in human release handler:', error);
            }
        }
        
        return true;
    }

    /**
     * Check if a chat is in human mode
     * @param {string} chatId - The chat ID
     * @returns {boolean} Whether the chat is in human mode
     */
    isInHumanMode(chatId) {
        return this._handoffState.has(chatId) && this._handoffState.get(chatId).isHumanMode;
    }

    /**
     * Get all chats currently in human mode
     * @returns {Array<Object>} Array of handoff states
     */
    getHumanModeChats() {
        return Array.from(this._handoffState.entries()).map(([chatId, state]) => ({
            chatId,
            ...state
        }));
    }

    /**
     * Process an incoming message with handoff awareness
     * @param {string} chatId - The chat ID
     * @param {string} message - The message content
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processMessage(chatId, message, options = {}) {
        // Check if this chat is in human mode
        if (this.isInHumanMode(chatId)) {
            // If in human mode, notify human operator
            if (this._humanHandlers.onMessage) {
                try {
                    const result = await this._humanHandlers.onMessage(chatId, message, this._handoffState.get(chatId));
                    return {
                        type: 'human',
                        response: result?.response,
                        handled: result?.handled || false,
                        handoffState: this._handoffState.get(chatId)
                    };
                } catch (error) {
                    console.error('Error in human message handler:', error);
                }
            }
            
            // Return indication that message should be handled by human
            return {
                type: 'human',
                response: null,
                handled: false,
                handoffState: this._handoffState.get(chatId)
            };
        }
        
        // Check for handoff commands in the message
        if (message.toLowerCase().includes('#handoff') || 
            message.toLowerCase().includes('#human') ||
            message.toLowerCase().includes('#agent')) {
            
            // Extract reason from message
            const reasonMatch = message.match(/#(handoff|human|agent)\s+(.+)/i);
            const reason = reasonMatch ? reasonMatch[2] : 'User requested human assistance';
            
            // Perform handoff
            await this.handoffToHuman(chatId, reason, { 
                triggerMessage: message,
                automatic: false
            });
            
            return {
                type: 'handoff',
                response: 'I\'m transferring you to a human agent who will assist you shortly.',
                handoffState: this._handoffState.get(chatId)
            };
        }
        
        // Process with AI as normal
        try {
            const response = await this.ask(chatId, message, options);
            
            // Check if AI response indicates need for human (can be customized)
            if (response.toLowerCase().includes('[handoff]') || 
                response.toLowerCase().includes('[human needed]')) {
                
                // Extract reason from AI response
                const reasonMatch = response.match(/\[(handoff|human needed)\s*:?\s*([^\]]+)\]/i);
                const reason = reasonMatch ? reasonMatch[2] : 'AI requested human assistance';
                const cleanResponse = response.replace(/\[(handoff|human needed)[^\]]*\]/gi, '').trim();
                
                // Perform handoff
                await this.handoffToHuman(chatId, reason, { 
                    triggerMessage: message,
                    aiResponse: cleanResponse,
                    automatic: true
                });
                
                return {
                    type: 'handoff',
                    response: cleanResponse || 'I\'m transferring you to a human agent who will assist you shortly.',
                    handoffState: this._handoffState.get(chatId)
                };
            }
            
            return {
                type: 'ai',
                response
            };
        } catch (error) {
            console.error('Error processing message with AI:', error);
            
            // Optionally perform automatic handoff on error
            if (options.handoffOnError) {
                await this.handoffToHuman(chatId, 'AI processing error', { 
                    error: error.message,
                    triggerMessage: message,
                    automatic: true
                });
                
                return {
                    type: 'handoff',
                    response: 'I\'m having trouble processing your request. I\'m transferring you to a human agent who will assist you shortly.',
                    handoffState: this._handoffState.get(chatId),
                    error: error.message
                };
            }
            
            throw error;
        }
    }
}

module.exports = AIAssistant; 