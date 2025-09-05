// Henzy Guard Log Model
// Created by: Henzy

const mongoose = require('mongoose');

const guardLogSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'CHANNEL_DELETE', 'CHANNEL_CREATE', 'CHANNEL_UPDATE',
            'ROLE_DELETE', 'ROLE_CREATE', 'ROLE_UPDATE',
            'MEMBER_BAN_ADD', 'MEMBER_BAN_REMOVE',
            'MEMBER_KICK', 'MEMBER_UPDATE',
            'MESSAGE_DELETE', 'MESSAGE_BULK_DELETE',
            'EMOJI_DELETE', 'EMOJI_CREATE',
            'STICKER_DELETE', 'STICKER_CREATE',
            'URL_DETECTED', 'SPAM_DETECTED',
            'RAID_DETECTED', 'MASS_DELETE_DETECTED',
            'WHITELIST_ADD', 'WHITELIST_REMOVE',
            'GUARD_ENABLE', 'GUARD_DISABLE',
            'PUNISHMENT_BAN', 'PUNISHMENT_KICK', 'PUNISHMENT_TIMEOUT'
        ]
    },
    executor: {
        id: {
            type: String,
            required: true
        },
        tag: {
            type: String,
            default: 'Unknown#0000'
        },
        username: {
            type: String,
            default: 'Unknown'
        },
        isBot: {
            type: Boolean,
            default: false
        },
        isWhitelisted: {
            type: Boolean,
            default: false
        }
    },
    target: {
        id: {
            type: String,
            default: null
        },
        name: {
            type: String,
            default: 'Unknown'
        },
        type: {
            type: String,
            enum: ['user', 'channel', 'role', 'emoji', 'sticker', 'message', 'guild'],
            default: 'unknown'
        }
    },
    details: {
        reason: {
            type: String,
            default: 'Henzy Guard Protection'
        },
        oldValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        newValue: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        count: {
            type: Number,
            default: 1
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        }
    },
    punishment: {
        applied: {
            type: Boolean,
            default: false
        },
        type: {
            type: String,
            enum: ['ban', 'kick', 'timeout', 'warn', 'none'],
            default: 'none'
        },
        duration: {
            type: Number,
            default: null
        },
        success: {
            type: Boolean,
            default: false
        },
        error: {
            type: String,
            default: null
        }
    },
    guardBot: {
        name: {
            type: String,
            required: true,
            enum: ['henzy-database', 'henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4']
        },
        version: {
            type: String,
            default: '2024'
        }
    },
    metadata: {
        channelId: {
            type: String,
            default: null
        },
        messageId: {
            type: String,
            default: null
        },
        auditLogId: {
            type: String,
            default: null
        },
        ipAddress: {
            type: String,
            default: null
        },
        userAgent: {
            type: String,
            default: null
        }
    },
    antiRaid: {
        isRaidAction: {
            type: Boolean,
            default: false
        },
        raidId: {
            type: String,
            default: null
        },
        massActionCount: {
            type: Number,
            default: 0
        },
        timeWindow: {
            type: Number,
            default: 0
        },
        emergencyMode: {
            type: Boolean,
            default: false
        }
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'failed', 'ignored'],
        default: 'processed'
    }
}, {
    timestamps: true,
    collection: 'guard_logs'
});

guardLogSchema.index({ guildId: 1, createdAt: -1 });
guardLogSchema.index({ action: 1, createdAt: -1 });
guardLogSchema.index({ 'executor.id': 1 });
guardLogSchema.index({ 'target.id': 1 });
guardLogSchema.index({ 'guardBot.name': 1 });
guardLogSchema.index({ 'details.severity': 1 });
guardLogSchema.index({ 'antiRaid.isRaidAction': 1 });
guardLogSchema.index({ status: 1 });


guardLogSchema.virtual('formattedTime').get(function() {
    return this.createdAt.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

guardLogSchema.virtual('actionDescription').get(function() {
    const descriptions = {
        'CHANNEL_DELETE': 'Kanal Silindi',
        'CHANNEL_CREATE': 'Kanal Oluşturuldu',
        'ROLE_DELETE': 'Rol Silindi',
        'ROLE_CREATE': 'Rol Oluşturuldu',
        'MEMBER_BAN_ADD': 'Üye Banlandı',
        'MEMBER_KICK': 'Üye Atıldı',
        'URL_DETECTED': 'URL Tespit Edildi',
        'RAID_DETECTED': 'Raid Tespit Edildi',
        'MASS_DELETE_DETECTED': 'Toplu Silme Tespit Edildi'
    };
    return descriptions[this.action] || this.action;
});

guardLogSchema.methods.markAsRaidAction = function(raidId, massCount = 0) {
    this.antiRaid.isRaidAction = true;
    this.antiRaid.raidId = raidId;
    this.antiRaid.massActionCount = massCount;
    this.details.severity = 'critical';
    return this.save();
};

guardLogSchema.methods.updatePunishment = function(type, success, error = null, duration = null) {
    this.punishment.applied = true;
    this.punishment.type = type;
    this.punishment.success = success;
    this.punishment.error = error;
    this.punishment.duration = duration;
    return this.save();
};

guardLogSchema.statics.findRecentByUser = function(guildId, userId, minutes = 5) {
    const timeLimit = new Date(Date.now() - (minutes * 60 * 1000));
    return this.find({
        guildId,
        'executor.id': userId,
        createdAt: { $gte: timeLimit }
    }).sort({ createdAt: -1 });
};

guardLogSchema.statics.findRaidActions = function(guildId, raidId = null) {
    const query = {
        guildId,
        'antiRaid.isRaidAction': true
    };
    
    if (raidId) {
        query['antiRaid.raidId'] = raidId;
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

guardLogSchema.statics.getActionStats = async function(guildId, days = 7) {
    const timeLimit = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const stats = await this.aggregate([
        {
            $match: {
                guildId,
                createdAt: { $gte: timeLimit }
            }
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                lastAction: { $max: '$createdAt' }
            }
        },
        {
            $sort: { count: -1 }
        }
    ]);
    
    return stats;
};

guardLogSchema.statics.cleanupOldLogs = async function(days = 30) {
    const timeLimit = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const result = await this.deleteMany({
        createdAt: { $lt: timeLimit },
        'details.severity': { $ne: 'critical' }
    });
    
    console.log(`[HENZY DB] ${result.deletedCount} eski log kaydı temizlendi`.yellow);
    return result.deletedCount;
};


guardLogSchema.pre('save', function(next) {
    if (this.isNew) {
        if (this.action.includes('RAID') || this.action.includes('MASS_DELETE')) {
            this.details.severity = 'critical';
        } else if (this.action.includes('BAN') || this.action.includes('DELETE')) {
            this.details.severity = 'high';
        }
        
        console.log(`[HENZY DB] Yeni log kaydediliyor: ${this.guildId}/${this.action}`.green);
    }
    next();
});

module.exports = mongoose.model('GuardLog', guardLogSchema);
