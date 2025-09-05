const encryption = require('../utils/encryption');
const path = require('path');
const fs = require('fs');
const colors = require('colors');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'data', 'config.enc');
        this.dataDir = path.join(__dirname, '..', 'data');
        this.config = null;
        
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    async loadEncryptedConfig(masterKey) {
        try {
            if (fs.existsSync(this.configPath) && masterKey) {
                const encryptionInstance = new encryption();
                this.config = encryptionInstance.loadEncryptedConfig(this.configPath, masterKey);
                console.log('[CONFIG] Encrypted config başarıyla yüklendi'.green);
                return true;
            } else {
                console.log('[CONFIG] Encrypted config bulunamadı veya master key yok'.yellow);
                return false;
            }
        } catch (error) {
            console.log(`[CONFIG] Encrypted config yükleme hatası: ${error.message}`.red);
            return false;
        }
    }

    async initializeConfig() {
        try {
            const defaultConfig = {
                bots: {
                    database: {
                        token: '',
                        enabled: true
                    },
                    guard1: {
                        token: '',
                        enabled: true,
                        name: 'Kanal & Rol Guard'
                    },
                    guard2: {
                        token: '',
                        enabled: true,
                        name: 'Ban & Kick Guard'
                    },
                    guard3: {
                        token: '',
                        enabled: true,
                        name: 'URL & Link Guard'
                    },
                    guard4: {
                        token: '',
                        enabled: true,
                        name: 'Emoji & Sticker Guard'
                    }
                },
                database: {
                    uri: 'mongodb://localhost:27017/henzy_guard',
                    options: {
                        useNewUrlParser: true,
                        useUnifiedTopology: true
                    }
                },
                guild: {
                    id: '',
                    ownerId: '',
                    logChannelId: '',
                    guardLogChannelId: ''
                },
                security: {
                    encryptionEnabled: true,
                    lastUpdated: new Date().toISOString()
                }
            };

            const saved = encryption.saveEncryptedConfig(defaultConfig, this.masterKey, this.configPath);
            if (saved) {
                encryption.saveMasterKeyHash(this.masterKey, this.keyHashPath);
                this.config = defaultConfig;
                console.log(`[CONFIG] Şifreli config başarıyla oluşturuldu!`.green);
                return true;
            }
            return false;
        } catch (error) {
            console.log(`[CONFIG] İlk kurulum hatası: ${error.message}`.red);
            return false;
        }
    }

    async loadConfig(masterPassword) {
        try {
            this.masterKey = Buffer.from(masterPassword, 'utf8');
            
            if (!encryption.verifyMasterKey(this.masterKey, this.keyHashPath)) {
                throw new Error('Geçersiz master password!');
            }

            this.config = encryption.loadEncryptedConfig(this.masterKey, this.configPath);
            if (!this.config) {
                throw new Error('Config dosyası çözülemedi!');
            }

            console.log(`[CONFIG] Şifreli config başarıyla yüklendi!`.green);
            return true;
        } catch (error) {
            console.log(`[CONFIG] Config yükleme hatası: ${error.message}`.red);
            return false;
        }
    }

    async updateConfig(updates) {
        try {
            if (!this.config || !this.masterKey) {
                throw new Error('Config yüklenmemiş!');
            }

            this.config = { ...this.config, ...updates };
            this.config.security.lastUpdated = new Date().toISOString();

            const saved = encryption.saveEncryptedConfig(this.config, this.masterKey, this.configPath);
            if (saved) {
                console.log(`[CONFIG] Config başarıyla güncellendi!`.green);
                return true;
            }
            return false;
        } catch (error) {
            console.log(`[CONFIG] Config güncelleme hatası: ${error.message}`.red);
            return false;
        }
    }

    getBotToken(botName) {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        return this.config.bots[botName]?.token || null;
    }

    async setBotToken(botName, token) {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }

        if (!this.config.bots[botName]) {
            throw new Error(`Bilinmeyen bot: ${botName}`);
        }

        this.config.bots[botName].token = token;
        return await this.updateConfig(this.config);
    }

    getDatabaseURI() {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        return this.config.database.uri;
    }

    getGuildSettings() {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        return this.config.guild;
    }

    configExists() {
        return fs.existsSync(this.configPath) && fs.existsSync(this.keyHashPath);
    }

    getConfigSafe() {
        if (!this.config) {
            return null;
        }

        const safeConfig = JSON.parse(JSON.stringify(this.config));
        
        Object.keys(safeConfig.bots).forEach(botName => {
            if (safeConfig.bots[botName].token) {
                const token = safeConfig.bots[botName].token;
                safeConfig.bots[botName].token = token.substring(0, 8) + '...' + token.substring(token.length - 8);
            }
        });

        return safeConfig;
    }

    async getConfig() {
        if (!this.config) {
            // Environment variable'dan config'i kontrol et
            if (process.env.HENZY_CONFIG) {
                try {
                    const configData = Buffer.from(process.env.HENZY_CONFIG, 'base64').toString('utf8');
                    this.config = JSON.parse(configData);
                    return this.config;
                } catch (error) {
                    console.log('[CONFIG] Environment config parse hatası'.red);
                }
            }
            
            const encryptedPath = path.join(__dirname, '..', 'data', 'config.enc');
            if (fs.existsSync(encryptedPath)) {
                console.log('[CONFIG] Şifreli config bulundu, master key gerekli!'.yellow);
                console.log('[CONFIG] Lütfen sifrele.js ile config dosyasını çözün'.cyan);
                return null;
            }
            
            console.log('[CONFIG] Config yüklenmemiş, varsayılan config oluşturuluyor...'.yellow);
            return {
                bots: {
                    database: { token: '', enabled: true },
                    guard1: { token: '', enabled: true },
                    guard2: { token: '', enabled: true },
                    guard3: { token: '', enabled: true },
                    guard4: { token: '', enabled: true },
                    moderation: { token: '', enabled: true }
                },
                database: {
                    uri: 'mongodb://localhost:27017/henzy_guard'
                },
                guild: {
                    id: '',
                    ownerId: ''
                }
            };
        }
        
        return this.config;
    }

    async loadEncryptedConfig(masterKey) {
        try {
            const HenzyEncryption = require('../utils/encryption');
            const encryption = new HenzyEncryption();
            const encryptedPath = path.join(__dirname, '..', 'data', 'config.enc');
            
            if (!fs.existsSync(encryptedPath)) {
                console.log('[CONFIG] Şifreli config dosyası bulunamadı'.red);
                return false;
            }
            
            this.config = encryption.loadEncryptedConfig(encryptedPath, masterKey);
            console.log('[CONFIG] Şifreli config başarıyla yüklendi'.green);
            return true;
        } catch (error) {
            console.error('[CONFIG] Şifreli config yükleme hatası:', error.message);
            return false;
        }
    }

    async resetConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                fs.unlinkSync(this.configPath);
            }
            if (fs.existsSync(this.keyHashPath)) {
                fs.unlinkSync(this.keyHashPath);
            }
            
            this.config = null;
            this.masterKey = null;
            
            console.log(`[CONFIG] Config sıfırlandı!`.yellow);
            return true;
        } catch (error) {
            console.log(`[CONFIG] Config sıfırlama hatası: ${error.message}`.red);
            return false;
        }
    }
}

module.exports = new ConfigManager();
