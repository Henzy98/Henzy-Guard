const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
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
                GatewayIntentBits.GuildModeration
            ]
        });

        this.channelDeleteCounts = new Map();
        this.roleDeleteCounts = new Map();
        this.channelSnapshot = new Map();
        this.antiRaidMode = false;
        
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', async () => {
            console.log(`[HENZY 1] ${this.client.user.tag} aktif! - Kanal & Rol Guard`.green);
            console.log(`[HENZY 1] Anti-Raid sistemi hazır - ${henzy.henzyGetSignature().name}`.cyan);
            
            await this.henzyTakeSnapshot();
        });

        this.client.on('channelDelete', async (channel) => {
            await this.henzyChannelDeleteProtection(channel);
        });

        this.client.on('roleDelete', async (role) => {
            await this.henzyRoleDeleteProtection(role);
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

    async start() {
        try {
            
            await database.connect();
            console.log('[HENZY 1] MongoDB bağlantısı başarılı'.green);
            
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY 1] ❌ Config yüklenemedi!'.red);
                console.log('[HENZY 1] 📝 Botları başlatmak için: node sifrele.js'.cyan);
                process.exit(1);
            }
            
            if (!config.bots.guard1.token || config.bots.guard1.token === '') {
                console.log('[HENZY 1] ⚠️  Bot token bulunamadı! Lütfen şifreli config dosyasına token ekleyin'.yellow);
                console.log('[HENZY 1] 📝 Config yönetimi için database bot slash komutlarını kullanın'.cyan);
                return;
            }
            
            await this.client.login(config.bots.guard1.token);
        } catch (error) {
            console.error('[HENZY 1] Başlatma hatası:', error);
        }
    }
}

const henzyGuard1 = new HenzyGuard1();
henzyGuard1.start();

module.exports = HenzyGuard1;
