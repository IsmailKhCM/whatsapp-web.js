const { Client, LocalAuth } = require('../index');

/**
 * This example demonstrates how to use the middleware system with the AI assistant.
 * Middleware allows you to intercept and modify requests and responses before and after AI processing.
 */

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

// Add logging middleware
client.ai.use(async (context, next) => {
    console.log(`[LOGGING] Processing message from ${context.chatId}: ${context.prompt}`);
    
    // Record start time
    const startTime = Date.now();
    
    // Continue to the next middleware or the actual AI processing
    await next();
    
    // Log after processing
    const processingTime = Date.now() - startTime;
    console.log(`[LOGGING] AI response (${processingTime}ms): ${context.response}`);
});

// Add content filtering middleware
client.ai.use(async (context, next) => {
    console.log('[FILTER] Checking content...');
    
    // Simple profanity filter (in a real app, use a more comprehensive solution)
    const profanityList = ['badword1', 'badword2', 'badword3'];
    const containsProfanity = profanityList.some(word => 
        context.prompt.toLowerCase().includes(word)
    );
    
    if (containsProfanity) {
        console.log('[FILTER] Profanity detected, blocking request');
        context.response = 'I\'m sorry, but I can\'t process messages containing inappropriate language.';
        return; // Don't call next(), stopping the middleware chain
    }
    
    // Continue to the next middleware
    await next();
    
    // You can also filter responses if needed
    if (context.response && context.response.toLowerCase().includes('inappropriate')) {
        context.response = 'I apologize, but I can\'t provide that information.';
    }
});

// Add rate limiting middleware
const userRequests = {};
client.ai.use(async (context, next) => {
    // Initialize request count for this user if not exists
    if (!userRequests[context.chatId]) {
        userRequests[context.chatId] = {
            count: 0,
            resetTime: Date.now() + 3600000 // Reset after 1 hour
        };
    }
    
    // Check if reset time has passed
    if (Date.now() > userRequests[context.chatId].resetTime) {
        userRequests[context.chatId] = {
            count: 0,
            resetTime: Date.now() + 3600000
        };
    }
    
    // Check rate limit (10 requests per hour in this example)
    if (userRequests[context.chatId].count >= 10) {
        console.log(`[RATE LIMIT] User ${context.chatId} has exceeded the rate limit`);
        context.response = 'You\'ve reached your hourly message limit. Please try again later.';
        return;
    }
    
    // Continue to the next middleware
    await next();
    
    // Increment request count after successful processing
    userRequests[context.chatId].count++;
    console.log(`[RATE LIMIT] User ${context.chatId} has used ${userRequests[context.chatId].count}/10 requests`);
});

// Add context enrichment middleware
client.ai.use(async (context, next) => {
    // Get or create thread
    let thread = context.thread;
    if (!thread) {
        thread = await client.ai._threads.get(context.chatId);
        if (!thread) {
            thread = await client.ai.createThread(context.chatId);
        }
        context.thread = thread;
    }
    
    // Add user information to the thread context
    try {
        const contact = await client.getContactById(context.chatId);
        thread.addContext('user', {
            name: contact.pushname || 'User',
            number: contact.number,
            isGroup: contact.isGroup
        });
        
        // Add current time
        thread.addContext('currentTime', new Date().toISOString());
        
        console.log(`[CONTEXT] Enhanced context for ${context.chatId}`);
    } catch (error) {
        console.error('[CONTEXT] Error enriching context:', error);
    }
    
    // Continue to the next middleware
    await next();
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
        // Process the message through the AI with all middleware
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