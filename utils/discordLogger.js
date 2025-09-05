const { EmbedBuilder } = require('discord.js');

class DiscordLogger {
    constructor() {
        this.logChannel = null;
        this.client = null;
        this.logChannelId = null;
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
    }

    async initialize(client, channelId) {
        this.client = client;
        this.logChannelId = channelId;
        
        try {
            this.logChannel = await client.channels.fetch(channelId);
            this.setupConsoleOverride();
            this.originalConsole.log('[DISCORD LOGGER] Discord log kanalı aktif edildi'.green);
        } catch (error) {
            this.originalConsole.error('[DISCORD LOGGER] Log kanalı bulunamadı:', error.message);
        }
    }

    setupConsoleOverride() {
        const self = this;

        console.log = function(...args) {
            self.originalConsole.log(...args);
            self.sendToDiscord('LOG', args.join(' '), '#00FF00');
        };

        console.error = function(...args) {
            self.originalConsole.error(...args);
            self.sendToDiscord('ERROR', args.join(' '), '#FF0000');
        };

        console.warn = function(...args) {
            self.originalConsole.warn(...args);
            self.sendToDiscord('WARN', args.join(' '), '#FFFF00');
        };

        console.info = function(...args) {
            self.originalConsole.info(...args);
            self.sendToDiscord('INFO', args.join(' '), '#0099FF');
        };
    }

    async sendToDiscord(level, message, color) {
        if (!this.logChannel) return;

        try {
            const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
            
            const truncatedMessage = cleanMessage.length > 1900 
                ? cleanMessage.substring(0, 1900) + '...' 
                : cleanMessage;

            const embed = new EmbedBuilder()
                .setTitle(`📋 ${level}`)
                .setDescription(`\`\`\`${truncatedMessage}\`\`\``)
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: 'Henzy Guard Console' });

            await this.logChannel.send({ embeds: [embed] });
        } catch (error) {
            this.originalConsole.error('[DISCORD LOGGER] Discord\'a log gönderme hatası:', error.message);
        }
    }

    restore() {
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
    }
}

module.exports = new DiscordLogger();
