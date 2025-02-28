const { Client, LocalAuth } = require('../index');

/**
 * This example demonstrates how to use multiple AI providers in the same application.
 * It allows comparing responses from different AI models and providers.
 */

// Create a client with AI enabled
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
    },
    ai: {
        enabled: true,
        provider: 'openai', // Default provider
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4-turbo-preview'
    }
});

// Configure additional providers
const providers = {
    openai: {
        name: 'OpenAI',
        models: ['gpt-4-turbo-preview', 'gpt-3.5-turbo'],
        apiKey: process.env.OPENAI_API_KEY
    },
    anthropic: {
        name: 'Anthropic',
        models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
        apiKey: process.env.ANTHROPIC_API_KEY
    },
    google: {
        name: 'Google AI',
        models: ['gemini-pro'],
        apiKey: process.env.GOOGLE_API_KEY
    }
};

// Listen for QR code
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

// Listen for ready event
client.on('ready', () => {
    console.log('Client is ready!');
    console.log('Try these commands:');
    console.log('- "!compare [your question]" - Compare responses from different providers');
    console.log('- "!using [provider] [model] [your question]" - Use a specific provider and model');
    console.log('- "!providers" - List available providers and models');
});

// Listen for messages
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    try {
        const messageText = msg.body;
        
        // List available providers and models
        if (messageText === '!providers') {
            let response = '🤖 **Available AI Providers and Models**\n\n';
            
            for (const [providerId, provider] of Object.entries(providers)) {
                if (!provider.apiKey) continue; // Skip providers without API keys
                
                response += `**${provider.name}**\n`;
                provider.models.forEach(model => {
                    response += `- ${model}\n`;
                });
                response += '\n';
                
                console.log(`[PROVIDERS] Listed models for ${providerId}`);
            }
            
            await msg.reply(response);
            return;
        }
        
        // Use a specific provider and model
        if (messageText.startsWith('!using ')) {
            const match = messageText.match(/!using ([a-zA-Z]+) ([a-zA-Z0-9-]+) (.+)/);
            
            if (!match) {
                await msg.reply('Please use the format: !using [provider] [model] [your question]');
                return;
            }
            
            const providerId = match[1].toLowerCase();
            const modelId = match[2];
            const question = match[3];
            
            // Check if provider exists and has API key
            if (!providers[providerId] || !providers[providerId].apiKey) {
                await msg.reply(`Provider "${providerId}" is not available or not configured.`);
                return;
            }
            
            // Check if model exists for this provider
            if (!providers[providerId].models.includes(modelId)) {
                await msg.reply(`Model "${modelId}" is not available for provider "${providerId}".`);
                return;
            }
            
            console.log(`[USING] Provider: ${providerId}, Model: ${modelId}, Question: "${question}"`);
            
            // Create a temporary thread for this request
            const thread = await client.ai.createThread(`${msg.from}_temp`);
            
            // Ask the question with the specified provider and model
            const response = await thread.ask(question, {
                provider: providerId,
                model: modelId
            });
            
            // Format the response
            let formattedResponse = `🤖 **${providers[providerId].name} (${modelId})**\n\n`;
            formattedResponse += response;
            
            await msg.reply(formattedResponse);
            
            // Clean up the temporary thread
            await client.ai._storage.deleteThread(`${msg.from}_temp`);
            
            return;
        }
        
        // Compare responses from different providers
        if (messageText.startsWith('!compare ')) {
            const question = messageText.substring('!compare '.length);
            
            console.log(`[COMPARE] Question: "${question}"`);
            
            // Send a "thinking" message
            const thinkingMsg = await msg.reply('Comparing responses from different AI providers. This may take a moment...');
            
            // Collect available providers
            const availableProviders = Object.entries(providers)
                .filter(([providerId, provider]) => {
                    console.log(`Checking provider ${providerId} with API key: ${provider.apiKey ? 'present' : 'missing'}`);
                    return provider.apiKey;
                })
                .map(([id, provider]) => ({
                    id,
                    name: provider.name,
                    model: provider.models[0] // Use the first model for each provider
                }));
            
            // Get responses from each provider
            const responses = [];
            
            for (const provider of availableProviders) {
                try {
                    console.log(`[COMPARE] Asking ${provider.name} (${provider.model})...`);
                    
                    // Create a temporary thread for this request
                    const thread = await client.ai.createThread(`${msg.from}_${provider.id}`);
                    
                    // Ask the question
                    const startTime = Date.now();
                    const response = await thread.ask(question, {
                        provider: provider.id,
                        model: provider.model
                    });
                    const responseTime = Date.now() - startTime;
                    
                    responses.push({
                        provider: provider.name,
                        model: provider.model,
                        response,
                        responseTime
                    });
                    
                    // Clean up the temporary thread
                    await client.ai._storage.deleteThread(`${msg.from}_${provider.id}`);
                } catch (error) {
                    console.error(`[COMPARE] Error with ${provider.name}:`, error);
                    responses.push({
                        provider: provider.name,
                        model: provider.model,
                        response: `Error: ${error.message}`,
                        responseTime: 0,
                        error: true
                    });
                }
            }
            
            // Format the comparison
            let comparison = '🤖 **AI Provider Comparison**\n\n';
            comparison += `Question: "${question}"\n\n`;
            
            responses.forEach((result, index) => {
                comparison += `**${index + 1}. ${result.provider} (${result.model})**`;
                if (result.responseTime) {
                    comparison += ` - ${(result.responseTime / 1000).toFixed(1)}s`;
                }
                comparison += `\n\n${result.response}\n\n`;
                if (index < responses.length - 1) {
                    comparison += '---\n\n';
                }
            });
            
            // Delete the "thinking" message
            await client.pupPage.evaluate(async (msgId) => {
                await window.Store.Msg.delete(msgId, true);
            }, thinkingMsg.id._serialized);
            
            // Send the comparison
            await msg.reply(comparison);
            return;
        }
        
        // Regular AI processing
        if (!messageText.startsWith('!')) {
            const response = await client.ai.ask(msg.from, messageText);
            await msg.reply(response);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Initialize the client
client.initialize(); 