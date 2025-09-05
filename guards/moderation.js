const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const colors = require('colors');
const henzy = require('../data/core');

class HenzyModeration {
    constructor() {
        this.cooldowns = new Map();
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ]
        });

        this.setupEvents();
    }

    setupEvents() {
        this.client.on('clientReady', () => {
            console.log(`[HENZY MOD] ${this.client.user.tag} active! - Moderation Bot`.green);
            console.log(`[HENZY MOD] Moderation system ready - ${henzy.getFooterText()}`.cyan);
            this.registerCommands();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            process.nextTick(async () => {
                try {
                    await this.handleCommand(interaction);
                } catch (error) {
                    console.log(`[HENZY MOD ERROR] Interaction error: ${error}`.red);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ Hata oluştu.', flags: 64 });
                        }
                    } catch (replyError) {
                        console.log(`[HENZY MOD ERROR] Reply error: ${replyError}`.red);
                    }
                }
            });
        });
    }

    async registerCommands() {
        if (!this.client.user) {
            console.log(`[HENZY MOD] Bot not ready yet`.yellow);
            return;
        }
        
        const commands = [
            new SlashCommandBuilder()
                .setName('ban')
                .setDescription('Kullanıcıyı banlar')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(false))
                .addStringOption(option =>
                    option.setName('id').setDescription('Kullanıcı ID (sunucuda olmayan kullanıcılar için)').setRequired(false))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Ban sebebi').setRequired(false))
                .setDefaultMemberPermissions(null),
            
            new SlashCommandBuilder()
                .setName('kick')
                .setDescription('Kullanıcıyı kickler')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Kicklenecek kullanıcı').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Kick sebebi').setRequired(false))
                .setDefaultMemberPermissions(null),
            
            new SlashCommandBuilder()
                .setName('timeout')
                .setDescription('Kullanıcıya timeout verir')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Timeout verilecek kullanıcı').setRequired(true))
                .addIntegerOption(option =>
                    option.setName('sure').setDescription('Timeout süresi (dakika)').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Timeout sebebi').setRequired(false))
                .setDefaultMemberPermissions(null),
            
            new SlashCommandBuilder()
                .setName('lock')
                .setDescription('Kanalı kilitler')
                .addChannelOption(option =>
                    option.setName('kanal').setDescription('Kilitlenecek kanal').setRequired(false))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Kilitleme sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            
            new SlashCommandBuilder()
                .setName('unlock')
                .setDescription('Kanalın kilidini açar')
                .addChannelOption(option =>
                    option.setName('kanal').setDescription('Kilidi açılacak kanal').setRequired(false))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Kilit açma sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
            
            new SlashCommandBuilder()
                .setName('unban')
                .setDescription('Kullanıcının banını açar')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Banı açılacak kullanıcı').setRequired(false))
                .addStringOption(option =>
                    option.setName('id').setDescription('Kullanıcı ID').setRequired(false))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Unban sebebi').setRequired(false))
                .setDefaultMemberPermissions(null)
        ];

        try {
            const guild = this.client.guilds.cache.first();
            await guild.commands.set(commands);
            console.log(`[HENZY MOD] ${commands.length} slash commands registered`.green);
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Command registration error: ${error}`.red);
        }
    }

    checkCooldown(userId, commandName) {
        const cooldownKey = `${userId}-${commandName}`;
        const now = Date.now();
        const cooldownTime = 3000;
        
        if (this.cooldowns.has(cooldownKey)) {
            const expirationTime = this.cooldowns.get(cooldownKey) + cooldownTime;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return timeLeft;
            }
        }
        
        this.cooldowns.set(cooldownKey, now);
        return 0;
    }

    async handleCommand(interaction) {
        const { commandName } = interaction;

        // Check cooldown
        const cooldownLeft = this.checkCooldown(interaction.user.id, commandName);
        if (cooldownLeft > 0) {
            const cooldownEmbed = henzy.henzyCreateEmbed('⏰ Cooldown', `Please wait ${cooldownLeft.toFixed(1)} seconds.`, 0xFFAA00);
            return await interaction.reply({ embeds: [cooldownEmbed], flags: 64 });
        }

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚡ Processing...', flags: 64 });
        }

        const isOwner = await henzy.henzyIsOwner(interaction.user.id);
        const isWhitelisted = await henzy.henzyCheckUser(interaction.guild.id, interaction.user.id);
        
        if (!isOwner && !isWhitelisted) {
            const noPermEmbed = henzy.henzyCreateEmbed('❌ Yetki Yok', 'Bu komutu kullanmak için whitelist\'te olmanız gerekiyor.', 0xFF0000);
            return await interaction.editReply({ embeds: [noPermEmbed] });
        }

        try {
            switch (commandName) {
                case 'ban':
                    await this.banUser(interaction);
                    break;
                case 'kick':
                    await this.kickUser(interaction);
                    break;
                case 'timeout':
                    await this.timeoutUser(interaction);
                    break;
                case 'lock':
                    await this.lockChannel(interaction);
                    break;
                case 'unlock':
                    await this.unlockChannel(interaction);
                    break;
                case 'unban':
                    await this.unbanUser(interaction);
                    break;
            }
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Command error: ${error}`.red);
            try {
                const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Komut başarısız.', 0xFF0000);
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                console.log(`[HENZY MOD ERROR] Reply error: ${replyError}`.red);
            }
        }
    }

    async banUser(interaction) {
        const user = interaction.options.getUser('kullanici');
        const userId = interaction.options.getString('id');
        const reason = interaction.options.getString('sebep') || 'Sebep yok';
        
        if (!user && !userId) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kullanıcı veya ID belirtmelisiniz.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        try {
            let targetId, targetTag;
            
            if (user) {
                targetId = user.id;
                targetTag = user.tag;
            } else {
                targetId = userId;
                try {
                    const fetchedUser = await interaction.client.users.fetch(userId);
                    targetTag = fetchedUser.tag;
                } catch {
                    targetTag = `ID: ${userId}`;
                }
            }
            
            await interaction.guild.members.ban(targetId, { reason: `${reason} - ${interaction.user.tag}` });
            const banEmbed = henzy.henzyCreateEmbed('🔨 Ban', `${targetTag} banlandı\n**Sebep:** ${reason}`, 0xFF0000);
            await interaction.editReply({ embeds: [banEmbed] });
        } catch (error) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Ban başarısız.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async kickUser(interaction) {
        const user = interaction.options.getUser('kullanici');
        const member = interaction.guild.members.cache.get(user.id);
        const reason = interaction.options.getString('sebep') || 'Sebep yok';
        
        if (!member) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kullanıcı bulunamadı.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        try {
            await member.kick(`${reason} - ${interaction.user.tag}`);
            const kickEmbed = henzy.henzyCreateEmbed('👢 Kick', `${user.tag} kicklendi\n**Sebep:** ${reason}`, 0xFFAA00);
            await interaction.editReply({ embeds: [kickEmbed] });
        } catch (error) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kick başarısız.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async timeoutUser(interaction) {
        const user = interaction.options.getUser('kullanici');
        const member = interaction.guild.members.cache.get(user.id);
        const duration = interaction.options.getInteger('sure');
        const reason = interaction.options.getString('sebep') || 'Sebep yok';
        
        if (!member) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kullanıcı bulunamadı.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        try {
            await member.timeout(duration * 60 * 1000, `${reason} - ${interaction.user.tag}`);
            const timeoutEmbed = henzy.henzyCreateEmbed('🔇 Timeout', `${user.tag} timeout aldı\n**Süre:** ${duration}dk\n**Sebep:** ${reason}`, 0xFFAA00);
            await interaction.editReply({ embeds: [timeoutEmbed] });
        } catch (error) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Timeout başarısız.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async lockChannel(interaction) {
        const channel = interaction.options.getChannel('kanal') || interaction.channel;
        const reason = interaction.options.getString('sebep') || 'Henzy Moderation';
        
        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false,
                AddReactions: false,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
                SendMessagesInThreads: false
            }, reason);

            const lockEmbed = henzy.henzyCreateEmbed(
                '🔒 Kanal Kilitlendi',
                `${channel} kanalı kilitlendi.\n**Sebep:** ${reason}`,
                0xFF0000
            );
            await interaction.editReply({ embeds: [lockEmbed] });
        } catch (error) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kanal kilitlenemedi.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async unlockChannel(interaction) {
        const channel = interaction.options.getChannel('kanal') || interaction.channel;
        const reason = interaction.options.getString('sebep') || 'Henzy Moderation';
        
        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null,
                AddReactions: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null,
                SendMessagesInThreads: null
            }, reason);

            const unlockEmbed = henzy.henzyCreateEmbed(
                '🔓 Kanal Kilidi Açıldı',
                `${channel} kanalının kilidi açıldı.\n**Sebep:** ${reason}`,
                0x00FF00
            );
            await interaction.editReply({ embeds: [unlockEmbed] });
        } catch (error) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kanal kilidi açılamadı.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async unbanUser(interaction) {
        const user = interaction.options.getUser('kullanici');
        const userId = interaction.options.getString('id');
        const reason = interaction.options.getString('sebep') || 'Sebep yok';
        
        if (!user && !userId) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Kullanıcı veya ID belirtmelisiniz.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }
        
        try {
            let targetId, targetTag;
            
            if (user) {
                targetId = user.id;
                targetTag = user.tag;
            } else {
                targetId = userId;
                try {
                    const fetchedUser = await interaction.client.users.fetch(userId);
                    targetTag = fetchedUser.tag;
                } catch {
                    targetTag = `ID: ${userId}`;
                }
            }
            
            const bans = await interaction.guild.bans.fetch();
            const banEntry = bans.get(targetId);
            
            if (!banEntry) {
                const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', `${targetTag} zaten banlı değil.`, 0xFF0000);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }
            
            await interaction.guild.bans.remove(targetId, `${reason} - ${interaction.user.tag}`);
            const unbanEmbed = henzy.henzyCreateEmbed('✅ Unban', `${targetTag} banı açıldı\n**Sebep:** ${reason}`, 0x00FF00);
            await interaction.editReply({ embeds: [unbanEmbed] });
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Unban error: ${error}`.red);
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', `Unban başarısız: ${error.message}`, 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async start() {
        try {
            
            const configManager = require('../config/configManager');
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY MOD] ❌ Config could not be loaded!'.red);
                console.log('[HENZY MOD] 📝 To start bots: node sifrele.js'.cyan);
                process.exit(1);
            }
            await this.client.login(config.bots.moderation.token);
            console.log(`[HENZY MOD] Moderation bot started`.green);
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Bot startup error: ${error}`.red);
        }
    }
}

const moderationBot = new HenzyModeration();
moderationBot.start();

module.exports = HenzyModeration;
