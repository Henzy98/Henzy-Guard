const fs = require('fs');
const path = require('path');
const colors = require('colors');

class SimpleConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'data', 'config.json');
        this.dataDir = path.join(__dirname, '..', 'data');
        this.config = null;
        
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error('Config dosyası bulunamadı! Önce simple-setup.js çalıştırın.');
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            
            console.log(`[CONFIG] Config başarıyla yüklendi!`.green);
            return true;
        } catch (error) {
            console.log(`[CONFIG] Config yükleme hatası: ${error.message}`.red);
            return false;
        }
    }

    getBotToken(botName) {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        return this.config.bots[botName]?.token || null;
    }

    getDatabaseURI() {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        console.log(`[DEBUG] Config database:`, this.config.database);
        console.log(`[DEBUG] URI:`, this.config.database?.uri);
        return this.config.database?.uri;
    }

    getGuildSettings() {
        if (!this.config) {
            throw new Error('Config yüklenmemiş!');
        }
        return this.config.guild;
    }

    configExists() {
        return fs.existsSync(this.configPath);
    }

    getConfig() {
        return this.config;
    }
}

module.exports = new SimpleConfigManager();
