'use strict';

const Base = require('./Base');

/**
 * Template Parser for structured message parsing
 * @extends {Base}
 */
class TemplateParser extends Base {
    constructor(client, options = {}) {
        super(client);

        /**
         * Template definitions
         * @type {Map<string, MessageTemplate>}
         * @private
         */
        this._templates = new Map();

        // Load default templates if provided
        if (options.defaultTemplates) {
            for (const [name, template] of Object.entries(options.defaultTemplates)) {
                this.addTemplate(name, template);
            }
        }
    }

    /**
     * Add a template
     * @param {string} name - Template name
     * @param {MessageTemplate} template - Template definition
     */
    addTemplate(name, template) {
        this._templates.set(name, template);
    }

    /**
     * Get a template by name
     * @param {string} name - Template name
     * @returns {MessageTemplate|null} Template definition or null if not found
     */
    getTemplate(name) {
        return this._templates.get(name) || null;
    }

    /**
     * Parse a message using a template
     * @param {string} message - Message to parse
     * @param {string|MessageTemplate} template - Template name or definition
     * @returns {ParsedMessage} Parsed message
     */
    parseMessage(message, template) {
        // If template is a string, look it up in the templates map
        if (typeof template === 'string') {
            const templateDef = this.getTemplate(template);
            if (!templateDef) {
                return {
                    isValid: false,
                    errors: [`Template "${template}" not found`]
                };
            }
            template = templateDef;
        }

        const result = {
            isValid: true,
            errors: []
        };

        // Basic command parsing (e.g., !command)
        const commandMatch = message.match(/^!(\w+)/);
        if (commandMatch) {
            result.command = commandMatch[1];
        }

        // Parse key-value pairs (e.g., key:value)
        const keyValuePairs = message.match(/(\w+):([\w\s]+)/g) || [];
        for (const pair of keyValuePairs) {
            const [key, value] = pair.split(':');
            if (key && value) {
                result[key.trim()] = this._convertValueType(value.trim(), template.fields[key]?.type);
            }
        }

        // Validate against template
        return this.validateParsedMessage(result, template);
    }

    /**
     * Validate a parsed message against a template
     * @param {ParsedMessage} parsed - Parsed message
     * @param {MessageTemplate} template - Template definition
     * @returns {ParsedMessage} Validated parsed message
     */
    validateParsedMessage(parsed, template) {
        const result = { ...parsed };
        result.errors = [];

        // Check required fields
        for (const [field, def] of Object.entries(template.fields)) {
            if (def.required && (parsed[field] === undefined || parsed[field] === null)) {
                result.errors.push(`Required field "${field}" is missing`);
            }

            // Check field type
            if (parsed[field] !== undefined && def.type) {
                const expectedType = def.type;
                const actualType = typeof parsed[field];
                
                if (expectedType === 'number' && actualType !== 'number') {
                    result.errors.push(`Field "${field}" should be a number`);
                } else if (expectedType === 'boolean' && actualType !== 'boolean') {
                    result.errors.push(`Field "${field}" should be a boolean`);
                } else if (expectedType === 'array' && !Array.isArray(parsed[field])) {
                    result.errors.push(`Field "${field}" should be an array`);
                }
            }

            // Check pattern if defined
            if (parsed[field] !== undefined && def.pattern) {
                const pattern = new RegExp(def.pattern);
                if (!pattern.test(String(parsed[field]))) {
                    result.errors.push(`Field "${field}" does not match pattern ${def.pattern}`);
                }
            }
        }

        result.isValid = result.errors.length === 0;
        return result;
    }

    /**
     * Generate a template from examples
     * @param {string[]} examples - Example messages
     * @returns {MessageTemplate} Generated template
     */
    generateTemplate(examples) {
        const fields = {};
        const commandPattern = /^!(\w+)/;
        const keyValuePattern = /(\w+):([\w\s]+)/g;

        for (const example of examples) {
            // Extract command
            const commandMatch = example.match(commandPattern);
            if (commandMatch && !fields.command) {
                fields.command = { type: 'string', required: true };
            }

            // Extract key-value pairs
            const keyValuePairs = example.match(keyValuePattern) || [];
            for (const pair of keyValuePairs) {
                const [key, value] = pair.split(':');
                if (key && value) {
                    const trimmedKey = key.trim();
                    const trimmedValue = value.trim();
                    
                    if (!fields[trimmedKey]) {
                        // Guess the type
                        let type = 'string';
                        if (!isNaN(Number(trimmedValue))) {
                            type = 'number';
                        } else if (trimmedValue === 'true' || trimmedValue === 'false') {
                            type = 'boolean';
                        }
                        
                        fields[trimmedKey] = {
                            type,
                            required: false
                        };
                    }
                }
            }
        }

        return {
            fields,
            examples
        };
    }

    /**
     * Convert a value to the specified type
     * @param {string} value - Value to convert
     * @param {string} type - Target type
     * @returns {any} Converted value
     * @private
     */
    _convertValueType(value, type) {
        if (!type) return value;

        switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'array':
            return value.split(',').map(v => v.trim());
        default:
            return value;
        }
    }
}

/**
 * @typedef {Object} MessageTemplate
 * @property {Object.<string, {type: string, required: boolean, pattern?: string}>} fields - Template fields
 * @property {string[]} [examples] - Example messages
 */

/**
 * @typedef {Object} ParsedMessage
 * @property {boolean} isValid - Whether the parsed message is valid
 * @property {string[]} [errors] - Validation errors
 * @property {*} [command] - Parsed command
 * @property {*} [key] - Additional parsed fields
 */

module.exports = TemplateParser; 