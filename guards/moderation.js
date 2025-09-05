const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const colors = require('colors');
const henzy = require('../data/core');

class HenzyModeration {
    constructor() {
        this.cooldowns = new Map();
        this.autoRoleSettings = new Map();
        this.voiceConnections = new Map();
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
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

        this.client.on('guildMemberAdd', async (member) => {
            try {
                const autoRoleId = this.autoRoleSettings.get(member.guild.id);
                if (!autoRoleId) return;

                const role = member.guild.roles.cache.get(autoRoleId);
                if (!role) {
                    this.autoRoleSettings.delete(member.guild.id);
                    return;
                }

                await member.roles.add(role);
                console.log(`[HENZY MOD] Auto-role ${role.name} given to ${member.user.tag}`.green);
            } catch (error) {
                console.log(`[HENZY MOD ERROR] Auto-role error: ${error}`.red);
            }
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
                .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
            
            new SlashCommandBuilder()
                .setName('kick')
                .setDescription('Kullanıcıyı kickler')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Kicklenecek kullanıcı').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Kick sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
            
            new SlashCommandBuilder()
                .setName('timeout')
                .setDescription('Kullanıcıya timeout verir')
                .addUserOption(option => 
                    option.setName('kullanici').setDescription('Timeout verilecek kullanıcı').setRequired(true))
                .addIntegerOption(option =>
                    option.setName('sure').setDescription('Timeout süresi (dakika)').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Timeout sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
            
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
                .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
            
            new SlashCommandBuilder()
                .setName('otorol')
                .setDescription('Otomatik rol ayarlarını yönetir')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('ayarla')
                        .setDescription('Otorol ayarlar')
                        .addRoleOption(option =>
                            option.setName('rol').setDescription('Verilecek rol').setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('kapat')
                        .setDescription('Otorolü kapatır'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('durum')
                        .setDescription('Otorol durumunu gösterir'))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
            
            new SlashCommandBuilder()
                .setName('sesdur')
                .setDescription('Tüm botları belirtilen ses kanalına muted olarak ekler')
                .addChannelOption(option =>
                    option.setName('kanal').setDescription('Ses kanalı').setRequired(true))
                .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),

            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Belirtilen sayıda mesajı siler')
                .addIntegerOption(option =>
                    option.setName('sayi').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
                .addUserOption(option =>
                    option.setName('kullanici').setDescription('Belirli kullanıcının mesajlarını sil').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

            new SlashCommandBuilder()
                .setName('rolver')
                .setDescription('Kullanıcıya rol verir')
                .addUserOption(option =>
                    option.setName('kullanici').setDescription('Rol verilecek kullanıcı').setRequired(true))
                .addRoleOption(option =>
                    option.setName('rol').setDescription('Verilecek rol').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Rol verme sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

            new SlashCommandBuilder()
                .setName('rolal')
                .setDescription('Kullanıcıdan rol alır')
                .addUserOption(option =>
                    option.setName('kullanici').setDescription('Rolü alınacak kullanıcı').setRequired(true))
                .addRoleOption(option =>
                    option.setName('rol').setDescription('Alınacak rol').setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep').setDescription('Rol alma sebebi').setRequired(false))
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
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
            await interaction.reply({ content: '⚡ Processing...' });
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
                case 'otorol':
                    await this.handleAutoRole(interaction);
                    break;
                case 'sesdur':
                    await this.muteBotsInVoice(interaction);
                    break;
                case 'clear':
                    await this.clearMessages(interaction);
                    break;
                case 'rolver':
                    await this.giveRole(interaction);
                    break;
                case 'rolal':
                    await this.removeRole(interaction);
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
            const banEmbed = henzy.henzyCreateEmbed('<a:henzy_ban:1281306600093667339> Ban', `${targetTag} banlandı\n**Sebep:** ${reason}`, 0xFF0000);
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
            const kickEmbed = henzy.henzyCreateEmbed('<a:henzy_kick:1281306601536741376> Kick', `${user.tag} kicklendi\n**Sebep:** ${reason}`, 0xFFAA00);
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
            const timeoutEmbed = henzy.henzyCreateEmbed('<a:henzy_timeout:1281306603151421440> Timeout', `${user.tag} timeout aldı\n**Süre:** ${duration}dk\n**Sebep:** ${reason}`, 0xFFAA00);
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
                '<a:henzy_lock:1281306605248573450> Kanal Kilitlendi',
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
                '<a:henzy_unlock:1281306606838476800> Kanal Kilidi Açıldı',
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

    async handleAutoRole(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'ayarla':
                await this.setAutoRole(interaction);
                break;
            case 'kapat':
                await this.disableAutoRole(interaction);
                break;
            case 'durum':
                await this.showAutoRoleStatus(interaction);
                break;
        }
    }

    async setAutoRole(interaction) {
        const role = interaction.options.getRole('rol');
        
        if (!role) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Rol bulunamadı.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        if (role.managed) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Bot rolleri otorol olarak ayarlanamaz.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Bu rol benim en yüksek rolümden daha yüksek.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        this.autoRoleSettings.set(interaction.guild.id, role.id);
        
        const successEmbed = henzy.henzyCreateEmbed(
            '✅ Otorol Ayarlandı',
            `${role} rolü otorol olarak ayarlandı.\nYeni üyeler sunucuya katıldığında otomatik olarak bu rolü alacak.`,
            0x00FF00
        );
        await interaction.editReply({ embeds: [successEmbed] });
    }

    async disableAutoRole(interaction) {
        const hadAutoRole = this.autoRoleSettings.has(interaction.guild.id);
        
        if (!hadAutoRole) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Zaten aktif bir otorol ayarı yok.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        this.autoRoleSettings.delete(interaction.guild.id);
        
        const successEmbed = henzy.henzyCreateEmbed(
            '✅ Otorol Kapatıldı',
            'Otorol başarıyla kapatıldı. Artık yeni üyeler otomatik rol almayacak.',
            0x00FF00
        );
        await interaction.editReply({ embeds: [successEmbed] });
    }

    async showAutoRoleStatus(interaction) {
        const autoRoleId = this.autoRoleSettings.get(interaction.guild.id);
        
        if (!autoRoleId) {
            const statusEmbed = henzy.henzyCreateEmbed(
                '📊 Otorol Durumu',
                '❌ Otorol kapalı\n\n`/otorol ayarla` komutu ile otorol ayarlayabilirsiniz.',
                0xFFAA00
            );
            return await interaction.editReply({ embeds: [statusEmbed] });
        }

        const role = interaction.guild.roles.cache.get(autoRoleId);
        
        if (!role) {
            this.autoRoleSettings.delete(interaction.guild.id);
            const errorEmbed = henzy.henzyCreateEmbed(
                '❌ Hata',
                'Otorol olarak ayarlanan rol bulunamadı. Otorol ayarı temizlendi.',
                0xFF0000
            );
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const statusEmbed = henzy.henzyCreateEmbed(
            '📊 Otorol Durumu',
            `✅ Otorol aktif\n**Rol:** ${role}\n**Rol ID:** ${role.id}\n\nYeni üyeler sunucuya katıldığında otomatik olarak bu rolü alacak.`,
            0x00FF00
        );
        await interaction.editReply({ embeds: [statusEmbed] });
    }

    async muteBotsInVoice(interaction) {
        const channel = interaction.options.getChannel('kanal') || interaction.member.voice?.channel;
        
        if (!channel) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Ses kanalı belirtmelisiniz veya bir ses kanalında olmalısınız.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        if (channel.type !== 2) {
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Bu bir ses kanalı değil.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            await this.connectAllBotsToVoice(channel);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const updatedChannel = await channel.fetch();
            const botCount = updatedChannel.members.filter(member => member.user.bot).size;

            const successEmbed = henzy.henzyCreateEmbed(
                '<a:henzy_voice:1281306608327434240> Sesdur Tamamlandı',
                `${channel} kanalına ${botCount} bot başarıyla eklendi ve AFK moduna geçti.\nBotlar otomatik olarak muted + deafened durumda.\nRestart sonrası da bu kanalda kalacaklar.`,
                0x00FF00
            );
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.log(`[HENZY MOD ERROR] Sesdur error: ${error}`.red);
            const errorEmbed = henzy.henzyCreateEmbed('❌ Hata', 'Botları kanala ekleme işlemi başarısız.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async connectAllBotsToVoice(channel) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const voiceCommand = {
                action: 'joinVoice',
                channelId: channel.id,
                guildId: channel.guild.id,
                timestamp: Date.now()
            };
            
            const commandFile = path.join(__dirname, '..', 'data', 'voice_command.json');
            fs.writeFileSync(commandFile, JSON.stringify(voiceCommand, null, 2));
            
            await this.joinVoiceChannel(channel.id, channel.guild.id);
            
            console.log(`[HENZY MOD] Voice command sent to all bots for channel: ${channel.name}`.green);
            
            setTimeout(() => {
                try {
                    if (fs.existsSync(commandFile)) {
                        fs.unlinkSync(commandFile);
                    }
                } catch (cleanupError) {
                    console.log(`[HENZY MOD] Cleanup error: ${cleanupError.message}`.yellow);
                }
            }, 10000);

        } catch (error) {
            console.log(`[HENZY MOD ERROR] Connect all bots error: ${error}`.red);
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

            console.log(`[HENZY MOD] Ses kanalına bağlandı: ${channel.name}`.green);
            return connection;
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Ses kanalı bağlantı hatası: ${error}`.red);
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

    async clearMessages(interaction) {
        const amount = interaction.options.getInteger('sayi');
        const targetUser = interaction.options.getUser('kullanici');
        
        try {
            let messages;
            if (targetUser) {
                const allMessages = await interaction.channel.messages.fetch({ limit: 100 });
                messages = allMessages.filter(msg => msg.author.id === targetUser.id).first(amount);
            } else {
                messages = await interaction.channel.messages.fetch({ limit: amount });
            }

            if (messages.size === 0) {
                const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Silinecek mesaj bulunamadı.', 0xFF0000);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            await interaction.channel.bulkDelete(messages, true);
            
            const successEmbed = henzy.henzyCreateEmbed(
                '<a:henzy_check:1281306596662734918> Mesajlar Silindi',
                `${messages.size} mesaj başarıyla silindi.${targetUser ? `\n**Hedef:** ${targetUser.tag}` : ''}`,
                0x00FF00
            );
            await interaction.editReply({ embeds: [successEmbed] });
            
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Clear error: ${error}`.red);
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Mesajlar silinemedi.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async giveRole(interaction) {
        const user = interaction.options.getUser('kullanici');
        const role = interaction.options.getRole('rol');
        const reason = interaction.options.getString('sebep') || 'Henzy Moderation';
        const member = interaction.guild.members.cache.get(user.id);
        
        if (!member) {
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Kullanıcı bulunamadı.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        if (member.roles.cache.has(role.id)) {
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Kullanıcıda bu rol zaten var.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            await member.roles.add(role, `${reason} - ${interaction.user.tag}`);
            const successEmbed = henzy.henzyCreateEmbed(
                '<a:henzy_check:1281306596662734918> Rol Verildi',
                `${user.tag} kullanıcısına ${role} rolü verildi.\n**Sebep:** ${reason}`,
                0x00FF00
            );
            await interaction.editReply({ embeds: [successEmbed] });
            
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Give role error: ${error}`.red);
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Rol verilemedi.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async removeRole(interaction) {
        const user = interaction.options.getUser('kullanici');
        const role = interaction.options.getRole('rol');
        const reason = interaction.options.getString('sebep') || 'Henzy Moderation';
        const member = interaction.guild.members.cache.get(user.id);
        
        if (!member) {
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Kullanıcı bulunamadı.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        if (!member.roles.cache.has(role.id)) {
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Kullanıcıda bu rol yok.', 0xFF0000);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        try {
            await member.roles.remove(role, `${reason} - ${interaction.user.tag}`);
            const successEmbed = henzy.henzyCreateEmbed(
                '<a:henzy_check:1281306596662734918> Rol Alındı',
                `${user.tag} kullanıcısından ${role} rolü alındı.\n**Sebep:** ${reason}`,
                0xFFAA00
            );
            await interaction.editReply({ embeds: [successEmbed] });
            
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Remove role error: ${error}`.red);
            const errorEmbed = henzy.henzyCreateEmbed('<a:henzy_cross:1281306598734471168> Hata', 'Rol alınamadı.', 0xFF0000);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    startVoiceCommandMonitoring() {
        const fs = require('fs');
        const path = require('path');
        
        setInterval(() => {
            try {
                const commandFile = path.join(__dirname, '..', 'data', 'voice_command.json');
                if (fs.existsSync(commandFile)) {
                    const command = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
                    const now = Date.now();
                    
                    if (now - command.timestamp < 30000) {
                        this.joinVoiceChannel(command.channelId, command.guildId);
                        console.log(`[HENZY MOD] Voice command received, joining channel`.green);
                    }
                }
            } catch (error) {
                
            }
        }, 2000);
    }

    setupActivityRotation() {
        const { ActivityType } = require('discord.js');
        
        const activities = [
            { name: 'Henzy 🤍 Moderation', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Core System', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Guard Protection', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Moderation Active', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Anti-Raid System', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' }
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
                        console.log(`[HENZY MOD] Rejoined voice channel: ${channel.name}`.green);
                    }
                }
            }
        } catch (error) {
            
        }
    }

    async start() {
        try {
            const database = require('../config/database');
            await database.connect();
            console.log('[HENZY MOD] MongoDB connection successful'.green);
            
            const configManager = require('../config/configManager');
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY MOD] ❌ Config could not be loaded!'.red);
                return;
            }

            this.client.login(config.bots.moderation.token);
            console.log('[HENZY MOD] Moderation bot started'.green);
            
            this.client.once('ready', () => {
                this.setupActivityRotation();
                this.startVoiceCommandMonitoring();
                setTimeout(() => {
                    this.checkAndRejoinVoice();
                }, 5000);
            });
        } catch (error) {
            console.log(`[HENZY MOD ERROR] Start error: ${error}`.red);
        }
    }
}

const moderationBot = new HenzyModeration();
moderationBot.start();

module.exports = HenzyModeration;
