const { Client, LocalAuth } = require('../index');

/**
 * This example demonstrates hybrid processing - combining template parsing with AI.
 * This approach allows you to handle structured commands efficiently while
 * falling back to AI for natural language queries.
 */

// Create a client with both AI and template parser enabled
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
    },
    templateParser: {
        enabled: true,
        defaultTemplates: {
            // Order template
            order: {
                fields: {
                    item: { type: 'string', required: true },
                    quantity: { type: 'number', required: true },
                    size: { type: 'string', required: false },
                    color: { type: 'string', required: false },
                    address: { type: 'string', required: false }
                },
                examples: [
                    'order 2 pizzas',
                    'order item:headphones quantity:1 color:black',
                    'I want to order quantity:3 item:t-shirts size:XL color:blue'
                ]
            },
            
            // Weather template
            weather: {
                fields: {
                    city: { type: 'string', required: true },
                    days: { type: 'number', required: false }
                },
                examples: [
                    'weather in London',
                    'weather city:Tokyo',
                    'What\'s the weather forecast for city:Paris days:3'
                ]
            },
            
            // Reminder template
            reminder: {
                fields: {
                    task: { type: 'string', required: true },
                    time: { type: 'string', required: true },
                    date: { type: 'string', required: false }
                },
                examples: [
                    'remind me to call mom at 5pm',
                    'reminder task:buy groceries time:tomorrow morning',
                    'set a reminder for task:meeting with John time:3pm date:Friday'
                ]
            }
        }
    }
});

// Mock database for orders
const orders = [];

// Mock database for reminders
const reminders = [];

// Mock weather data
const getWeatherData = (city, days = 1) => {
    const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy', 'Stormy', 'Snowy'];
    const forecast = [];
    
    for (let i = 0; i < days; i++) {
        forecast.push({
            day: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day ${i+1}`,
            condition: conditions[Math.floor(Math.random() * conditions.length)],
            temperature: Math.floor(Math.random() * 30) + 5, // Random temp between 5-35
            humidity: Math.floor(Math.random() * 60) + 30 // Random humidity between 30-90%
        });
    }
    
    return {
        city,
        forecast,
        updated: new Date().toLocaleTimeString()
    };
};

// Listen for QR code
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

// Listen for ready event
client.on('ready', () => {
    console.log('Client is ready!');
    console.log('Try these commands:');
    console.log('- "order 2 pizzas"');
    console.log('- "weather in New York"');
    console.log('- "remind me to call mom at 5pm"');
    console.log('- Or ask any question to the AI');
});

// Listen for messages
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    try {
        // Process the message using the hybrid approach
        const result = await client.processMessage(msg.body, {
            chatId: msg.from,
            templates: ['order', 'weather', 'reminder'],
            fallbackToAI: true,
            aiOptions: {
                temperature: 0.7
            }
        });
        
        console.log(`[PROCESS] Message type: ${result.type}`);
        
        // Handle the result based on type
        if (result.type === 'template') {
            // Handle structured command
            if (result.template === 'order') {
                // Process order
                const { item, quantity, size, color, address } = result.data;
                
                // Create order
                const orderId = Date.now().toString();
                const order = {
                    orderId,
                    item,
                    quantity,
                    size,
                    color,
                    address,
                    status: 'pending',
                    timestamp: new Date().toISOString()
                };
                
                orders.push(order);
                
                // Send confirmation
                let response = `Order received! ${quantity} ${item}`;
                if (size) response += ` (Size: ${size})`;
                if (color) response += ` (Color: ${color})`;
                response += `\nOrder ID: ${orderId}`;
                
                if (address) {
                    response += `\nWill be delivered to: ${address}`;
                } else {
                    response += '\nPlease provide a delivery address with address:your address';
                }
                
                await msg.reply(response);
            } 
            else if (result.template === 'weather') {
                // Process weather request
                const { city, days = 1 } = result.data;
                
                // Get weather data
                const weatherData = getWeatherData(city, days);
                
                // Format response
                let response = `Weather for ${city}:\n`;
                
                weatherData.forecast.forEach(day => {
                    response += `${day.day}: ${day.condition}, ${day.temperature}°C, Humidity: ${day.humidity}%\n`;
                });
                
                response += `\nLast updated: ${weatherData.updated}`;
                
                await msg.reply(response);
            }
            else if (result.template === 'reminder') {
                // Process reminder
                const { task, time, date } = result.data;
                
                // Create reminder
                const reminderId = Date.now().toString();
                const reminder = {
                    reminderId,
                    task,
                    time,
                    date: date || 'today',
                    created: new Date().toISOString()
                };
                
                reminders.push(reminder);
                
                // Send confirmation
                const response = `Reminder set! I'll remind you to ${task} at ${time}${date ? ' on ' + date : ' today'}.`;
                
                await msg.reply(response);
            }
        } 
        else if (result.type === 'ai') {
            // AI handled the message
            await msg.reply(result.response);
        } 
        else if (result.type === 'unmatched') {
            // No match found
            await msg.reply('I\'m not sure how to respond to that. Try asking in a different way or use one of our commands: order, weather, or reminder.');
        }
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Initialize the client
client.initialize(); 