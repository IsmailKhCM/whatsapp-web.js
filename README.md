# Enhanced WhatsApp Web.js

An enhanced and stabilized fork of the WhatsApp Web API client that connects through the WhatsApp Web browser app.

## Key Improvements

### 1. Message Events After Session Restoration
- Fixed issue with message events not firing after browser restart
- Added `reinitializeCryptoStore` method for proper session handling
- Improved ciphertext message handling

### 2. Group Chat Detection
- Reliable group chat detection using server type
- Consistent behavior across chat and contact models
- Fixed issues with group message handling

## Installation

```bash
npm install @ismailkhcm/whatsapp-web.js
```

## Basic Usage

```javascript
const { Client, LocalAuth } = require('@ismailkhcm/whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Handle session restoration
client.on('authenticated', async () => {
    console.log('Authenticated');
    await client.reinitializeCryptoStore(); // Call this after session restoration
});

client.on('message', msg => {
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
```

## Session Restoration

To ensure message events work correctly after session restoration:

```javascript
// After initializing with a saved session
await client.initialize();
await client.reinitializeCryptoStore();
```

## Group Chat Detection

Group chats are now reliably detected:

```javascript
client.on('message', async msg => {
    const chat = await msg.getChat();
    
    if (chat.isGroup) {
        console.log('Message is from group:', chat.name);
    }
});
```

## Features

- ✅ Multi-device support
- ✅ Message sending and receiving
- ✅ Message history
- ✅ Group chat management
- ✅ Media sending and downloading
- ✅ Message reactions
- ✅ Contact management
- ✅ Business account features
- ✅ And more...

## Documentation

Full documentation is available at [docs/README.md](docs/README.md).

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm run test:specific tests/message_events.js
```

## Contributing

See [IMPROVEMENTS.md](IMPROVEMENTS.md) for planned improvements and how to contribute.

## Support

- Create an issue for bug reports
- Join our community for discussions
- Commercial support available

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

This project is a fork of [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) with additional improvements and stability fixes.
