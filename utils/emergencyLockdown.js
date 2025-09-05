const configManager = require('../config/configManager');

class EmergencyLockdown {
    constructor() {
        this.isLockdownActive = false;
        this.lockdownStartTime = null;
        this.suspiciousActivity = new Map();
        this.emergencyChannels = new Map();
    }

    detectSuspiciousActivity(guildId, activityType, userId) {
        const key = `${guildId}-${userId}-${activityType}`;
        const now = Date.now();
        
        if (!this.suspiciousActivity.has(key)) {
            this.suspiciousActivity.set(key, []);
        }
        
        const activities = this.suspiciousActivity.get(key);
        activities.push(now);

        const recentActivities = activities.filter(time => now - time < 10000);
        this.suspiciousActivity.set(key, recentActivities);

        const thresholds = {
            'channelDelete': 3, 
            'memberBan': 5,     
            'roleDelete': 2,    
            'massAction': 4    
        };
        
        if (recentActivities.length >= (thresholds[activityType] || 4)) {
            console.log(`[EMERGENCY] Şüpheli aktivite tespit edildi: ${activityType} - User: ${userId}`.red);
            return true;
        }
        
        return false;
    }

    async activateLockdown(guild, reason, triggeredBy) {
        if (this.isLockdownActive) return;
        
        this.isLockdownActive = true;
        this.lockdownStartTime = Date.now();
        
        console.log(`[EMERGENCY] 🚨 LOCKDOWN ACTIVATED: ${reason}`.red);
        console.log(`[EMERGENCY] Triggered by: ${triggeredBy}`.yellow);
        
        try {
            await this.lockAllChannels(guild);
            
            await this.createEmergencyChannel(guild, reason);
            
            await this.notifyOwner(guild, reason, triggeredBy);
            
            setTimeout(() => {
                this.deactivateLockdown(guild);
            }, 300000); 
            
        } catch (error) {
            console.error('[EMERGENCY] Lockdown aktivasyon hatası:', error);
        }
    }

    async lockAllChannels(guild) {
        console.log('[EMERGENCY] Tüm kanallar kilitleniyor...'.yellow);
        
        for (const [channelId, channel] of guild.channels.cache) {
            try {
                if (channel.isTextBased()) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false
                    });
                }
            } catch (error) {
                console.error(`[EMERGENCY] Kanal kilitleme hatası ${channel.name}:`, error.message);
            }
        }
    }

    async createEmergencyChannel(guild, reason) {
        try {
            const emergencyChannel = await guild.channels.create({
                name: '🚨-acil-durum-henzy',
                topic: `Henzy Guard Emergency Lockdown - ${reason}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['SendMessages', 'AddReactions']
                    },
                    {
                        id: guild.ownerId,
                        allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
                    }
                ]
            });

            this.emergencyChannels.set(guild.id, emergencyChannel.id);

            const emergencyEmbed = {
                title: '🚨 HENZY GUARD EMERGENCY LOCKDOWN',
                description: `**Sebep:** ${reason}\n**Zaman:** ${new Date().toLocaleString('tr-TR')}\n\n**Yapılan İşlemler:**\n• Tüm kanallar kilitledi\n• Şüpheli kullanıcı tespit edildi\n• Otomatik unlock: 5 dakika\n\n**Manuel unlock için:** Henzy Guard Database bot'unu yeniden başlatın`,
                color: 0xFF0000,
                timestamp: new Date(),
                footer: { text: 'Henzy Guard Emergency System' }
            };

            await emergencyChannel.send({ embeds: [emergencyEmbed] });
            
        } catch (error) {
            console.error('[EMERGENCY] Acil durum kanalı oluşturma hatası:', error);
        }
    }

    async notifyOwner(guild, reason, triggeredBy) {
        try {
            const owner = await guild.fetchOwner();
            
            const dmEmbed = {
                title: '🚨 HENZY GUARD EMERGENCY ALERT',
                description: `**Sunucu:** ${guild.name}\n**Sebep:** ${reason}\n**Tetikleyen:** ${triggeredBy}\n**Zaman:** ${new Date().toLocaleString('tr-TR')}\n\nSunucunuz acil durum kilidine alındı. Kontrol edin!`,
                color: 0xFF0000,
                timestamp: new Date()
            };

            await owner.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.error('[EMERGENCY] Owner bilgilendirme hatası:', error);
        }
    }

    async deactivateLockdown(guild) {
        if (!this.isLockdownActive) return;
        
        this.isLockdownActive = false;
        console.log('[EMERGENCY] 🔓 Lockdown deactivated'.green);
        
        try {
            for (const [channelId, channel] of guild.channels.cache) {
                try {
                    if (channel.isTextBased() && !channel.name.includes('acil-durum')) {
                        await channel.permissionOverwrites.edit(guild.roles.everyone, {
                            SendMessages: null,
                            AddReactions: null,
                            CreatePublicThreads: null,
                            CreatePrivateThreads: null
                        });
                    }
                } catch (error) {
                    console.error(`[EMERGENCY] Kanal unlock hatası ${channel.name}:`, error.message);
                }
            }
            
            const emergencyChannelId = this.emergencyChannels.get(guild.id);
            if (emergencyChannelId) {
                const emergencyChannel = guild.channels.cache.get(emergencyChannelId);
                if (emergencyChannel) {
                    await emergencyChannel.delete();
                }
                this.emergencyChannels.delete(guild.id);
            }
            
        } catch (error) {
            console.error('[EMERGENCY] Lockdown deactivation hatası:', error);
        }
    }

    isInLockdown() {
        return this.isLockdownActive;
    }

    clearSuspiciousActivity() {
        this.suspiciousActivity.clear();
    }
}

module.exports = new EmergencyLockdown();
