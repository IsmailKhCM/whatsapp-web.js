const { Client, LocalAuth } = require('../index');

// Create a client with AI and TemplateParser enabled
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
    },
    // AI configuration
    ai: {
        enabled: true,
        provider: 'openai', // or 'anthropic', 'google', 'local'
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview',
        // Storage configuration for AI threads
        storageProvider: 'mongodb', // or 'memory', 'sql'
        storageOptions: {
            uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
            dbName: 'whatsapp_web_js',
            collectionName: 'ai_threads'
        }
    },
    // Template parser configuration
    templateParser: {
        enabled: true,
        defaultTemplates: {
            order: {
                fields: {
                    command: { type: 'string', required: true },
                    item: { type: 'string', required: true },
                    quantity: { type: 'number', required: true },
                    address: { type: 'string', required: false }
                }
            },
            weather: {
                fields: {
                    command: { type: 'string', required: true },
                    city: { type: 'string', required: true },
                    units: { type: 'string', required: false }
                }
            }
        }
    }
});

// Register middleware for AI processing
client.ai.use(async (context, next) => {
    console.log(`Processing message from ${context.chatId}: ${context.prompt}`);
    await next();
    console.log(`AI response: ${context.response}`);
});

// Register content filtering middleware
client.ai.use(async (context, next) => {
    // Simple content filtering example
    if (context.prompt.toLowerCase().includes('inappropriate')) {
        context.response = 'I\'m sorry, I can\'t process that request.';
        return;
    }
    await next();
});

// Register custom functions for AI
client.ai.registerFunctions({
    checkWeather: async ({ city, units = 'metric' }) => {
        console.log(`Checking weather for ${city} in ${units}`);
        // Simulate API call
        return {
            city,
            temperature: Math.floor(Math.random() * 30),
            condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
            units
        };
    },
    placeOrder: async ({ item, quantity, address }) => {
        console.log(`Placing order for ${quantity}x ${item} to ${address}`);
        // Simulate order processing
        const orderId = Math.floor(Math.random() * 1000000);
        return {
            orderId,
            status: 'confirmed',
            estimatedDelivery: '30 minutes'
        };
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async (msg) => {
    if (msg.fromMe) return;

    console.log('Message received:', msg.body);

    try {
        // Process the message using the hybrid pipeline
        const result = await client.processMessage(msg.body, {
            templates: ['order', 'weather'],
            fallbackToAI: true,
            aiOptions: {
                temperature: 0.7,
                fallbackProvider: 'local', // Fallback to local AI if OpenAI fails
                fallbackResponse: 'I\'m having trouble processing your request right now.'
            }
        });

        // Handle the result based on type
        if (result.type === 'template') {
            if (result.template === 'order') {
                const { item, quantity, address } = result.data;
                await msg.reply(`Order received: ${quantity}x ${item}`);
                
                if (address) {
                    await msg.reply(`Will be delivered to: ${address}`);
                } else {
                    await msg.reply('Please provide a delivery address with address:your address');
                }
            } else if (result.template === 'weather') {
                const { city, units = 'metric' } = result.data;
                // Use AI function to get weather
                const thread = await client.ai.createThread(msg.from);
                const weatherPrompt = `Check the weather for ${city} using the checkWeather function with units set to ${units}`;
                const response = await thread.ask(weatherPrompt);
                await msg.reply(response);
            }
        } else if (result.type === 'ai') {
            // AI handled the message
            await msg.reply(result.response);
        } else {
            // No match
            await msg.reply('I\'m not sure how to respond to that. Try using one of these formats:\n' +
                '- !order item:pizza quantity:2 address:123 Main St\n' +
                '- !weather city:New York units:metric');
        }
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Get stats every 5 minutes
setInterval(() => {
    if (client.ai) {
        const stats = client.ai.getStats();
        console.log('AI Stats:', stats);
    }
}, 5 * 60 * 1000);

client.initialize(); 