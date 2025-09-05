const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const { exec } = require('child_process');
const database = require('../config/database');
const configManager = require('../config/configManager');
const henzy = require('../data/core');
const discordLogger = require('../utils/discordLogger');
const colors = require('colors');

class HenzyDatabase {
    constructor() {
        this.cooldowns = new Map();
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.guardStatus = new Map();
        this.voiceConnections = new Map();
        this.setupEvents();
    }

    setupEvents() {
        this.client.once('clientReady', async () => {
            console.log(`[HENZY DB] ${this.client.user.tag} aktif! - Database Management`.green);
            console.log(`[HENZY DB] Merkezi yönetim sistemi hazır - ${henzy.henzyGetSignature().name}`.cyan);
            
            const config = await configManager.getConfig();
            if (config && config.guild.consoleLogChannelId) {
                await discordLogger.initialize(this.client, config.guild.consoleLogChannelId);
            }
            
            await this.registerCommands();
            this.setupActivityRotation();
            this.startVoiceCommandMonitoring();
            setTimeout(() => {
                this.checkAndRejoinVoice();
            }, 5000);
            
            setInterval(() => this.checkGuardStatus(), 30000);
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleCommand(interaction);
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    setupActivityRotation() {
        const { ActivityType } = require('discord.js');
        
        const activities = [
            { name: 'Henzy 🤍 Database', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Henzy Core System', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Database Management', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Guard Control Panel', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' },
            { name: 'Central Management', type: ActivityType.Streaming, url: 'https://www.twitch.tv/henzy37' }
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
                        console.log(`[HENZY DB] Rejoined voice channel: ${channel.name}`.green);
                    }
                }
            }
        } catch (error) {
            
        }
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('guard-panel')
                .setDescription('Henzy Guard yönetim paneli')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Guard botlarının durumunu göster')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('start')
                        .setDescription('Tüm guard botlarını başlat')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('stop')
                        .setDescription('Tüm guard botlarını durdur')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('restart')
                        .setDescription('Tüm guard botlarını yeniden başlat')
                ),

