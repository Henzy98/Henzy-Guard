const readline = require('readline');
const colors = require('colors');
const configManager = require('./config/configManager');
const HenzyEncryption = require('./utils/encryption');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function startWithEncryption() {
    console.log('🔐 Henzy Guard - Şifreli Başlatma'.cyan);
    console.log('═══════════════════════════════════'.cyan);
    const encryptedPath = path.join(__dirname, 'data', 'config.enc');
    if (!fs.existsSync(encryptedPath)) {
        console.log('❌ Şifreli config dosyası bulunamadı!'.red);
        console.log('💡 Yeni config oluşturalım...'.cyan);
        console.log('');
        
        await createNewConfig();
        return;
    }
    
    rl.question('Master Key girin: ', async (masterKey) => {
        if (!masterKey || masterKey.trim() === '') {
            console.log('❌ Master key boş olamaz!'.red);
            process.exit(1);
        }
        
        console.log('🔓 Config dosyası çözülüyor...'.yellow);
        
        const success = await configManager.loadEncryptedConfig(masterKey.trim());
        if (!success) {
            console.log('❌ Config dosyası çözülemedi! Yanlış master key.'.red);
            process.exit(1);
        }
        
        // Config'i environment variable olarak ayarla
        const config = await configManager.getConfig();
        process.env.HENZY_CONFIG = Buffer.from(JSON.stringify(config)).toString('base64');
        
        console.log('✅ Config başarıyla yüklendi!'.green);
        console.log('🚀 Botlar başlatılabilir...'.cyan);
        
        rl.close();
        const { exec } = require('child_process');
        
        console.log('🔄 PM2 ile botlar başlatılıyor...'.yellow);
        exec('pm2 start ecosystem.config.js', (error, stdout, stderr) => {
            if (error) {
                console.error('❌ PM2 başlatma hatası:', error);
                return;
            }
            console.log('✅ Tüm botlar başlatıldı!'.green);
            console.log(stdout);
        });
    });
}

async function createNewConfig() {
    console.log('🔧 Config Oluşturucu'.cyan);
    console.log('═══════════════════'.cyan);
    console.log('');
    
    const config = {
        bots: {
            database: { token: '', enabled: true },
            guard1: { token: '', enabled: true },
            guard2: { token: '', enabled: true },
            guard3: { token: '', enabled: true },
            guard4: { token: '', enabled: true },
            moderation: { token: '', enabled: true }
        },
        database: {
            uri: ''
        },
        guild: {
            id: '',
            ownerId: '',
            consoleLogChannelId: ''
        },
        guards: {
            channelGuard: true,
            roleGuard: true,
            banGuard: true,
            kickGuard: true,
            urlGuard: true,
            emojiGuard: true,
            stickerGuard: true,
            antiRaid: true,
            spamGuard: true
        }
    };

    console.log('📝 Tüm gerekli bilgileri doldurun:');
    console.log('');

    console.log('🏰 SUNUCU BİLGİLERİ (Zorunlu)'.yellow);
    console.log('───────────────────────────────'.yellow);
    console.log('💡 Sunucu ID\'sini almak için: Sunucuya sağ tık > Sunucu ID\'sini Kopyala'.cyan);
    console.log('');
    
    await new Promise((resolve) => {
        const askGuildId = () => {
            rl.question('🏰 Sunucu ID (Guild ID - zorunlu): ', (guildId) => {
                if (!guildId.trim()) {
                    console.log('❌ Sunucu ID boş olamaz!'.red);
                    askGuildId();
                } else {
                    config.guild.id = guildId.trim();
                    resolve();
                }
            });
        };
        askGuildId();
    });

    await new Promise((resolve) => {
        const askOwnerId = () => {
            rl.question('👑 Sunucu Sahibi ID (Owner ID - zorunlu): ', (ownerId) => {
                if (!ownerId.trim()) {
                    console.log('❌ Sunucu Sahibi ID boş olamaz!'.red);
                    askOwnerId();
                } else {
                    config.guild.ownerId = ownerId.trim();
                    resolve();
                }
            });
        };
        askOwnerId();
    });

    await new Promise((resolve) => {
        rl.question('📢 Log Kanalı ID (Console Log Channel ID - zorunlu): ', (channelId) => {
            if (channelId.trim()) {
                config.guild.consoleLogChannelId = channelId.trim();
            }
            resolve();
        });
    });

    console.log('');
    console.log('🗄️ VERİTABANI AYARLARI'.yellow);
    console.log('───────────────────────────────'.yellow);

    await new Promise((resolve) => {
        const askMongoUri = () => {
            rl.question('🗄️ MongoDB URI (zorunlu): ', (uri) => {
                if (!uri.trim()) {
                    console.log('❌ MongoDB URI boş olamaz!'.red);
                    askMongoUri();
                } else {
                    config.database.uri = uri.trim();
                    resolve();
                }
            });
        };
        askMongoUri();
    });

    console.log('');
    console.log('🤖 BOT TOKENLARI (Tüm botlar zorunlu)'.yellow);
    console.log('───────────────────────────────'.yellow);

    const botNames = ['database', 'guard1', 'guard2', 'guard3', 'guard4', 'moderation'];
    
    for (const botName of botNames) {
        await new Promise((resolve) => {
            const askToken = () => {
                rl.question(`🤖 ${botName.toUpperCase()} bot token (zorunlu): `, (token) => {
                    if (!token.trim()) {
                        console.log(`❌ ${botName.toUpperCase()} bot token boş olamaz!`.red);
                        askToken();
                    } else {
                        config.bots[botName].token = token.trim();
                        resolve();
                    }
                });
            };
            askToken();
        });
    }

    console.log('');

    console.log('');
    console.log('🔐 Master key oluşturun:');
    
    await new Promise((resolve) => {
        rl.question('Master Key: ', async (masterKey) => {
            if (!masterKey || masterKey.trim() === '') {
                console.log('❌ Master key boş olamaz!'.red);
                process.exit(1);
            }

            try {
                console.log('');
                console.log('🔒 Config şifreleniyor...'.yellow);
                
                const encryption = new HenzyEncryption();
                const encryptedPath = path.join(__dirname, 'data', 'config.enc');
                const dataDir = path.join(__dirname, 'data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                
                encryption.saveEncryptedConfig(config, masterKey.trim(), encryptedPath);
                
                console.log('✅ Config başarıyla şifrelendi!'.green);
                console.log('');
                console.log('🚀 Şimdi botları başlatalım...'.cyan);
                await configManager.loadEncryptedConfig(masterKey.trim());
                
                const config = await configManager.getConfig();
                process.env.HENZY_CONFIG = Buffer.from(JSON.stringify(config)).toString('base64');
                
                const { exec } = require('child_process');
                console.log('🔄 PM2 ile botlar başlatılıyor...'.yellow);
                exec('pm2 start ecosystem.config.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ PM2 başlatma hatası:', error);
                        return;
                    }
                    console.log('✅ Tüm botlar başlatıldı!'.green);
                    console.log(stdout);
                });
                
            } catch (error) {
                console.error('❌ Şifreleme hatası:', error.message);
            }
            
            resolve();
        });
    });

    rl.close();
}

startWithEncryption();
