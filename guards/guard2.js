const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const database = require('../config/database');
const configManager = require('../config/configManager');
const henzy = require('../data/core');
const colors = require('colors');

class HenzyGuard2 {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.banCounts = new Map();
        this.kickCounts = new Map();
        this.antiRaidMode = false;
        this.voiceConnections = new Map();
        
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', async () => {
            console.log(`[HENZY 2] ${this.client.user.tag} active! - Ban & Kick Guard`.green);
            console.log(`[HENZY 2] Anti-Raid system ready - ${henzy.henzyGetSignature().name}`.cyan);
            this.setupActivityRotation();
            this.startVoiceCommandMonitoring();
            setTimeout(() => {
                this.checkAndRejoinVoice();
            }, 5000);
        });

        this.client.on('guildBanAdd', this.henzyBanProtection.bind(this));
        this.client.on('guildMemberRemove', this.henzyKickProtection.bind(this));

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });

    }

    setupActivityRotation() {
        const { ActivityType } = require('discord.js');
        
        const activities = [
            { name: 'Henzy 🤍 Guard 2', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Core System', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Ban & Kick Protection', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Anti-Raid Active', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Guard', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' }
        ];

        let currentActivityIndex = 0;

        this.client.user.setPresence({
            activities: [activities[currentActivityIndex]],
            status: 'online'
        });

        setInterval(() => {
            currentActivityIndex = (currentActivityIndex + 1) % activities.length;
            this.client.user.setPresence({
                activities: [activities[currentActivityIndex]],
                status: 'online'
            });
        }, 10000);
    }

    async checkAndRejoinVoice() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const commandFile = path.join(__dirname, '..', 'data', 'voice_command.json');
            if (fs.existsSync(commandFile)) {
                const command = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
                const guild = this.client.guilds.cache.get(command.guildId);
                
                if (guild) {
                    const channel = guild.channels.cache.get(command.channelId);
                    if (channel && channel.type === 2) {
                        await this.joinVoiceChannel(command.channelId, command.guildId);
                        console.log(`[HENZY 2] Rejoined voice channel: ${channel.name}`.green);
                    }
                }
            }
        } catch (error) {
            
        }
    }

    async henzyBanProtection(ban) {
        try {
            const guild = ban.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'banGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 2] ${executor.tag} is whitelisted, ban action allowed`.green);
                return;
            }

            console.log(`[HENZY 2] ⚠️ User banned: ${ban.user.tag} - Banned by: ${executor.tag}`.red);

            const userId = executor.id;
            const currentTime = Date.now();
            
            if (!this.banCounts.has(userId)) {
                this.banCounts.set(userId, []);
            }
            
            const userBans = this.banCounts.get(userId);
            userBans.push(currentTime);
            
            const recentBans = userBans.filter(time => currentTime - time < 30000);
            this.banCounts.set(userId, recentBans);
            
            if (!await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY ANTI-RAID] 🚨 SUSPICIOUS BAN DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.banCounts.delete(userId);
                return;
            }

            if (recentBans.length >= 3) {
                console.log(`[HENZY ANTI-RAID] 🚨 RAPID BAN DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.banCounts.delete(userId);
                return;
            }
            
            await henzy.henzyBanUser(guild, executor.id, 'Unauthorized ban action - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'BAN_PROTECTION', executor, ban.user, 'Unauthorized ban action');
            
            try {
                await guild.members.unban(ban.user.id, 'Henzy Guard: Unauthorized ban reverted');
                console.log(`[HENZY 2] ✅ Ban reverted: ${ban.user.tag}`.green);
            } catch (error) {
                console.log(`[HENZY ERROR] Ban revert error: ${error}`.red);
            }
            
        } catch (error) {
            console.log(`[HENZY ERROR] Ban protection error: ${error}`.red);
        }
    }

    async henzyKickProtection(member) {
        try {
            if (!member.guild) return;
            const guild = member.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'kickGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry || auditEntry.target.id !== member.id) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 2] ${executor.tag} is whitelisted, kick action allowed`.green);
                return;
            }

            console.log(`[HENZY 2] ⚠️ User kicked: ${member.user.tag} - Kicked by: ${executor.tag}`.red);

            const userId = executor.id;
            if (!await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY ANTI-RAID] 🚨 SUSPICIOUS KICK DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                return;
            }

            const currentTime = Date.now();
            
            if (!this.kickCounts.has(userId)) {
                this.kickCounts.set(userId, []);
            }
            
            const userKicks = this.kickCounts.get(userId);
            userKicks.push(currentTime);
            
            const recentKicks = userKicks.filter(time => currentTime - time < 30000);
            this.kickCounts.set(userId, recentKicks);
            
            if (recentKicks.length >= 3) {
                console.log(`[HENZY ANTI-RAID] 🚨 RAPID KICK DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.kickCounts.delete(userId);
                return;
            }
            
            await henzy.henzyBanUser(guild, executor.id, 'Unauthorized kick action - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'KICK_PROTECTION', executor, member.user, 'Unauthorized kick action');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Kick protection error: ${error}`.red);
        }
    }

    async joinVoiceChannel(channelId, guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return null;

            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== 2) return null;

            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: guild.voiceAdapterCreator,
                selfMute: true,
                selfDeaf: true
            });

            this.voiceConnections.set(guildId, { connection, channelId });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                setTimeout(() => {
                    if (this.voiceConnections.has(guildId)) {
                        this.joinVoiceChannel(channelId, guildId);
                    }
                }, 5000);
            });

            console.log(`[HENZY 2] Ses kanalına bağlandı: ${channel.name}`.green);
            return connection;
        } catch (error) {
            console.log(`[HENZY 2 ERROR] Ses kanalı bağlantı hatası: ${error}`.red);
            return null;
        }
    }

    handleVoiceStateUpdate(oldState, newState) {
        if (newState.member?.user.bot && newState.member.user.id === this.client.user.id) {
            if (!newState.channelId && this.voiceConnections.has(newState.guild.id)) {
                const { channelId } = this.voiceConnections.get(newState.guild.id);
                setTimeout(() => {
                    this.joinVoiceChannel(channelId, newState.guild.id);
                }, 2000);
            }
        }
    }

    startVoiceCommandMonitoring() {
        const fs = require('fs');
        const path = require('path');
        
        const commandFile = path.join(__dirname, '..', 'data', 'voice_command.json');
        
        setInterval(() => {
            try {
                if (fs.existsSync(commandFile)) {
                    const command = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
                    
                    if (command.action === 'joinVoice' && command.timestamp > (Date.now() - 15000)) {
                        this.joinVoiceChannel(command.channelId, command.guildId);
                        console.log(`[HENZY 2] Voice command received, joining channel`.green);
                    }
                }
            } catch (error) {
                
            }
        }, 2000);
    }

    async start() {
        try {
            
            await database.connect();
            console.log('[HENZY 2] MongoDB bağlantısı başarılı'.green);
            
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY 2] ❌ Config yüklenemedi!'.red);
                console.log('[HENZY 2] 📝 Botları başlatmak için: node sifrele.js'.cyan);
                process.exit(1);
            }
            
            if (!config.bots.guard2.token || config.bots.guard2.token === '') {
                console.log('[HENZY 2] ⚠️  Bot token bulunamadı! Lütfen şifreli config dosyasına token ekleyin'.yellow);
                console.log('[HENZY 2] 📝 Config yönetimi için database bot slash komutlarını kullanın'.cyan);
                return;
            }
            
            await this.client.login(config.bots.guard2.token);
        } catch (error) {
            console.error('[HENZY 2] Başlatma hatası:', error);
        }
    }
}

const henzyGuard2 = new HenzyGuard2();
henzyGuard2.start();

module.exports = HenzyGuard2;