            new SlashCommandBuilder()
                .setName('whitelist')
                .setDescription('Henzy whitelist yönetimi')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Kullanıcıyı whitelist\'e ekle')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Eklenecek kullanıcı')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Kullanıcıyı whitelist\'ten çıkar')
                        .addUserOption(option =>
                            option.setName('user')
                                .setDescription('Çıkarılacak kullanıcı')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Whitelist\'i göster')
                ),

            new SlashCommandBuilder()
                .setName('guard-settings')
                .setDescription('Henzy guard ayarları')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('Mevcut guard ayarlarını göster')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('toggle')
                        .setDescription('Guard\'ı aç/kapat')
                        .addStringOption(option =>
                            option.setName('guard')
                                .setDescription('Guard tipi')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Kanal Guard', value: 'channelGuard' },
                                    { name: 'Rol Guard', value: 'roleGuard' },
                                    { name: 'Ban Guard', value: 'banGuard' },
                                    { name: 'Kick Guard', value: 'kickGuard' },
                                    { name: 'URL Guard', value: 'urlGuard' },
                                    { name: 'Emoji Guard', value: 'emojiGuard' },
                                    { name: 'Sticker Guard', value: 'stickerGuard' },
                                    { name: 'Anti-Raid', value: 'antiRaid' },
                                    { name: 'Spam Guard', value: 'spamGuard' }
                                )
                        )
                ),

            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Henzy Guard yardım menüsü')
        ];

        try {
            const guild = this.client.guilds.cache.first();
            if (guild) {
                await guild.commands.set([]);  // Önce temizle
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
                await guild.commands.set(commands); // Sonra yeni komutları ekle
                console.log(`[HENZY DB] Slash komutları ${guild.name} sunucusuna kaydedildi`.green);
            } else {
                await this.client.application.commands.set([]);  // Global komutları temizle
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.client.application.commands.set(commands);
                console.log('[HENZY DB] Global slash commands registered'.green);
            }
        } catch (error) {
            console.error('[HENZY DB] Command registration error:', error);
        }
    }

    checkCooldown(userId, commandName) {
        const cooldownKey = `${userId}-${commandName}`;
        const now = Date.now();
        const cooldownTime = 5000; // 5 seconds
        
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
        try {
            const { commandName, options } = interaction;

            // Check cooldown
            const cooldownLeft = this.checkCooldown(interaction.user.id, commandName);
            if (cooldownLeft > 0) {
                const cooldownEmbed = henzy.henzyCreateEmbed('⏰ Cooldown', `Please wait ${cooldownLeft.toFixed(1)} seconds.`, 0xFFAA00);
                return await interaction.reply({ embeds: [cooldownEmbed], flags: 64 });
            }

            if (!await henzy.henzyIsOwner(interaction.user.id) && 
                interaction.user.id !== interaction.guild?.ownerId) {
                await interaction.reply({
                    content: '❌ You do not have permission to use this command!',
                    flags: 64
                });
                return;
            }

            if (commandName === 'guard-panel') {
                await this.handleGuardPanel(interaction, options);
            } else if (commandName === 'whitelist') {
                await this.handleWhitelist(interaction, options);
            } else if (commandName === 'guard-settings') {
                await this.handleGuardSettings(interaction, options);
            } else if (commandName === 'help') {
                await this.handleHelp(interaction);
            }

        } catch (error) {
            console.error('[HENZY DB] Command processing error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error occurred while processing command!',
                    flags: 64
                });
            }
        }
    }

    async handleHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Henzy Guard Help Menu')
            .setDescription('Henzy Guard system commands and usage')
            .setColor('#00FF00')
            .addFields(
                {
                    name: '🎛️ Guard Panel',
                    value: '`/guard-panel status` - Bot status\n`/guard-panel start` - Start bots\n`/guard-panel stop` - Stop bots\n`/guard-panel restart` - Restart bots',
                    inline: false
                },
                {
                    name: '👥 Whitelist Management',
                    value: '`/whitelist add @user` - Add user\n`/whitelist remove @user` - Remove user\n`/whitelist list` - Show list\n`/whitelist clear` - Clear list',
                    inline: false
                },
                {
                    name: '⚙️ Guard Settings',
                    value: '`/guard-settings view` - Show current settings\n`/guard-settings toggle [guard-type]` - Toggle guard on/off',
                    inline: false
                }
            )
            .setFooter({ text: 'Henzy Guard System' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });
    }

    async handleGuardPanel(interaction, options) {
        const subcommand = options.getSubcommand();

        switch (subcommand) {
            case 'status':
                await this.showGuardStatus(interaction);
                break;
            case 'start':
                await this.startAllGuards(interaction);
                break;
            case 'stop':
                await this.stopAllGuards(interaction);
                break;
            case 'restart':
                await this.restartAllGuards(interaction);
                break;
        }
    }

    async handleWhitelist(interaction, options) {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        switch (subcommand) {
            case 'add':
                const userToAdd = options.getUser('user');
                const added = await henzy.henzyAddWhitelist(guildId, userToAdd.id, interaction.user.id);
                
                if (added) {
                    await interaction.reply({
                        embeds: [henzy.henzyCreateEmbed(
                            '✅ Whitelist - Eklendi',
                            `${userToAdd.tag} whitelist'e eklendi`,
                            0x00FF00
                        )]
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Kullanıcı zaten whitelist\'te!',
                        flags: 64
                    });
                }
                break;

            case 'remove':
                const userToRemove = options.getUser('user');
                await henzy.henzyRemoveWhitelist(guildId, userToRemove.id);
                
                await interaction.reply({
                    embeds: [henzy.henzyCreateEmbed(
                        '✅ Whitelist - Çıkarıldı',
                        `${userToRemove.tag} whitelist'ten çıkarıldı`,
                        0xFF0000
                    )]
                });
                break;

            case 'list':
                const whitelist = await henzy.henzyGetWhitelist(guildId);
                
                if (whitelist.length === 0) {
                    await interaction.reply({
                        content: '📝 Whitelist boş!',
                        flags: 64
                    });
                    return;
                }

                const whitelistText = whitelist.map((entry, index) => 
                    `${index + 1}. <@${entry.userId}> - ${entry.addedAt ? new Date(entry.addedAt).toLocaleDateString() : 'Bilinmiyor'}`
                ).join('\n');

                await interaction.reply({
                    embeds: [henzy.henzyCreateEmbed(
                        '📝 Henzy Whitelist',
                        whitelistText,
                        0x0099FF
                    )]
                });
                break;

            case 'clear':
                const clearedCount = await henzy.henzyClearWhitelist(guildId);
                
                await interaction.reply({
                    embeds: [henzy.henzyCreateEmbed(
                        '🗑️ Whitelist Temizlendi',
                        `${clearedCount} kullanıcı whitelist'ten kaldırıldı`,
                        0xFF0000
                    )]
                });
                break;
        }
    }

    async handleGuardSettings(interaction, options) {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        switch (subcommand) {
            case 'view':
                const guildSettings = await henzy.henzyGetGuildSettings(guildId);
                
                const settingsEmbed = henzy.henzyCreateEmbed(
                    '⚙️ Guard Ayarları',
                    `**Kanal Guard:** ${guildSettings.guards.channelGuard ? '✅' : '❌'}\n` +
                    `**Rol Guard:** ${guildSettings.guards.roleGuard ? '✅' : '❌'}\n` +
                    `**Ban Guard:** ${guildSettings.guards.banGuard ? '✅' : '❌'}\n` +
                    `**Kick Guard:** ${guildSettings.guards.kickGuard ? '✅' : '❌'}\n` +
                    `**URL Guard:** ${guildSettings.guards.urlGuard ? '✅' : '❌'}\n` +
                    `**Emoji Guard:** ${guildSettings.guards.emojiGuard ? '✅' : '❌'}\n` +
                    `**Sticker Guard:** ${guildSettings.guards.stickerGuard ? '✅' : '❌'}\n` +
                    `**Anti-Raid:** ${guildSettings.guards.antiRaid ? '✅' : '❌'}`,
                    0x0099FF
                );
                
                await interaction.reply({ embeds: [settingsEmbed], flags: 64 });
                break;

            case 'toggle':
                const guardType = options.getString('guard');
                const currentStatus = await henzy.henzyGetGuardStatus(guildId, guardType);
                await henzy.henzyToggleGuard(guildId, guardType);
                
                await interaction.reply({
                    embeds: [henzy.henzyCreateEmbed(
                        '⚙️ Guard Ayarı Değiştirildi',
                        `**${guardType}** ${!currentStatus ? 'açıldı ✅' : 'kapatıldı ❌'}`,
                        !currentStatus ? 0x00FF00 : 0xFF0000
                    )],
                    flags: 64
                });
                break;

        }
    }

    async showGuardStatus(interaction) {
        await interaction.deferReply();
        console.log(`[HENZY DB] ${interaction.user.tag} guard durumunu sorguladı`.cyan);

        const guards = ['henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4', 'henzy-moderation'];
        let statusText = '';

        for (const guard of guards) {
            try {
                const result = await this.execCommand(`pm2 jlist`);
                const processes = JSON.parse(result);
                const guardProcess = processes.find(p => p.name === guard);
                
                if (guardProcess) {
                    const status = guardProcess.pm2_env.status;
                    const statusEmoji = status === 'online' ? '<a:olumlu:1413289716341670098>' : '<a:olumsuz:1413289704098627614>';
                    const memory = guardProcess.monit ? Math.round(guardProcess.monit.memory / 1024 / 1024) : 0;
                    const cpu = guardProcess.monit ? guardProcess.monit.cpu : 0;
                    
                    statusText += `${statusEmoji} **${guard}**: ${status}\n`;
                    statusText += `   📊 RAM: ${memory}MB | CPU: ${cpu}%\n\n`;
                } else {
                    statusText += `<a:olumsuz:1413289704098627614> **${guard}**: offline\n\n`;
                }
            } catch (error) {
                statusText += `<a:olumsuz:1413289704098627614> **${guard}**: error\n\n`;
            }
        }

        const statusEmbed = henzy.henzyCreateEmbed(
            '🛡️ Guard Bot Durumu',
            statusText,
            0x00FF00
        );

        await interaction.editReply({ embeds: [statusEmbed] });
    }

    async startAllGuards(interaction) {
        await interaction.deferReply();

        const guards = ['henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4', 'henzy-moderation'];
        let resultText = '';

        for (const guard of guards) {
            try {
                await this.execCommand(`pm2 start ${guard}`);
                console.log(`[HENZY DB] ${guard} Discord komutu ile başlatıldı`.green);
                resultText += `<a:olumlu:1413289716341670098> ${guard} started\n`;
            } catch (error) {
                console.log(`[HENZY DB] ${guard} başlatma hatası: ${error.message}`.red);
                resultText += `<a:olumsuz:1413289704098627614> ${guard} could not be started\n`;
            }
        }

        await interaction.editReply({
            embeds: [henzy.henzyCreateEmbed(
                '🚀 Guard Başlatma Sonucu',
                resultText,
                0x00FF00
            )]
        });
    }

    async stopAllGuards(interaction) {
        await interaction.deferReply();

        const guards = ['henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4', 'henzy-moderation'];
        let resultText = '';

        for (const guard of guards) {
            try {
                await this.execCommand(`pm2 stop ${guard}`);
                console.log(`[HENZY DB] ${guard} Discord komutu ile durduruldu`.red);
                resultText += `<a:olumsuz:1413289704098627614> ${guard} stopped\n`;
            } catch (error) {
                console.log(`[HENZY DB] ${guard} durdurma hatası: ${error.message}`.red);
                resultText += `<a:olumsuz:1413289704098627614> ${guard} could not be stopped\n`;
            }
        }

        await interaction.editReply({
            embeds: [henzy.henzyCreateEmbed(
                '⏹️ Guard Durdurma Sonucu',
                resultText,
                0xFF0000
            )]
        });
    }

    async restartAllGuards(interaction) {
        await interaction.deferReply();

        const guards = ['henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4', 'henzy-moderation'];
        let resultText = '';

        for (const guard of guards) {
            try {
                await this.execCommand(`pm2 restart ${guard}`);
                console.log(`[HENZY DB] ${guard} Discord komutu ile yeniden başlatıldı`.yellow);
                resultText += `<a:olumlu:1413289716341670098> ${guard} restarted\n`;
            } catch (error) {
                console.log(`[HENZY DB] ${guard} yeniden başlatma hatası: ${error.message}`.red);
                resultText += `<a:olumsuz:1413289704098627614> ${guard} could not be restarted\n`;
            }
        }

        await interaction.editReply({
            embeds: [henzy.henzyCreateEmbed(
                '🔄 Guard Yeniden Başlatma Sonucu',
                resultText,
                0x0099FF
            )]
        });
    }

    async checkGuardStatus() {
        const guards = ['henzy-guard1', 'henzy-guard2', 'henzy-guard3', 'henzy-guard4', 'henzy-moderation'];
        
        for (const guard of guards) {
            const status = await this.getProcessStatus(guard);
            const previousStatus = this.guardStatus.get(guard);
            
            if (previousStatus && previousStatus !== status) {
                console.log(`[HENZY DB] ${guard} durumu değişti: ${previousStatus} -> ${status}`.yellow);
            }
            
            this.guardStatus.set(guard, status);
        }
    }

    async getProcessStatus(processName) {
        try {
            const output = await this.execCommand(`pm2 jlist`);
            const processes = JSON.parse(output);
            const process = processes.find(p => p.name === processName);
            
            return process ? process.pm2_env.status : 'offline';
        } catch (error) {
            return 'unknown';
        }
    }

    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
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

            console.log(`[HENZY DB] Ses kanalına bağlandı: ${channel.name}`.green);
            return connection;
        } catch (error) {
            console.log(`[HENZY DB ERROR] Ses kanalı bağlantı hatası: ${error}`.red);
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

    startVoiceCommandMonitoring() {
        const fs = require('fs');
        const path = require('path');
        
        const commandFile = path.join(__dirname, '..', 'data', 'voice_command.json');
        
        setInterval(() => {
            try {
                if (fs.existsSync(commandFile)) {
                    const command = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
                    
                    if (command.action === 'joinVoice' && command.timestamp > (Date.now() - 15000)) {
                        this.joinVoiceChannel(command.channelId, command.guildId);
                        console.log(`[HENZY DB] Voice command received, joining channel`.green);
                    }
                }
            } catch (error) {
                
            }
        }, 2000);
    }

    async start() {
        try {
            
            await database.connect();
            console.log('[HENZY DB] MongoDB connection successful'.green);
            
            const config = await configManager.getConfig();
            if (!config) {
                console.log('[HENZY DB] ❌ Config could not be loaded!'.red);
                console.log('[HENZY DB] 📝 To start bots: node sifrele.js'.cyan);
                process.exit(1);
            }
            
            if (!config.bots.database.token || config.bots.database.token === '') {
                console.log('[HENZY DB] ⚠️  Bot token bulunamadı! Lütfen şifreli config dosyasına token ekleyin'.yellow);
                console.log('[HENZY DB] 📝 Config yönetimi için /config-setup komutunu kullanın'.cyan);
                return;
            }
            
            await this.client.login(config.bots.database.token);
        } catch (error) {
            console.error('[HENZY DB] Startup error:', error);
        }
    }
}

const henzyDatabase = new HenzyDatabase();
henzyDatabase.start();

module.exports = HenzyDatabase;
