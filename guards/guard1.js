const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const database = require('../config/database');
const configManager = require('../config/configManager');
const henzy = require('../data/core');
const emergencyLockdown = require('../utils/emergencyLockdown');
const colors = require('colors');

class HenzyGuard1 {
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

        this.channelDeleteCounts = new Map();
        this.roleDeleteCounts = new Map();
        this.channelSnapshot = new Map();
        this.antiRaidMode = false;
        this.voiceConnections = new Map();
        
        this.setupEvents();
    }

    setupEvents() {
        this.client.on('clientReady', () => {
            console.log(`[HENZY 1] ${this.client.user.tag} aktif! - Kanal & Rol Guard`.green);
            console.log(`[HENZY 1] Anti-Raid sistemi hazır - ${henzy.getFooterText()}`.cyan);
            this.setupActivityRotation();
            this.startVoiceCommandMonitoring();
            setTimeout(() => {
                this.checkAndRejoinVoice();
            }, 5000);
        });

        this.client.on('channelDelete', async (channel) => {
            await this.henzyChannelDeleteProtection(channel);
        });

        this.client.on('roleDelete', async (role) => {
            await this.henzyRoleDeleteProtection(role);
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    async henzyTakeSnapshot() {
        try {
            const guilds = this.client.guilds.cache;
            for (const guild of guilds.values()) {
                const channels = await guild.channels.fetch();
                this.channelSnapshot.set(guild.id, {
                    channels: new Map(channels),
                    timestamp: Date.now(),
                    count: channels.size
                });
                console.log(`[HENZY 1] Snapshot alındı: ${guild.name} - ${channels.size} kanal`.green);
            }
        } catch (error) {
            console.log(`[HENZY ERROR] Snapshot hatası: ${error}`.red);
        }
    }

    async henzyCheckMassDelete(guild) {
        try {
            const snapshot = this.channelSnapshot.get(guild.id);
            if (!snapshot) return;

            const currentChannels = await guild.channels.fetch();
            const deletedCount = snapshot.count - currentChannels.size;
            
            if (await henzy.henzyDetectMassDelete(guild, deletedCount)) {
                this.antiRaidMode = true;
                
                this.channelSnapshot.set(guild.id, {
                    channels: currentChannels,
                    timestamp: Date.now(),
                    count: currentChannels.size
                });
            }
        } catch (error) {
            console.log(`[HENZY ERROR] Mass delete kontrolü hatası: ${error}`.red);
        }
    }

    async henzyChannelDeleteProtection(channel) {
        try {
            if (!channel.guild) return;
            const guild = channel.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'channelGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 1] ${executor.tag} is whitelisted, channel deletion allowed`.green);
                return;
            }

            console.log(`[HENZY 1] ⚠️ Channel deleted: ${channel.name} - Deleted by: ${executor.tag}`.red);

            await this.henzyCheckMassDelete(guild);

            const userId = executor.id;
            const currentTime = Date.now();
            
            if (!this.channelDeleteCounts.has(userId)) {
                this.channelDeleteCounts.set(userId, []);
            }
            
            const userDeletes = this.channelDeleteCounts.get(userId);
            userDeletes.push(currentTime);
            
            const recentDeletes = userDeletes.filter(time => currentTime - time < 30000);
            this.channelDeleteCounts.set(userId, recentDeletes);
            
            if (!await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY ANTI-RAID] 🚨 SUSPICIOUS CHANNEL DELETION DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.channelDeleteCounts.delete(userId);
                return;
            }

            if (recentDeletes.length >= 3) {
                console.log(`[HENZY ANTI-RAID] 🚨 RAPID DELETION DETECTED! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.channelDeleteCounts.delete(userId);
                return;
            }
            
            // First recreate the channel
            const recreatedChannel = await henzy.henzyInstantChannelRecreate(guild, channel);
            
            // Then ban the user
            await henzy.henzyBanUser(guild, executor.id, 'Unauthorized channel deletion - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'CHANNEL_DELETE', executor, channel, 'Unauthorized channel deletion');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Channel deletion protection error: ${error}`.red);
        }
    }

    async henzyRoleDeleteProtection(role) {
        try {
            if (!role.guild) return;
            const guild = role.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'roleGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.RoleDelete,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 1] ${executor.tag} whitelist'te, rol silme izin verildi`.green);
                return;
            }

            console.log(`[HENZY 1] ⚠️ Rol silindi: ${role.name} - Silen: ${executor.tag}`.red);

            const userId = executor.id;
            if (!await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY ANTI-RAID] 🚨 ŞÜPHELİ ROL SİLME ALGILANDI! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                return;
            }

            const currentTime = Date.now();
            
            if (!this.roleDeleteCounts.has(userId)) {
                this.roleDeleteCounts.set(userId, []);
            }
            
            const userDeletes = this.roleDeleteCounts.get(userId);
            userDeletes.push(currentTime);
            
            const recentDeletes = userDeletes.filter(time => currentTime - time < 30000);
            this.roleDeleteCounts.set(userId, recentDeletes);
            
            if (recentDeletes.length >= 3) {
                console.log(`[HENZY ANTI-RAID] 🚨 HIZLI ROL SİLME ALGILANDI! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.roleDeleteCounts.delete(userId);
                return;
            }
            
            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz rol silme - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'ROLE_DELETE', executor, role, 'Yetkisiz rol silme');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Rol silme koruması hatası: ${error}`.red);
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

            console.log(`[HENZY 1] Ses kanalına bağlandı: ${channel.name}`.green);
            return connection;
        } catch (error) {
            console.log(`[HENZY 1 ERROR] Ses kanalı bağlantı hatası: ${error}`.red);
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
                        console.log(`[HENZY 1] Voice command received, joining channel`.green);
                    }
                }
            } catch (error) {
                // Ignore file read errors
            }
        }, 2000);
    }

    setupActivityRotation() {
        const { ActivityType } = require('discord.js');
        
        const activities = [
            { name: 'Henzy 🤍 Guard 1', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Core System', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Channel & Role Protection', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
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
                        console.log(`[HENZY 1] Rejoined voice channel: ${channel.name}`.green);
                    }
                }
            }
        } catch (error) {
            // Ignore file read errors
        }
    }

    async start() {
        try {
            const database = require('../config/database');
            await database.connect();
            console.log('[HENZY 1] MongoDB bağlantısı başarılı'.green);
            
            const configManager = require('../config/configManager');
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY 1] ❌ Config could not be loaded!'.red);
                return;
            }

            this.client.login(config.bots.guard1.token);
        } catch (error) {
            console.error('[HENZY 1] Başlatma hatası:', error);
        }
    }
}

const henzyGuard1 = new HenzyGuard1();
henzyGuard1.start();

module.exports = HenzyGuard1;
