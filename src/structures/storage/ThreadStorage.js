'use strict';

/**
 * Thread Storage Interface
 * Abstract class for thread storage providers
 */
class ThreadStorage {
    /**
     * Create a new thread storage instance
     * @param {Object} options - Storage options
     */
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Get thread data by chat ID
     * @param {string} chatId - Chat ID
     * @returns {Promise<Object|null>} Thread data or null if not found
     */
    async getThread(chatId) {
        console.log(`ThreadStorage.getThread called for ${chatId}`);
        throw new Error('Method not implemented');
    }

    /**
     * Save thread data
     * @param {Object} threadData - Thread data to save
     * @returns {Promise<void>}
     */
    async saveThread(threadData) {
        console.log(`ThreadStorage.saveThread called for ${threadData.chatId}`);
        throw new Error('Method not implemented');
    }

    /**
     * Delete thread data
     * @param {string} chatId - Chat ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async deleteThread(chatId) {
        console.log(`ThreadStorage.deleteThread called for ${chatId}`);
        throw new Error('Method not implemented');
    }

    /**
     * Get all threads
     * @param {Object} [query] - Query parameters
     * @returns {Promise<Array<Object>>} Array of thread data
     */
    async getAllThreads(query = {}) {
        console.log('ThreadStorage.getAllThreads called with query:', query);
        throw new Error('Method not implemented');
    }

    /**
     * Create a thread storage instance
     * @param {string} provider - Storage provider name
     * @param {Object} options - Storage options
     * @returns {ThreadStorage} Thread storage instance
     */
    static create(provider, options = {}) {
        switch (provider) {
        case 'memory':
            return new MemoryThreadStorage(options);
        case 'mongodb':
            return new MongoDBThreadStorage(options);
        case 'sql':
            return new SQLThreadStorage(options);
        default:
            throw new Error(`Unsupported storage provider: ${provider}`);
        }
    }
}

/**
 * In-Memory Thread Storage
 * Stores threads in memory
 * @extends {ThreadStorage}
 */
class MemoryThreadStorage extends ThreadStorage {
    constructor(options = {}) {
        super(options);
        this._threads = new Map();
    }

    async getThread(chatId) {
        const thread = this._threads.get(chatId);
        if (!thread) return null;

        // Check TTL
        if (this.options.ttl && Date.now() - thread.lastUsed > this.options.ttl * 1000) {
            this._threads.delete(chatId);
            return null;
        }

        return thread;
    }

    async saveThread(threadData) {
        this._threads.set(threadData.chatId, threadData);
    }

    async deleteThread(chatId) {
        return this._threads.delete(chatId);
    }

    async getAllThreads(query = {}) {
        return Array.from(this._threads.values());
    }
}

/**
 * MongoDB Thread Storage
 * Stores threads in MongoDB
 * @extends {ThreadStorage}
 */
class MongoDBThreadStorage extends ThreadStorage {
    constructor(options = {}) {
        super(options);
        this._initialized = false;
        this._initPromise = this._initialize();
    }

    async _initialize() {
        try {
            const { MongoClient } = require('mongodb');
            
            // Connect to MongoDB
            this._client = new MongoClient(this.options.uri || 'mongodb://localhost:27017');
            await this._client.connect();
            
            // Get database and collection
            this._db = this._client.db(this.options.dbName || 'whatsapp_web_js');
            this._collection = this._db.collection(this.options.collectionName || 'threads');
            
            // Create indexes
            await this._collection.createIndex({ chatId: 1 }, { unique: true });
            await this._collection.createIndex({ lastUsed: 1 });
            
            this._initialized = true;
        } catch (error) {
            console.error('Failed to initialize MongoDB thread storage:', error);
            throw error;
        }
    }

    async _ensureInitialized() {
        if (!this._initialized) {
            await this._initPromise;
        }
    }

    async getThread(chatId) {
        await this._ensureInitialized();
        
        const thread = await this._collection.findOne({ chatId });
        if (!thread) return null;

        // Check TTL
        if (this.options.ttl && Date.now() - thread.lastUsed > this.options.ttl * 1000) {
            await this._collection.deleteOne({ chatId });
            return null;
        }

        return thread;
    }

