const { Client, LocalAuth } = require('../index');

/**
 * This example demonstrates the language utilities provided by the AI assistant:
 * - Sentiment analysis
 * - Smart replies
 * - Language detection
 * - Translation
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

// Listen for QR code
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

// Listen for ready event
client.on('ready', () => {
    console.log('Client is ready!');
    console.log('Try these commands:');
    console.log('- "!sentiment [your text]" - Analyze sentiment of text');
    console.log('- "!suggest [message]" - Get smart reply suggestions');
    console.log('- "!detect [text]" - Detect language of text');
    console.log('- "!translate [text] to [language]" - Translate text');
});

// Listen for messages
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    try {
        const messageText = msg.body;
        
        // Sentiment analysis
        if (messageText.startsWith('!sentiment ')) {
            const text = messageText.substring('!sentiment '.length);
            console.log(`[SENTIMENT] Analyzing: "${text}"`);
            
            const sentiment = await client.ai.analyzeSentiment(text);
            
            let response = '📊 **Sentiment Analysis**\n\n';
            response += `Text: "${text}"\n`;
            response += `Score: ${sentiment.score.toFixed(2)} (${sentiment.score > 0 ? 'Positive' : sentiment.score < 0 ? 'Negative' : 'Neutral'})\n\n`;
            
            if (sentiment.isPositive) {
                response += '😊 This text has a positive sentiment.';
            } else if (sentiment.isNegative) {
                response += '😔 This text has a negative sentiment.';
            } else {
                response += '😐 This text has a neutral sentiment.';
            }
            
            await msg.reply(response);
            return;
        }
        
        // Smart replies
        if (messageText.startsWith('!suggest ')) {
            const text = messageText.substring('!suggest '.length);
            console.log(`[SUGGEST] Generating suggestions for: "${text}"`);
            
            const suggestions = await client.ai.getSmartReplies(text, { maxSuggestions: 3 });
            
            let response = '💬 **Smart Reply Suggestions**\n\n';
            response += `Original message: "${text}"\n\n`;
            response += 'Suggested replies:\n';
            
            suggestions.forEach((suggestion, index) => {
                response += `${index + 1}. ${suggestion}\n`;
            });
            
            await msg.reply(response);
            return;
        }
        
        // Language detection
        if (messageText.startsWith('!detect ')) {
            const text = messageText.substring('!detect '.length);
            console.log(`[DETECT] Detecting language for: "${text}"`);
            
            const languageCode = await client.ai.detectLanguage(text);
            
            // Map of language codes to names
            const languageNames = {
                'en': 'English',
                'es': 'Spanish',
                'fr': 'French',
                'de': 'German',
                'it': 'Italian',
                'pt': 'Portuguese',
                'ru': 'Russian',
                'ja': 'Japanese',
                'zh': 'Chinese',
                'ar': 'Arabic',
                'hi': 'Hindi',
                'ko': 'Korean',
                'tr': 'Turkish',
                'nl': 'Dutch',
                'sv': 'Swedish',
                'fi': 'Finnish',
                'no': 'Norwegian',
                'da': 'Danish',
                'pl': 'Polish',
                'he': 'Hebrew',
                'th': 'Thai',
                'vi': 'Vietnamese'
            };
            
            const languageName = languageNames[languageCode] || `Unknown (${languageCode})`;
            
            let response = '🔍 **Language Detection**\n\n';
            response += `Text: "${text}"\n`;
            response += `Detected language: ${languageName} (${languageCode})`;
            
            await msg.reply(response);
            return;
        }
        
        // Translation
        if (messageText.startsWith('!translate ')) {
            const translationRegex = /!translate (.+) to ([a-zA-Z]+)$/;
            const match = messageText.match(translationRegex);
            
            if (!match) {
                await msg.reply('Please use the format: !translate [text] to [language]');
                return;
            }
            
            const text = match[1];
            const targetLang = match[2].toLowerCase();
            
            console.log(`[TRANSLATE] Translating to ${targetLang}: "${text}"`);
            
            const translated = await client.ai.translate(text, targetLang);
            
            let response = '🌐 **Translation**\n\n';
            response += `Original: "${text}"\n`;
            response += `Translated (${targetLang}): "${translated}"`;
            
            await msg.reply(response);
            return;
        }
        
        // Auto-detect language and offer translation for non-English messages
        if (!messageText.startsWith('!')) {
            const languageCode = await client.ai.detectLanguage(messageText);
            
            // If not English and message is long enough to be worth translating
            if (languageCode !== 'en' && messageText.length > 10) {
                console.log(`[AUTO] Detected non-English message (${languageCode})`);
                
                // Translate to English
                const translated = await client.ai.translate(messageText, 'en');
                
                // Process the translated message with AI
                const response = await client.ai.ask(msg.from, translated);
                
                // Translate the response back to the original language
                const translatedResponse = await client.ai.translate(response, languageCode);
                
                // Send both the original English response and the translated response
                await msg.reply(`${response}\n\n---\n${translatedResponse}`);
                return;
            }
            
            // Regular AI processing for English messages
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