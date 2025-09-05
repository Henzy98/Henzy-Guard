const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const database = require('../config/database');
const configManager = require('../config/configManager');
const henzy = require('../data/core');
const colors = require('colors');

class HenzyGuard4 {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildEmojisAndStickers
            ]
        });

        this.emojiCounts = new Map();
        this.stickerCounts = new Map();
        this.antiRaidMode = false;
        
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', async () => {
            console.log(`[HENZY 4] ${this.client.user.tag} aktif! - Emoji, Sticker & Bot Guard`.green);
            console.log(`[HENZY 4] Anti-Raid sistemi hazır - ${henzy.henzyGetSignature().name}`.cyan);
        });

        this.client.on('emojiCreate', this.henzyEmojiCreate.bind(this));
        this.client.on('emojiDelete', this.henzyEmojiDeleteProtection.bind(this));
        this.client.on('stickerCreate', this.henzyStickerCreateProtection.bind(this));
        this.client.on('stickerDelete', this.henzyStickerDeleteProtection.bind(this));
        this.client.on('guildMemberAdd', this.henzyBotAddProtection.bind(this));
    }

    async henzyBotAddProtection(member) {
        try {
            if (!member.guild || !member.user.bot) return;
            const guild = member.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'antiRaid')) return;

            console.log(`[HENZY 4] 🤖 Bot eklendi: ${member.user.tag}`.yellow);

            const auditLogs = await guild.fetchAuditLogs({
                type: 28, // BOT_ADD
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 4] ${executor.tag} whitelist'te, bot ekleme izin verildi`.green);
                return;
            }

            console.log(`[HENZY 4] 🚫 Yetkisiz bot ekleme tespit edildi: ${member.user.tag} - Ekleyen: ${executor.tag}`.red);

            try {
                await member.kick('Yetkisiz bot ekleme - Henzy Guard');
                console.log(`[HENZY 4] 🦵 Bot kicklendi: ${member.user.tag}`.red);
            } catch (error) {
                console.log(`[HENZY ERROR] Bot kickleme hatası: ${error}`.red);
            }

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz bot ekleme - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'UNAUTHORIZED_BOT_ADD', executor, member.user, `Bot: ${member.user.tag}`);

        } catch (error) {
            console.log(`[HENZY ERROR] Bot ekleme koruması hatası: ${error}`.red);
        }
    }

    async henzyEmojiCreate(emoji) {
        try {
            if (!emoji.guild) return;
            const guild = emoji.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'emojiGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.EmojiCreate,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 4] ${executor.tag} whitelist'te, emoji oluşturma izin verildi`.green);
                return;
            }

            console.log(`[HENZY 4] ⚠️ Emoji oluşturuldu: ${emoji.name} - Oluşturan: ${executor.tag}`.red);

            const userId = executor.id;
            const currentTime = Date.now();
            
            if (!this.emojiCounts.has(userId)) {
                this.emojiCounts.set(userId, []);
            }
            
            const userEmojis = this.emojiCounts.get(userId);
            userEmojis.push(currentTime);
            
            const recentEmojis = userEmojis.filter(time => currentTime - time < 30000);
            this.emojiCounts.set(userId, recentEmojis);
            
            if (recentEmojis.length >= 3) {
                console.log(`[HENZY ANTI-RAID] 🚨 HIZLI EMOJI OLUŞTURMA ALGILANDI! ${executor.tag}`.red);
                await henzy.henzyEmergencyProtection(guild);
                this.emojiCounts.delete(userId);
                return;
            }
            
            try {
                await emoji.delete('Henzy Guard: Yetkisiz emoji');
                console.log(`[HENZY 4] 🗑️ Emoji silindi: ${emoji.name}`.red);
            } catch (error) {
                console.log(`[HENZY ERROR] Emoji silme hatası: ${error}`.red);
            }

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz emoji oluşturma - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'EMOJI_CREATE', executor, emoji, 'Yetkisiz emoji oluşturma');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Emoji koruması hatası: ${error}`.red);
        }
    }

    async henzyEmojiDeleteProtection(emoji) {
        try {
            if (!emoji.guild) return;
            const guild = emoji.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'emojiGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.EmojiDelete,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 4] ${executor.tag} whitelist'te, emoji silme izin verildi`.green);
                return;
            }

            console.log(`[HENZY 4] ⚠️ Emoji silindi: ${emoji.name} - Silen: ${executor.tag}`.red);

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz emoji silme - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'EMOJI_DELETE', executor, emoji, 'Yetkisiz emoji silme');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Emoji silme koruması hatası: ${error}`.red);
        }
    }

    async henzyStickerCreateProtection(sticker) {
        try {
            if (!sticker.guild) return;
            const guild = sticker.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'stickerGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.StickerCreate,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 4] ${executor.tag} whitelist'te, sticker oluşturma izin verildi`.green);
                return;
            }

            console.log(`[HENZY 4] ⚠️ Sticker oluşturuldu: ${sticker.name} - Oluşturan: ${executor.tag}`.red);

            try {
                await sticker.delete('Henzy Guard: Yetkisiz sticker');
                console.log(`[HENZY 4] 🗑️ Sticker silindi: ${sticker.name}`.red);
            } catch (error) {
                console.log(`[HENZY ERROR] Sticker silme hatası: ${error}`.red);
            }

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz sticker oluşturma - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'STICKER_CREATE', executor, sticker, 'Yetkisiz sticker oluşturma');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Sticker koruması hatası: ${error}`.red);
        }
    }

    async henzyStickerDeleteProtection(sticker) {
        try {
            if (!sticker.guild) return;
            const guild = sticker.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'stickerGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.StickerDelete,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 4] ${executor.tag} whitelist'te, sticker silme izin verildi`.green);
                return;
            }

            console.log(`[HENZY 4] ⚠️ Sticker silindi: ${sticker.name} - Silen: ${executor.tag}`.red);

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz sticker silme - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'STICKER_DELETE', executor, sticker, 'Yetkisiz sticker silme');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Sticker silme koruması hatası: ${error}`.red);
        }
    }

    async start() {
        try {
            
            await database.connect();
            console.log('[HENZY 4] MongoDB bağlantısı başarılı'.green);
            
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY 4] ❌ Config yüklenemedi!'.red);
                console.log('[HENZY 4] 📝 Botları başlatmak için: node sifrele.js'.cyan);
                process.exit(1);
            }
            
            if (!config.bots.guard4.token || config.bots.guard4.token === '') {
                console.log('[HENZY 4] ⚠️  Bot token bulunamadı! Lütfen şifreli config dosyasına token ekleyin'.yellow);
                console.log('[HENZY 4] 📝 Config yönetimi için database bot slash komutlarını kullanın'.cyan);
                return;
            }
            
            await this.client.login(config.bots.guard4.token);
        } catch (error) {
            console.error('[HENZY 4] Başlatma hatası:', error);
        }
    }
}

const henzyGuard4 = new HenzyGuard4();
henzyGuard4.start();

module.exports = HenzyGuard4;
