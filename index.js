'use strict';

const Constants = require('./src/util/Constants');

const Client = require('./src/Client');

const {
    MessageMedia,
    Location,
    Poll,
    PollVote,
    List,
    Buttons,
    Contact,
    GroupNotification,
    Label,
    Call,
    Reaction,
    Message,
    Chat,
    PrivateChat,
    GroupChat,
    Broadcast,
    BusinessContact,
    PrivateContact
} = require('./src/structures');

const {
    NoAuth,
    LocalAuth,
    RemoteAuth,
    LegacySessionAuth
} = require('./src/authStrategies');

// Add AI components
const AIAssistant = require('./src/structures/AIAssistant');
const Thread = require('./src/structures/Thread');
const TemplateParser = require('./src/structures/TemplateParser');
const AIProvider = require('./src/structures/providers/AIProvider');
const ThreadStorage = require('./src/structures/storage/ThreadStorage');

module.exports = {
    Client,
    MessageMedia,
    Location,
    Poll,
    PollVote,
    List,
    Buttons,
    Contact,
    GroupNotification,
    Label,
    Call,
    Reaction,
    Message,
    Chat,
    PrivateChat,
    GroupChat,
    Broadcast,
    BusinessContact,
    PrivateContact,
    NoAuth,
    LocalAuth,
    RemoteAuth,
    LegacySessionAuth,
    // Add AI exports
    AIAssistant,
    Thread,
    TemplateParser,
    AIProvider,
    ThreadStorage,
    
    version: require('./package.json').version,

    // Structures
    ClientInfo: require('./src/structures/ClientInfo'),
    ProductMetadata: require('./src/structures/ProductMetadata'),
    
    ...Constants
};
