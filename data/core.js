const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');
const Whitelist = require('../models/Whitelist');
const GuardLog = require('../models/GuardLog');

class HenzySystem {
    constructor() {
        this.name = 'Henzy Guard System';
        this.version = '2025';
        this.author = 'Henzy';
    }

    async henzyCheckUser(guildId, userId) {
        try {
            if (await this.henzyIsOwner(userId)) {
                return true;
            }

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('MongoDB timeout after 5 seconds')), 5000)
            );
            
            const whitelistPromise = Whitelist.findOne({ guildId, userId });
            
            const whitelist = await Promise.race([whitelistPromise, timeoutPromise]);
            return !!whitelist;
        } catch (error) {
            console.log(`[HENZY ERROR] Whitelist check failed: ${error.message}`.red);
            
            if (await this.henzyIsOwner(userId)) {
                return true;
            }
            
            return false;
        }
    }

    async henzyIsOwner(userId) {
        try {
            const configManager = require('../config/configManager');
            const config = await configManager.getConfig();
            if (!config || !config.guild || !config.guild.ownerId) {
                return false;
            }
            return userId === config.guild.ownerId;
        } catch (error) {
            return false;
        }
    }

    async henzyIsTrustedBot(userId) {
        const trustedBots = ['BOT_ID_1', 'BOT_ID_2']; 
        return trustedBots.includes(userId);
    }
    async henzyGetGuild(guildId) {
        try {
            let guild = await Guild.findOne({ guildId });
            if (!guild) {
                guild = await this.henzyCreateGuild(guildId);
            }
            return guild;
        } catch (error) {
            console.log(`[HENZY ERROR] Guild get failed: ${error.message}`.red);
            return null;
        }
    }

    async henzyCreateGuild(guildId) {
        try {
            const guild = new Guild({
                guildId,
                guards: {
                    channelGuard: true,
                    roleGuard: true,
                    banGuard: true,
                    kickGuard: true,
                    urlGuard: true,
                    emojiGuard: true,
                    stickerGuard: true,
                    antiRaid: true
                },
                limits: {
                    channelLimit: 3,
                    roleLimit: 3,
                    banLimit: 2,
                    kickLimit: 3,
                    urlLimit: 5,
                    emojiLimit: 5
                },
                punishmentType: 'ban'
            });
            await guild.save();
            return guild;
        } catch (error) {
            console.log(`[HENZY ERROR] Guild create failed: ${error.message}`.red);
            return null;
        }
    }

    async henzyIsGuardEnabled(guildId, guardType) {
        try {
            const guild = await this.henzyGetGuild(guildId);
            return guild ? guild.guards[guardType] : false;
        } catch (error) {
            console.log(`[HENZY ERROR] Guard check failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyGetGuildSettings(guildId) {
        try {
            const guild = await this.henzyGetGuild(guildId);
            return guild;
        } catch (error) {
            console.log(`[HENZY ERROR] Guild settings get failed: ${error.message}`.red);
            return null;
        }
    }

    async henzyGetGuardStatus(guildId, guardType) {
        try {
            const guild = await this.henzyGetGuild(guildId);
            if (!guild) return false;
            
            let guardValue = guild.guards[guardType];
            if (typeof guardValue === 'object' && guardValue !== null) {
                return guardValue.enabled || false;
            }
            return guardValue || false;
        } catch (error) {
            console.log(`[HENZY ERROR] Guard status check failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyToggleGuard(guildId, guardType) {
        try {
            let guild = await Guild.findOne({ guildId });
            if (!guild) {
                guild = new Guild({
                    guildId,
                    guards: {
                        channelGuard: true,
                        roleGuard: true,
                        banGuard: true,
                        kickGuard: true,
                        urlGuard: true,
                        emojiGuard: true,
                        stickerGuard: true,
                        antiRaid: true
                    },
                    limits: {
                        channelLimit: 3,
                        roleLimit: 3,
                        banLimit: 2,
                        kickLimit: 3,
                        urlLimit: 5,
                        emojiLimit: 5
                    },
                    punishmentType: 'ban'
                });
            }
            
            let currentValue = guild.guards[guardType];
            if (typeof currentValue === 'object' && currentValue !== null) {
                currentValue = currentValue.enabled || false;
            } else if (typeof currentValue !== 'boolean') {
                currentValue = false;
            }
            
            guild.guards[guardType] = !currentValue;
            await guild.save();
            return guild.guards[guardType];
        } catch (error) {
            console.log(`[HENZY ERROR] Guard toggle failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyAddWhitelist(guildId, userId, addedBy) {
        try {
            const existing = await Whitelist.findOne({ guildId, userId });
            if (existing) return false;

            const whitelist = new Whitelist({
                guildId,
                userId,
                addedBy,
                addedAt: new Date()
            });
            await whitelist.save();
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Whitelist add failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyRemoveWhitelist(guildId, userId) {
        try {
            await Whitelist.deleteOne({ guildId, userId });
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Whitelist remove failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyGetWhitelist(guildId) {
        try {
            return await Whitelist.find({ guildId });
        } catch (error) {
            console.log(`[HENZY ERROR] Whitelist get failed: ${error.message}`.red);
            return [];
        }
    }

    async henzyBanUser(guild, userId, reason = 'Henzy Guard Protection') {
        try {
            await guild.members.ban(userId, { reason });
            console.log(`[HENZY] User banned: ${userId} - Reason: ${reason}`.red);
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Ban failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyKickUser(guild, userId, reason = 'Henzy Guard Protection') {
        try {
            const member = await guild.members.fetch(userId);
            await member.kick(reason);
            console.log(`[HENZY] User kicked: ${userId} - Reason: ${reason}`.yellow);
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Kick failed: ${error.message}`.red);
            return false;
        }
    }

    async henzyTimeoutUser(guild, userId, duration, reason = 'Henzy Guard Protection') {
        try {
            const member = await guild.members.fetch(userId);
            await member.timeout(duration, reason);
            console.log(`[HENZY] User timed out: ${userId} - Duration: ${duration}ms`.yellow);
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Timeout failed: ${error.message}`.red);
            return false;
        }
    }

    async henzySaveLog(guildId, action, executor, target, reason) {
        try {
            const log = new GuardLog({
                guildId,
                action,
                executor: {
                    id: executor.id,
                    tag: executor.tag
                },
                target: {
                    id: target?.id || 'Unknown',
                    name: target?.name || 'Unknown'
                },
                reason,
                timestamp: new Date()
            });
            await log.save();
            return true;
        } catch (error) {
            console.log(`[HENZY ERROR] Log save failed: ${error.message}`.red);
            return false;
        }
    }

    henzyCreateEmbed(title, description, color = 0xFF0000) {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: 'Henzy Guard System' })
            .setTimestamp();
    }

    async henzyDetectMassDelete(guild, deletedCount) {
        if (deletedCount >= 5) {
            console.log(`[HENZY ANTI-RAID] 🚨 MASS DELETE ALGILANDI! ${deletedCount} kanal silindi!`.red);
            await this.henzyEmergencyProtection(guild);
            return true;
        }
        return false;
    }

    async henzyEmergencyProtection(guild) {
        try {
            console.log(`[HENZY ANTI-RAID] 🛡️ ACİL DURUM KORUNMASI BAŞLADI!`.red);
            
            await this.henzyBanRecentJoiners(guild, 10 * 60 * 1000);
            
            await this.henzyScanSuspiciousActivity(guild);
            
            await this.henzyLockdownPermissions(guild);
            
            console.log(`[HENZY ANTI-RAID] ✅ ACİL DURUM KORUNMASI TAMAMLANDI!`.green);
        } catch (error) {
            console.log(`[HENZY ANTI-RAID ERROR] ${error.message}`.red);
        }
    }

    async henzyBanRecentJoiners(guild, timeLimit) {
        try {
            const members = await guild.members.fetch();
            let bannedCount = 0;
            const currentTime = Date.now();

            for (const [id, member] of members) {
                if (await this.henzyCheckUser(guild.id, id)) continue;
                
                if (member.id === guild.ownerId) continue;
                
                if (member.user.username.toLowerCase().includes('henzy') || 
                    member.user.username.toLowerCase().includes('guard')) continue;

                const joinTime = member.joinedTimestamp;
                if (joinTime && (currentTime - joinTime) < timeLimit) {
                    try {
                        await member.ban({ reason: 'Henzy Anti-Raid: Şüpheli yeni üye' });
                        console.log(`[HENZY ANTI-RAID] ⚡ ${member.user.tag} banlandı (yeni üye)`.red);
                        bannedCount++;
                    } catch (banError) {
                        console.log(`[HENZY ERROR] Ban hatası: ${banError.message}`.red);
                    }
                }
            }

            console.log(`[HENZY ANTI-RAID] 🔨 ${bannedCount} şüpheli üye banlandı`.green);
            return bannedCount;
        } catch (error) {
            console.log(`[HENZY ANTI-RAID ERROR] ${error.message}`.red);
            return 0;
        }
    }

    async henzyScanSuspiciousActivity(guild) {
        try {
            const auditLogs = await guild.fetchAuditLogs({ limit: 50 });
            const suspiciousUsers = new Set();
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

            for (const entry of auditLogs.entries.values()) {
                if (entry.createdTimestamp > fiveMinutesAgo) {
                    if (entry.action === 'CHANNEL_DELETE' || 
                        entry.action === 'ROLE_DELETE' || 
                        entry.action === 'MEMBER_BAN_ADD') {
                        suspiciousUsers.add(entry.executor.id);
                    }
                }
            }

            for (const userId of suspiciousUsers) {
                if (await this.henzyCheckUser(guild.id, userId)) continue;
                
                try {
                    await guild.members.ban(userId, { reason: 'Henzy Anti-Raid: Şüpheli aktivite' });
                    console.log(`[HENZY ANTI-RAID] 🎯 Şüpheli kullanıcı banlandı: ${userId}`.red);
                } catch (error) {
                    console.log(`[HENZY ERROR] Şüpheli kullanıcı banlanamadı: ${error.message}`.red);
                }
            }

            return suspiciousUsers.size;
        } catch (error) {
            console.log(`[HENZY ANTI-RAID ERROR] ${error.message}`.red);
            return 0;
        }
    }

    async henzyLockdownPermissions(guild) {
        try {
            const channels = guild.channels.cache.filter(channel => 
                channel.type === 0 || channel.type === 2
            );
            
            let lockedCount = 0;
            for (const [channelId, channel] of channels) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        Speak: false,
                        Connect: false
                    }, 'Henzy Anti-Raid: Emergency Lockdown');
                    lockedCount++;
                } catch (channelError) {
                    console.log(`[HENZY ANTI-RAID ERROR] Channel lock error ${channel.name}: ${channelError.message}`.red);
                }
            }
            
            console.log(`[HENZY ANTI-RAID] 🔒 ${lockedCount} channels locked down`.yellow);
            return true;
        } catch (error) {
            console.log(`[HENZY ANTI-RAID ERROR] Lockdown error: ${error.message}`.red);
            return false;
        }
    }

    async henzyInstantChannelRecreate(guild, deletedChannel) {
        try {
            const channelData = {
                name: deletedChannel.name,
                type: deletedChannel.type,
                position: deletedChannel.position,
                reason: 'Henzy Anti-Raid: Instant recovery'
            };

            if (deletedChannel.parent) {
                channelData.parent = deletedChannel.parent;
            }

            const newChannel = await guild.channels.create(channelData);
            console.log(`[HENZY ANTI-RAID] ⚡ Channel instantly recreated: ${newChannel.name}`.green);
            
            return newChannel;
        } catch (error) {
            console.log(`[HENZY ANTI-RAID ERROR] Channel recreation error: ${error.message}`.red);
            return null;
        }
    }

    henzyFormatUser(user) {
        return `<@${user.id}>`;
    }

    henzyGetPrefix() {
        return 'HENZY';
    }

    henzyGetSignature() {
        return {
            name: this.name,
            version: this.version,
            author: this.author
        };
    }

    async henzyClearWhitelist(guildId) {
        try {
            const result = await Whitelist.deleteMany({ guildId });
            return result.deletedCount;
        } catch (error) {
            console.log(`[HENZY ERROR] Clear whitelist failed: ${error.message}`.red);
            return 0;
        }
    }

}

module.exports = new HenzySystem();
