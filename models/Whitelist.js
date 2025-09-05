
const mongoose = require('mongoose');

const whitelistSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    userTag: {
        type: String,
        default: 'Unknown#0000'
    },
    addedBy: {
        type: String,
        required: true
    },
    addedByTag: {
        type: String,
        default: 'Unknown#0000'
    },
    reason: {
        type: String,
        default: 'Henzy Guard Whitelist'
    },
    permissions: {
        channelManage: {
            type: Boolean,
            default: true
        },
        roleManage: {
            type: Boolean,
            default: true
        },
        memberManage: {
            type: Boolean,
            default: true
        },
        urlBypass: {
            type: Boolean,
            default: true
        },
        emojiManage: {
            type: Boolean,
            default: true
        },
        allPermissions: {
            type: Boolean,
            default: false
        }
    },
    temporary: {
        enabled: {
            type: Boolean,
            default: false
        },
        expiresAt: {
            type: Date,
            default: null
        },
        duration: {
            type: Number,
            default: null 
        }
    },
    statistics: {
        actionsPerformed: {
            type: Number,
            default: 0
        },
        lastAction: {
            type: Date,
            default: null
        },
        warningsGiven: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'expired'],
        default: 'active'
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true,
    collection: 'whitelists'
});

whitelistSchema.index({ guildId: 1, userId: 1 }, { unique: true });
whitelistSchema.index({ addedBy: 1 });
whitelistSchema.index({ status: 1 });
whitelistSchema.index({ 'temporary.expiresAt': 1 });

whitelistSchema.virtual('isExpired').get(function() {
    if (!this.temporary.enabled || !this.temporary.expiresAt) {
        return false;
    }
    return new Date() > this.temporary.expiresAt;
});

whitelistSchema.virtual('remainingTime').get(function() {
    if (!this.temporary.enabled || !this.temporary.expiresAt) {
        return null;
    }
    const now = new Date();
    const expires = this.temporary.expiresAt;
    return expires > now ? expires - now : 0;
});

whitelistSchema.methods.hasPermission = function(permissionType) {
    if (this.permissions.allPermissions) {
        return true;
    }
    return this.permissions[permissionType] || false;
};

whitelistSchema.methods.incrementAction = function() {
    this.statistics.actionsPerformed += 1;
    this.statistics.lastAction = new Date();
    return this.save();
};

whitelistSchema.methods.addWarning = function() {
    this.statistics.warningsGiven += 1;
    return this.save();
};

whitelistSchema.methods.suspend = function(reason = 'Henzy Guard Suspension') {
    this.status = 'suspended';
    this.notes += `\n[${new Date().toISOString()}] Suspended: ${reason}`;
    return this.save();
};

whitelistSchema.methods.reactivate = function(reason = 'Henzy Guard Reactivation') {
    this.status = 'active';
    this.notes += `\n[${new Date().toISOString()}] Reactivated: ${reason}`;
    return this.save();
};

whitelistSchema.statics.findActive = function(guildId, userId) {
    return this.findOne({ 
        guildId, 
        userId, 
        status: 'active',
        $or: [
            { 'temporary.enabled': false },
            { 'temporary.expiresAt': { $gt: new Date() } }
        ]
    });
};

whitelistSchema.statics.findExpired = function() {
    return this.find({
        'temporary.enabled': true,
        'temporary.expiresAt': { $lt: new Date() },
        status: 'active'
    });
};

whitelistSchema.statics.cleanupExpired = async function() {
    const expired = await this.findExpired();
    const count = expired.length;
    
    await this.updateMany(
        {
            'temporary.enabled': true,
            'temporary.expiresAt': { $lt: new Date() },
            status: 'active'
        },
        { 
            status: 'expired',
            $push: { 
                notes: `\n[${new Date().toISOString()}] Auto-expired by Henzy Guard`
            }
        }
    );
    
    console.log(`[HENZY DB] ${count} expired whitelist cleaned up`.yellow);
    return count;
};

whitelistSchema.pre('save', function(next) {
    if (this.temporary.enabled && this.temporary.expiresAt && new Date() > this.temporary.expiresAt) {
        this.status = 'expired';
    }
    
    if (this.isNew) {
        console.log(`[HENZY DB] Yeni whitelist kaydediliyor: ${this.guildId}/${this.userId}`.green);
    }
    
    next();
});

module.exports = mongoose.model('Whitelist', whitelistSchema);