    async saveThread(threadData) {
        await this._ensureInitialized();
        
        // Use upsert to create or update
        await this._collection.updateOne(
            { chatId: threadData.chatId },
            { $set: threadData },
            { upsert: true }
        );
    }

    async deleteThread(chatId) {
        await this._ensureInitialized();
        
        const result = await this._collection.deleteOne({ chatId });
        return result.deletedCount > 0;
    }

    // eslint-disable-next-line no-unused-vars
    async getAllThreads(query = {}) {
        await this._ensureInitialized();
        
        // Log the query being used
        console.log('[MongoDB] Finding threads with query:', query);
        
        // The query parameter is directly used in the MongoDB find operation
        // This is intentional as MongoDB's find() method accepts a query object
        return await this._collection.find(query).toArray();
    }
}

/**
 * SQL Thread Storage
 * Stores threads in SQL database
 * @extends {ThreadStorage}
 */
class SQLThreadStorage extends ThreadStorage {
    constructor(options = {}) {
        super(options);
        this._initialized = false;
        this._initPromise = this._initialize();
    }

    async _initialize() {
        try {
            // Determine SQL dialect
            const dialect = this.options.dialect || 'sqlite';
            
            // Import required modules
            const { Sequelize, DataTypes } = require('sequelize');
            
            // Create Sequelize instance
            if (dialect === 'sqlite') {
                this._sequelize = new Sequelize({
                    dialect,
                    storage: this.options.storage || 'threads.sqlite',
                    logging: this.options.logging || false
                });
            } else {
                this._sequelize = new Sequelize(
                    this.options.database || 'whatsapp_web_js',
                    this.options.username,
                    this.options.password,
                    {
                        host: this.options.host || 'localhost',
                        dialect,
                        logging: this.options.logging || false
                    }
                );
            }
            
            // Define Thread model
            this._Thread = this._sequelize.define('Thread', {
                chatId: {
                    type: DataTypes.STRING,
                    primaryKey: true
                },
                context: {
                    type: DataTypes.JSON,
                    defaultValue: {}
                },
                history: {
                    type: DataTypes.JSON,
                    defaultValue: []
                },
                lastUsed: {
                    type: DataTypes.DATE,
                    defaultValue: DataTypes.NOW
                }
            });
            
            // Sync model with database
            await this._Thread.sync();
            
            this._initialized = true;
        } catch (error) {
            console.error('Failed to initialize SQL thread storage:', error);
            throw error;
        }
    }

    async _ensureInitialized() {
        if (!this._initialized) {
            await this._initPromise;
        }
    }

    async getThread(chatId) {
        await this._ensureInitialized();
        
        const thread = await this._Thread.findByPk(chatId);
        if (!thread) return null;

        const threadData = thread.toJSON();

        // Check TTL
        if (this.options.ttl && Date.now() - new Date(threadData.lastUsed).getTime() > this.options.ttl * 1000) {
            await this._Thread.destroy({ where: { chatId } });
            return null;
        }

        return threadData;
    }

    async saveThread(threadData) {
        await this._ensureInitialized();
        
        await this._Thread.upsert({
            chatId: threadData.chatId,
            context: threadData.context,
            history: threadData.history,
            lastUsed: threadData.lastUsed
        });
    }

    async deleteThread(chatId) {
        await this._ensureInitialized();
        
        const deleted = await this._Thread.destroy({ where: { chatId } });
        return deleted > 0;
    }

    async getAllThreads(query = {}) {
        await this._ensureInitialized();
        
        // Convert query object to Sequelize where clause
        const whereClause = {};
        
        // Add query parameters to where clause if they match model fields
        Object.entries(query).forEach(([key, value]) => {
            if (this._Thread.rawAttributes[key]) {
                whereClause[key] = value;
            }
        });
        
        const threads = await this._Thread.findAll({ where: whereClause });
        return threads.map(thread => thread.toJSON());
    }
}

module.exports = ThreadStorage; 