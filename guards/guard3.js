const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
const database = require('../config/database');
const configManager = require('../config/configManager');
const henzy = require('../data/core');
const colors = require('colors');

class HenzyGuard3 {
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

        this.userMessages = new Map();
        this.messageCounts = new Map();
        this.urlPattern = /(https?:\/\/[^\s]+)/g;
        this.discordInvitePattern = /(discord\.gg\/|discord\.com\/invite\/|\.gg\/)/gi;
        this.safeDomainsPattern = /(giphy\.com|tenor\.com|imgur\.com|youtube\.com|youtu\.be|spotify\.com|soundcloud\.com)/gi;
        this.antiRaidMode = false;
        
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', async () => {
            console.log(`[HENZY 3] ${this.client.user.tag} aktif! - URL & Spam Guard`.green);
            console.log(`[HENZY 3] Anti-Raid sistemi hazır - ${henzy.henzyGetSignature().name}`.cyan);
        });

        this.client.on('messageCreate', async (message) => {
            await this.henzyMessageProtection(message);
        });

        this.client.on('messageUpdate', async (oldMessage, newMessage) => {
            await this.henzyMessageEditProtection(oldMessage, newMessage);
        });

        this.client.on('webhookUpdate', async (channel) => {
            await this.henzyWebhookProtection(channel);
        });

        this.client.on('guildUpdate', async (oldGuild, newGuild) => {
            await this.henzyVanityUrlProtection(oldGuild, newGuild);
        });
    }

    async henzyMessageProtection(message) {
        try {
            if (!message.guild || message.author.bot) return;
            const guild = message.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'urlGuard')) return;

            if (await henzy.henzyCheckUser(guild.id, message.author.id)) return;

            const messageContent = message.content.toLowerCase();
            const hasDiscordInvite = this.discordInvitePattern.test(messageContent);
            const hasSafeUrl = this.safeDomainsPattern.test(messageContent);
            const hasUrl = this.urlPattern.test(messageContent);
            
            const userId = message.author.id;
            const currentTime = Date.now();
            
            if (!this.messageCounts.has(userId)) {
                this.messageCounts.set(userId, []);
            }
            
            const userMessages = this.messageCounts.get(userId);
            userMessages.push(currentTime);
            
            const recentMessages = userMessages.filter(time => currentTime - time < 10000);
            this.messageCounts.set(userId, recentMessages);

            if (hasDiscordInvite) {
                console.log(`[HENZY 3] 🚫 Discord davet linki tespit edildi: ${message.author.tag}`.red);
                
                try {
                    await message.delete();
                    console.log(`[HENZY 3] 🗑️ Discord davet linki silindi`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Mesaj silme hatası: ${error}`.red);
                }

                await henzy.henzyTimeoutUser(guild, userId, 10 * 60 * 1000, 'Discord davet linki - Henzy Guard');
                await henzy.henzySaveLog(guild.id, 'DISCORD_INVITE_DETECTED', message.author, null, 'Discord davet linki');
                return;
            }

            if (hasUrl && !hasSafeUrl) {
                console.log(`[HENZY 3] ⚠️ Şüpheli URL tespit edildi: ${message.author.tag} - ${message.content.substring(0, 50)}...`.yellow);
                
                try {
                    await message.delete();
                    console.log(`[HENZY 3] 🗑️ Şüpheli URL silindi`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Mesaj silme hatası: ${error}`.red);
                }

                await henzy.henzyTimeoutUser(guild, userId, 5 * 60 * 1000, 'Şüpheli URL - Henzy Guard');
                await henzy.henzySaveLog(guild.id, 'SUSPICIOUS_URL_DETECTED', message.author, null, 'Şüpheli URL');
                return;
            }

            if (recentMessages.length >= 5) {
                console.log(`[HENZY ANTI-RAID] 🚨 SPAM ALGILANDI! ${message.author.tag}`.red);
                
                try {
                    const messages = await message.channel.messages.fetch({ limit: 10 });
                    const userSpamMessages = messages.filter(msg => 
                        msg.author.id === userId && 
                        (currentTime - msg.createdTimestamp) < 10000
                    );
                    
                    for (const spamMsg of userSpamMessages.values()) {
                        await spamMsg.delete().catch(() => {});
                    }
                    console.log(`[HENZY 3] 🗑️ ${userSpamMessages.size} spam mesaj silindi`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Spam mesaj silme hatası: ${error}`.red);
                }

                await henzy.henzyEmergencyProtection(guild);
                this.messageCounts.delete(userId);
                return;
            }
            
        } catch (error) {
            console.log(`[HENZY ERROR] Mesaj koruması hatası: ${error}`.red);
        }
    }

    async henzyWebhookProtection(channel) {
        try {
            if (!channel.guild) return;
            const guild = channel.guild;

            if (!await henzy.henzyIsGuardEnabled(guild.id, 'urlGuard')) return;

            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.WebhookCreate,
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (!auditEntry) return;

            const executor = auditEntry.executor;
            
            if (await henzy.henzyCheckUser(guild.id, executor.id)) {
                console.log(`[HENZY 3] ${executor.tag} whitelist'te, webhook izin verildi`.green);
                return;
            }

            console.log(`[HENZY 3] ⚠️ Webhook oluşturuldu: ${executor.tag}`.red);

            try {
                const webhooks = await channel.fetchWebhooks();
                for (const webhook of webhooks.values()) {
                    if (webhook.owner && webhook.owner.id === executor.id) {
                        await webhook.delete('Henzy Guard: Yetkisiz webhook');
                        console.log(`[HENZY 3] 🗑️ Webhook silindi: ${webhook.name}`.red);
                    }
                }
            } catch (error) {
                console.log(`[HENZY ERROR] Webhook silme hatası: ${error}`.red);
            }

            await henzy.henzyBanUser(guild, executor.id, 'Yetkisiz webhook oluşturma - Henzy Guard');
            await henzy.henzySaveLog(guild.id, 'WEBHOOK_CREATE', executor, null, 'Yetkisiz webhook');
            
        } catch (error) {
            console.log(`[HENZY ERROR] Webhook koruması hatası: ${error}`.red);
        }
    }

    async henzyMessageEditProtection(oldMessage, newMessage) {
        try {
            if (!newMessage.guild || newMessage.author.bot) return;
            if (!oldMessage || !newMessage.content) return;
            
            const guild = newMessage.guild;
            
            if (!await henzy.henzyIsGuardEnabled(guild.id, 'urlGuard')) return;
            
            if (await henzy.henzyCheckUser(guild.id, newMessage.author.id)) return;
            
            const oldContent = oldMessage.content ? oldMessage.content.toLowerCase() : '';
            const newContent = newMessage.content.toLowerCase();
            
            const discordInvitePattern = /(discord\.gg\/|discord\.com\/invite\/)/i;
            const oldHasDiscordInvite = discordInvitePattern.test(oldContent);
            const newHasDiscordInvite = discordInvitePattern.test(newContent);
            const newHasSafeUrl = this.safeDomainsPattern.test(newContent);
            const newHasUrl = this.urlPattern.test(newContent);
            
            if (!oldHasDiscordInvite && newHasDiscordInvite) {
                console.log(`[HENZY 3] 🚫 Düzenlemede Discord davet linki tespit edildi: ${newMessage.author.tag}`.red);
                
                try {
                    await newMessage.delete();
                    console.log(`[HENZY 3] 🗑️ Düzenlenmiş Discord davet linki silindi`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Düzenlenmiş mesaj silme hatası: ${error}`.red);
                }
                
                await henzy.henzyTimeoutUser(guild, newMessage.author.id, 15 * 60 * 1000, 'Düzenlemede Discord davet linki - Henzy Guard');
                await henzy.henzySaveLog(guild.id, 'EDITED_DISCORD_INVITE', newMessage.author, null, 'Düzenlemede Discord davet linki');
                return;
            }
            
            if (newHasUrl && !newHasSafeUrl && !this.urlPattern.test(oldContent)) {
                console.log(`[HENZY 3] ⚠️ Düzenlemede şüpheli URL tespit edildi: ${newMessage.author.tag}`.yellow);
                
                try {
                    await newMessage.delete();
                    console.log(`[HENZY 3] 🗑️ Düzenlenmiş şüpheli URL silindi`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Düzenlenmiş mesaj silme hatası: ${error}`.red);
                }
                
                await henzy.henzyTimeoutUser(guild, newMessage.author.id, 10 * 60 * 1000, 'Düzenlemede şüpheli URL - Henzy Guard');
                await henzy.henzySaveLog(guild.id, 'EDITED_SUSPICIOUS_URL', newMessage.author, null, 'Düzenlemede şüpheli URL');
                return;
            }
            
        } catch (error) {
            console.error('[HENZY 3] Mesaj düzenleme koruması hatası:', error);
        }
    }

    async henzyVanityUrlProtection(oldGuild, newGuild) {
        try {
            if (!newGuild) return;
            
            if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
                console.log(`[HENZY 3] 🔗 Sunucu vanity URL değişti: ${oldGuild.vanityURLCode} → ${newGuild.vanityURLCode}`.yellow);
                
                const auditLogs = await newGuild.fetchAuditLogs({
                    type: 1,
                    limit: 1
                });
                
                const auditEntry = auditLogs.entries.first();
                if (auditEntry && auditEntry.executor) {
                            if (await henzy.henzyCheckUser(newGuild.id, auditEntry.executor.id)) return;
                    
                    console.log(`[HENZY 3] ⚠️ Vanity URL değiştiren: ${auditEntry.executor.tag}`.red);
                    
                    if (oldGuild.vanityURLCode) {
                        try {
                            await newGuild.setVanityCode(oldGuild.vanityURLCode);
                            console.log(`[HENZY 3] ✅ Vanity URL geri yüklendi: ${oldGuild.vanityURLCode}`.green);
                        } catch (error) {
                            console.log(`[HENZY 3] ❌ Vanity URL geri yüklenemedi: ${error.message}`.red);
                        }
                    }
                    
                    await henzy.henzyTimeoutUser(newGuild, auditEntry.executor.id, 30 * 60 * 1000, 'Vanity URL değiştirme - Henzy Guard');
                    await henzy.henzySaveLog(newGuild.id, 'VANITY_URL_CHANGED', auditEntry.executor, null, `${oldGuild.vanityURLCode} → ${newGuild.vanityURLCode}`);
                }
            }
            
        } catch (error) {
            console.error('[HENZY 3] Vanity URL koruması hatası:', error);
        }
    }

    async start() {
        try {
            
            await database.connect();
            console.log('[HENZY 3] MongoDB bağlantısı başarılı'.green);
            
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY 3] ❌ Config yüklenemedi!'.red);
                console.log('[HENZY 3] 📝 Botları başlatmak için: node sifrele.js'.cyan);
                process.exit(1);
            }
            
            if (!config.bots.guard3.token || config.bots.guard3.token === '') {
                console.log('[HENZY 3] ⚠️  Bot token bulunamadı! Lütfen şifreli config dosyasına token ekleyin'.yellow);
                console.log('[HENZY 3] 📝 Config yönetimi için database bot slash komutlarını kullanın'.cyan);
                return;
            }
            
            await this.client.login(config.bots.guard3.token);
        } catch (error) {
            console.error('[HENZY 3] Başlatma hatası:', error);
        }
    }
}

const henzyGuard3 = new HenzyGuard3();
henzyGuard3.start();

module.exports = HenzyGuard3;
