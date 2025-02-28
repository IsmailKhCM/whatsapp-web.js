const { Client, LocalAuth } = require('../index');

/**
 * This example demonstrates how to use function calling with the AI assistant.
 * Function calling allows the AI to execute functions when needed to fulfill user requests.
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

// Mock database of products
const productDatabase = [
    { id: 1, name: 'Smartphone', price: 699, category: 'Electronics', stock: 42 },
    { id: 2, name: 'Laptop', price: 1299, category: 'Electronics', stock: 15 },
    { id: 3, name: 'Headphones', price: 199, category: 'Electronics', stock: 78 },
    { id: 4, name: 'T-shirt', price: 29, category: 'Clothing', stock: 100 },
    { id: 5, name: 'Jeans', price: 59, category: 'Clothing', stock: 85 },
    { id: 6, name: 'Sneakers', price: 89, category: 'Footwear', stock: 36 },
    { id: 7, name: 'Coffee Maker', price: 149, category: 'Kitchen', stock: 22 },
    { id: 8, name: 'Blender', price: 79, category: 'Kitchen', stock: 30 },
];

// Mock order database
const orders = {};

// Register functions that the AI can call
client.ai.registerFunctions({
    // Function to get weather information
    getWeather: async ({ location, units = 'metric' }) => {
        console.log(`[FUNCTION] Getting weather for ${location} in ${units}`);
        
        // In a real app, you would call a weather API here
        // This is a mock implementation
        const weatherData = {
            location,
            temperature: Math.floor(Math.random() * 30) + 5, // Random temp between 5-35
            condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy'][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 60) + 30, // Random humidity between 30-90%
            units
        };
        
        return weatherData;
    },
    
    // Function to search products
    searchProducts: async ({ query, category, maxPrice, limit = 5 }) => {
        console.log(`[FUNCTION] Searching products with query: ${query}, category: ${category}, maxPrice: ${maxPrice}`);
        
        let results = [...productDatabase];
        
        // Filter by search query
        if (query) {
            const searchTerms = query.toLowerCase().split(' ');
            results = results.filter(product => 
                searchTerms.some(term => 
                    product.name.toLowerCase().includes(term) || 
                    product.category.toLowerCase().includes(term)
                )
            );
        }
        
        // Filter by category
        if (category) {
            results = results.filter(product => 
                product.category.toLowerCase() === category.toLowerCase()
            );
        }
        
        // Filter by max price
        if (maxPrice) {
            results = results.filter(product => product.price <= maxPrice);
        }
        
        // Limit results
        results = results.slice(0, limit);
        
        return results;
    },
    
    // Function to get product details
    getProductDetails: async ({ productId }) => {
        console.log(`[FUNCTION] Getting details for product ID: ${productId}`);
        
        const product = productDatabase.find(p => p.id === parseInt(productId));
        
        if (!product) {
            return { error: 'Product not found' };
        }
        
        return product;
    },
    
    // Function to create an order
    createOrder: async ({ userId, products, shippingAddress }) => {
        console.log(`[FUNCTION] Creating order for user: ${userId}`);
        
        if (!products || !Array.isArray(products) || products.length === 0) {
            return { error: 'No products specified' };
        }
        
        if (!shippingAddress) {
            return { error: 'No shipping address provided' };
        }
        
        // Validate products and calculate total
        let orderTotal = 0;
        const orderItems = [];
        
        for (const item of products) {
            const product = productDatabase.find(p => p.id === parseInt(item.productId));
            
            if (!product) {
                return { error: `Product with ID ${item.productId} not found` };
            }
            
            if (product.stock < item.quantity) {
                return { error: `Not enough stock for product ${product.name}` };
            }
            
            orderItems.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                subtotal: product.price * item.quantity
            });
            
            orderTotal += product.price * item.quantity;
        }
        
        // Create order
        const orderId = Date.now().toString();
        const order = {
            orderId,
            userId,
            items: orderItems,
            total: orderTotal,
            shippingAddress,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Save order
        if (!orders[userId]) {
            orders[userId] = [];
        }
        orders[userId].push(order);
        
        return {
            orderId,
            total: orderTotal,
            status: 'pending',
            message: 'Order created successfully'
        };
    },
    
    // Function to check order status
    checkOrderStatus: async ({ userId, orderId }) => {
        console.log(`[FUNCTION] Checking order status for user: ${userId}, order: ${orderId}`);
        
        if (!orders[userId]) {
            return { error: 'No orders found for this user' };
        }
        
        const order = orders[userId].find(o => o.orderId === orderId);
        
        if (!order) {
            return { error: 'Order not found' };
        }
        
        return {
            orderId: order.orderId,
            status: order.status,
            total: order.total,
            items: order.items.length,
            createdAt: order.createdAt
        };
    }
});

// Listen for QR code
client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

// Listen for ready event
client.on('ready', () => {
    console.log('Client is ready!');
    console.log('Try asking about:');
    console.log('- "What\'s the weather in New York?"');
    console.log('- "Show me electronics under $200"');
    console.log('- "I want to order 2 headphones and 1 t-shirt"');
    console.log('- "What\'s the status of my order?"');
});

// Listen for messages
client.on('message', async (msg) => {
    if (msg.fromMe) return;
    
    try {
        // Create or get thread for this chat
        let thread = client.ai._threads.get(msg.from);
        if (!thread) {
            thread = await client.ai.createThread(msg.from);
            
            // Add user ID to context
            thread.addContext('userId', msg.from);
        }
        
        // Process the message through the AI with function calling
        const response = await thread.ask(msg.body, {
            // Enable function calling
            functions: true,
            // You can also specify which functions to allow for this request
            // allowedFunctions: ['getWeather', 'searchProducts']
        });
        
        // Send the response
        await msg.reply(response);
    } catch (error) {
        console.error('Error processing message:', error);
        await msg.reply('Sorry, I encountered an error while processing your message.');
    }
});

// Initialize the client
client.initialize(); 