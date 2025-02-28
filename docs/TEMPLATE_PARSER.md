# Template Parser

The Template Parser is a powerful feature in whatsapp-web.js that allows for structured message parsing. This is particularly useful for building chatbots, command systems, or any application that needs to extract structured data from user messages.

## Basic Usage

```javascript
const { Client, LocalAuth, TemplateParser } = require('whatsapp-web.js');

// Create a client
const client = new Client({
    authStrategy: new LocalAuth()
});

// Create a template parser
const parser = new TemplateParser(client);

// Define a template
const orderTemplate = {
    fields: {
        command: { type: 'string', required: true },
        item: { type: 'string', required: true },
        quantity: { type: 'number', required: true },
        address: { type: 'string', required: false }
    }
};

// Add the template
parser.addTemplate('order', orderTemplate);

// Listen for messages
client.on('message', async (msg) => {
    // Parse the message using the 'order' template
    const parsed = parser.parseMessage(msg.body, 'order');
    
    if (parsed.isValid && parsed.command === 'order') {
        // Handle valid order
        await msg.reply(`Order received: ${parsed.quantity}x ${parsed.item}`);
        
        if (parsed.address) {
            await msg.reply(`Will be delivered to: ${parsed.address}`);
        } else {
            await msg.reply('Please provide a delivery address with address:your address');
        }
    } else if (parsed.command === 'order') {
        // Handle invalid order
        await msg.reply(`Invalid order. Errors: ${parsed.errors.join(', ')}`);
    }
});

client.initialize();
```

## Message Format

The default parser supports messages in the following format:

```
!command param1:value1 param2:value2
```

For example:
```
!order item:pizza quantity:2 address:123 Main St
```

## Template Definition

A template is defined as an object with the following structure:

```javascript
{
    fields: {
        fieldName: {
            type: 'string' | 'number' | 'boolean' | 'array',
            required: true | false,
            pattern: 'regex pattern' // Optional
        },
        // More fields...
    },
    examples: [
        // Optional example messages
        '!command field1:value1 field2:value2'
    ]
}
```

## Generating Templates from Examples

You can also generate templates from example messages:

```javascript
const examples = [
    '!order item:pizza quantity:2 address:123 Main St',
    '!order item:burger quantity:1',
    '!order item:salad quantity:3 address:456 Oak Ave'
];

const generatedTemplate = parser.generateTemplate(examples);
parser.addTemplate('order', generatedTemplate);
```

## Validation

The parser automatically validates messages against the template and returns validation errors:

```javascript
const parsed = parser.parseMessage('!order item:pizza', 'order');
console.log(parsed.isValid); // false
console.log(parsed.errors); // ['Required field "quantity" is missing']
```

## Custom Parsing

You can extend the `TemplateParser` class to implement custom parsing logic:

```javascript
class CustomParser extends TemplateParser {
    parseMessage(message, template) {
        // Custom parsing logic
        const result = super.parseMessage(message, template);
        
        // Additional processing
        // ...
        
        return result;
    }
}
```

## Integration with AI

The Template Parser can be combined with AI services for more advanced natural language processing:

```javascript
client.on('message', async (msg) => {
    // First try structured parsing
    const parsed = parser.parseMessage(msg.body, 'order');
    
    if (parsed.isValid) {
        // Handle structured command
        // ...
    } else {
        // Fall back to AI processing for natural language
        const aiResponse = await processWithAI(msg.body);
        await msg.reply(aiResponse);
    }
});
```

## Best Practices

1. **Define clear templates**: Make sure your templates clearly define the expected structure of messages.
2. **Provide helpful error messages**: When a message doesn't match a template, provide clear guidance on the correct format.
3. **Use type conversion**: The parser automatically converts values to the specified type (string, number, boolean, array).
4. **Combine with AI**: For the best user experience, combine structured parsing with AI for handling natural language.
5. **Generate templates from examples**: Use the `generateTemplate` method to create templates from example messages. 