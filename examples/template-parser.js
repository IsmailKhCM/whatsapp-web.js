const { Client, LocalAuth, TemplateParser } = require('../index');

// Create a client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
    }
});

// Create a template parser
const parser = new TemplateParser(client);

// Define templates
const orderTemplate = {
    fields: {
        command: { type: 'string', required: true },
        item: { type: 'string', required: true },
        quantity: { type: 'number', required: true },
        address: { type: 'string', required: false }
    }
};

const helpTemplate = {
    fields: {
        command: { type: 'string', required: true },
        topic: { type: 'string', required: false }
    }
};

// Add templates
parser.addTemplate('order', orderTemplate);
parser.addTemplate('help', helpTemplate);

// Example of generating a template from examples
const weatherExamples = [
    '!weather city:New York',
    '!weather city:London units:metric',
    '!weather city:Tokyo units:imperial forecast:5'
];
const weatherTemplate = parser.generateTemplate(weatherExamples);
parser.addTemplate('weather', weatherTemplate);

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async (msg) => {
    console.log('Message received:', msg.body);
    
    // Skip messages from yourself
    if (msg.fromMe) return;
    
    // Try to parse as an order
    const orderParsed = parser.parseMessage(msg.body, 'order');
    if (orderParsed.isValid && orderParsed.command === 'order') {
        await msg.reply(`Order received: ${orderParsed.quantity}x ${orderParsed.item}`);
        
        if (orderParsed.address) {
            await msg.reply(`Will be delivered to: ${orderParsed.address}`);
        } else {
            await msg.reply('Please provide a delivery address with address:your address');
        }
        return;
    }
    
    // Try to parse as weather request
    const weatherParsed = parser.parseMessage(msg.body, 'weather');
    if (weatherParsed.isValid && weatherParsed.command === 'weather') {
        const city = weatherParsed.city;
        const units = weatherParsed.units || 'metric';
        const forecast = weatherParsed.forecast || '1';
        
        await msg.reply(`Weather for ${city} (${units}): Simulated forecast for ${forecast} day(s)`);
        return;
    }
    
    // Try to parse as help request
    const helpParsed = parser.parseMessage(msg.body, 'help');
    if (helpParsed.isValid && helpParsed.command === 'help') {
        if (helpParsed.topic) {
            await msg.reply(`Help for topic: ${helpParsed.topic}`);
            
            if (helpParsed.topic === 'order') {
                await msg.reply('Order format: !order item:product quantity:number address:location');
            } else if (helpParsed.topic === 'weather') {
                await msg.reply('Weather format: !weather city:cityname units:metric|imperial forecast:days');
            } else {
                await msg.reply('Unknown topic. Try "order" or "weather"');
            }
        } else {
            await msg.reply('Available commands: !order, !weather, !help');
            await msg.reply('For more information, use !help topic:command');
        }
        return;
    }
    
    // If message starts with ! but wasn't parsed successfully
    if (msg.body.startsWith('!')) {
        const commandMatch = msg.body.match(/^!(\w+)/);
        if (commandMatch) {
            const command = commandMatch[1];
            await msg.reply(`Unknown or invalid command: ${command}`);
            await msg.reply('Use !help to see available commands');
        }
    }
});

client.initialize(); 