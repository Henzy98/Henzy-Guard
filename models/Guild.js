
const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    guildName: {
        type: String,
        default: 'Unknown Guild'
    },
    ownerId: {
        type: String,
        required: false
    },
    guards: {
        channelGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        roleGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        banGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        kickGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        urlGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        emojiGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        stickerGuard: { type: mongoose.Schema.Types.Mixed, default: true },
        antiRaid: { type: mongoose.Schema.Types.Mixed, default: true }
    },
    limits: {
        channelLimit: Number,
        roleLimit: Number,
        banLimit: Number,
        kickLimit: Number,
        urlLimit: Number,
        emojiLimit: Number
    },
    punishmentType: {
        type: String,
        enum: ['ban', 'kick', 'timeout', 'warn'],
        default: 'ban'
    },
    timeoutDuration: {
        type: Number,
        default: 600000, 
        min: 60000,      
        max: 2419200000  
    },
    logChannels: {
        guardLog: {
            type: String,
            default: null
        },
        auditLog: {
            type: String,
            default: null
        },
        raidLog: {
            type: String,
            default: null
        }
    },
    antiRaidSettings: {
        enabled: {
            type: Boolean,
            default: true
        },
        massDeleteThreshold: {
            type: Number,
            default: 5,
            min: 2,
            max: 20
        },
        newMemberBanTime: {
            type: Number,
            default: 600000, 
            min: 60000,      
            max: 86400000   
        },
        lockdownMode: {
            type: Boolean,
            default: false
        },
        emergencyContacts: [{
            userId: String,
            role: {
                type: String,
                enum: ['owner', 'admin', 'moderator'],
                default: 'admin'
            }
        }]
    },
    whitelistedRoles: [{
        roleId: String,
        roleName: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    trustedBots: [{
        botId: String,
        botName: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    statistics: {
        totalActions: {
            type: Number,
            default: 0
        },
        channelActions: {
            type: Number,
            default: 0
        },
        roleActions: {
            type: Number,
            default: 0
        },
        banActions: {
            type: Number,
            default: 0
        },
        kickActions: {
            type: Number,
            default: 0
        },
        raidsPrevented: {
            type: Number,
            default: 0
        },
        lastAction: {
            type: Date,
            default: null
        }
    },
    settings: {
        language: {
            type: String,
            enum: ['tr', 'en'],
            default: 'tr'
        },
        timezone: {
            type: String,
            default: 'Europe/Istanbul'
        },
        embedColor: {
            type: String,
            default: '#FF0000'
        },
        footerText: {
            type: String,
            default: 'Henzy Guard System'
        }
    },
    premium: {
        enabled: {
            type: Boolean,
            default: false
        },
        expiresAt: {
            type: Date,
            default: null
        },
        features: [{
            type: String,
            enum: ['advanced_logs', 'custom_limits', 'priority_support', 'backup_restore']
        }]
    }
}, {
    timestamps: true,
    collection: 'guilds'
});

guildSchema.index({ ownerId: 1 });
guildSchema.index({ 'guards.antiRaid': 1 });
guildSchema.index({ createdAt: -1 });

guildSchema.virtual('whitelistCount').get(function() {
    return this.whitelistedRoles ? this.whitelistedRoles.length : 0;
});

guildSchema.methods.isGuardEnabled = function(guardType) {
    return this.guards[guardType] || false;
};

guildSchema.methods.getPunishmentSettings = function() {
    return {
        type: this.punishmentType,
        timeout: this.timeoutDuration
    };
};

guildSchema.methods.incrementStats = function(actionType) {
    this.statistics.totalActions += 1;
    if (this.statistics[actionType + 'Actions'] !== undefined) {
        this.statistics[actionType + 'Actions'] += 1;
    }
    this.statistics.lastAction = new Date();
    return this.save();
};

guildSchema.statics.findByGuildId = function(guildId) {
    return this.findOne({ guildId });
};

guildSchema.pre('save', function(next) {
    if (this.isNew) {
        console.log(`[HENZY DB] Yeni guild kaydediliyor: ${this.guildId}`.green);
    }
    next();
});

module.exports = mongoose.model('Guild', guildSchema);
