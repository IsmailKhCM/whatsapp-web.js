'use strict';

const Base = require('./Base');
const AIProvider = require('./providers/AIProvider');

/**
 * Thread class for managing AI conversations
 * @extends {Base}
 */
class Thread extends Base {
    constructor(assistant, chatId, data = {}) {
        super(assistant.client);

        /**
         * The AI assistant this thread belongs to
         * @type {AIAssistant}
         * @private
         */
        this._assistant = assistant;

        /**
         * The chat ID this thread belongs to
         * @type {string}
         */
        this.chatId = chatId;

        /**
         * Thread context
         * @type {Map<string, any>}
         * @private
         */
        this._context = new Map(Object.entries(data.context || {}));

        /**
         * Message history
         * @type {Array<{role: string, content: string}>}
         * @private
         */
        this._history = data.history || [];

        /**
         * Last used timestamp
         * @type {number}
         */
        this.lastUsed = data.lastUsed || Date.now();

        /**
         * AI provider instance
         * @type {AIProvider}
         * @private
         */
        this._provider = AIProvider.create(assistant.config.provider, assistant.config);
    }

    /**
     * Add context to the thread
     * @param {string} key - Context key
     * @param {any} value - Context value
     */
    addContext(key, value) {
        this._context.set(key, value);
        this._saveChanges();
    }

    /**
     * Get thread context
     * @returns {Object} Thread context
     */
    getContext() {
        return Object.fromEntries(this._context);
    }

    /**
     * Ask a question in this thread
     * @param {string} prompt - The question or prompt
     * @param {Object} [options] - Additional options
     * @returns {Promise<string>} The assistant's response
     */
    async ask(prompt, options = {}) {
        this.lastUsed = Date.now();

        // Add message to history
        this._history.push({
            role: 'user',
            content: prompt
        });

        // Prepare context
        const context = this.getContext();
        const systemPrompt = `You are a helpful WhatsApp assistant. Current context: ${JSON.stringify(context)}`;

        // Call the AI provider
        const response = await this._callAI(systemPrompt, this._history, options);

        // Add response to history
        this._history.push({
            role: 'assistant',
            content: response
        });

        // Trim history if too long
        if (this._history.length > 20) {
            this._history = this._history.slice(-20);
        }

        // Save changes to storage
        await this._saveChanges();

        return response;
    }

    /**
     * Save thread changes to storage
     * @private
     */
    async _saveChanges() {
        await this._assistant.saveThread(this);
    }

    /**
     * Call the AI provider
     * @param {string} systemPrompt - System prompt
     * @param {Array} messages - Message history
     * @param {Object} options - Additional options
     * @returns {Promise<string>} AI response
     * @private
     */
    async _callAI(systemPrompt, messages, options) {
        try {
            // Get function definitions if needed
            const functions = this._assistant._functions.size > 0 
                ? this._getFunctionDefinitions() 
                : undefined;
            
            // Call the provider
            const response = await this._provider.generateResponse(systemPrompt, messages, {
                ...options,
                functions,
                functionCall: functions ? 'auto' : undefined
            });

            // Handle function calls
            if (response.function_call) {
                const result = await this._handleFunctionCall(response.function_call);
                return this._callAI(systemPrompt, [
                    ...messages,
                    { role: 'assistant', content: response.content },
                    { role: 'function', name: response.function_call.name, content: JSON.stringify(result) }
                ], options);
            }

            return response.content;
        } catch (error) {
            console.error('Error calling AI provider:', error);
            
            // Return fallback response if provided
            if (options.fallbackResponse) {
                return options.fallbackResponse;
            }
            
            // Try fallback provider if specified
            if (options.fallbackProvider) {
                try {
                    const fallbackProvider = AIProvider.create(options.fallbackProvider, this._assistant.config);
                    const fallbackResponse = await fallbackProvider.generateResponse(systemPrompt, messages, options);
                    return fallbackResponse.content;
                } catch (fallbackError) {
                    console.error('Error calling fallback provider:', fallbackError);
                }
            }
            
            // Re-throw the error
            throw error;
        }
    }

    /**
     * Get function definitions for the AI
     * @returns {Array<Object>} Function definitions
     * @private
     */
    _getFunctionDefinitions() {
        return Array.from(this._assistant._functions.entries()).map(([name, fn]) => ({
            name,
            description: fn.description || 'No description provided',
            parameters: fn.parameters || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }

    /**
     * Handle function calls from the AI
     * @param {Object} functionCall - Function call details
     * @returns {Promise<any>} Function result
     * @private
     */
    async _handleFunctionCall(functionCall) {
        const fn = this._assistant._functions.get(functionCall.name);
        if (!fn) {
            throw new Error(`Function ${functionCall.name} not found`);
        }

        try {
            const args = JSON.parse(functionCall.arguments);
            return await fn(args);
        } catch (error) {
            console.error(`Error executing function ${functionCall.name}:`, error);
            return { error: error.message };
        }
    }
}

module.exports = Thread; 