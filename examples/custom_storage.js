const { Client, LocalAuth } = require('../index');
const fs = require('fs').promises;
const path = require('path');

/**
 * This example demonstrates how to use custom storage options for AI threads.
 * It implements a simple file-based storage system and shows how to integrate it.
 */

// Custom file-based thread storage implementation
class FileThreadStorage {
    constructor(options = {}) {
        this.storagePath = options.storagePath || path.join(process.cwd(), 'thread_storage');
        this.ttl = options.ttl || 3600; // Default 1 hour TTL
        
        // Create storage directory if it doesn't exist
        this._initStorage();
    }
    
    async _initStorage() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
            console.log(`[STORAGE] Initialized storage at ${this.storagePath}`);
        } catch (error) {
            console.error('[STORAGE] Error initializing storage:', error);
        }
    }
    
    async getThread(chatId) {
        try {
            const filePath = path.join(this.storagePath, `${chatId}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const thread = JSON.parse(data);
            
            // Check if thread has expired
            if (thread.lastUsed && Date.now() - thread.lastUsed > this.ttl * 1000) {
                console.log(`[STORAGE] Thread ${chatId} has expired`);
                await this.deleteThread(chatId);
                return null;
            }
            
            console.log(`[STORAGE] Retrieved thread for ${chatId}`);
            return thread;
        } catch (error) {
            // File doesn't exist or other error
            return null;
        }
    }
    
    async saveThread(threadData) {
        try {
            const filePath = path.join(this.storagePath, `${threadData.chatId}.json`);
            await fs.writeFile(filePath, JSON.stringify(threadData, null, 2), 'utf8');
            console.log(`[STORAGE] Saved thread for ${threadData.chatId}`);
            return true;
        } catch (error) {
            console.error(`[STORAGE] Error saving thread for ${threadData.chatId}:`, error);
            return false;
        }
    }
    
    async deleteThread(chatId) {
        try {
            const filePath = path.join(this.storagePath, `${chatId}.json`);
            await fs.unlink(filePath);
            console.log(`[STORAGE] Deleted thread for ${chatId}`);
            return true;
        } catch (error) {
            // File doesn't exist or other error
            return false;
        }
    }
    
    async getAllThreads() {
        try {
            const files = await fs.readdir(this.storagePath);
            const threads = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const chatId = file.replace('.json', '');
                    const thread = await this.getThread(chatId);
                    if (thread) {
                        threads.push(thread);
                    }
                }
            }
            
            return threads;
        } catch (error) {
            console.error('[STORAGE] Error getting all threads:', error);
            return [];
        }
    }
}

// Register the custom storage provider
const ThreadStorage = require('../src/structures/storage/ThreadStorage');
ThreadStorage.registerProvider('file', FileThreadStorage);

// Create a client with AI enabled and custom storage
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
    },
    ai: {
        enabled: true,
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview',
        storageProvider: 'file',
        storageOptions: {
            storagePath: path.join(process.cwd(), 'custom_thread_storage'),
            ttl: 86400 // 24 hours
        }
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
        // Special command to list all threads
        if (msg.body === '!threads') {
            const storage = client.ai._storage;
            const threads = await storage.getAllThreads();
            
            if (threads.length === 0) {
                await msg.reply('No active threads found.');
                return;
            }
            
            const threadList = threads.map(thread => {
                const lastUsed = new Date(thread.lastUsed).toLocaleString();
                return `- Chat ID: ${thread.chatId}\n  Last used: ${lastUsed}\n  Context keys: ${Object.keys(thread.context).join(', ')}`;
            }).join('\n\n');
            
            await msg.reply(`Active threads (${threads.length}):\n\n${threadList}`);
            return;
        }
        
        // Special command to clear thread
        if (msg.body === '!clear') {
            await client.ai._storage.deleteThread(msg.from);
            await msg.reply('Your conversation history has been cleared.');
            return;
        }
        
        // Process the message through the AI
        const response = await client.ai.ask(msg.from, msg.body);
        
        // Send the response
        await msg.reply(response);
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Initialize the client
client.initialize(); 