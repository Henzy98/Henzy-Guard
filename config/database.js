const mongoose = require('mongoose');
const colors = require('colors');

class Database {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        try {
            const configManager = require('./configManager');
            const config = await configManager.getConfig();
            if (!config) {
                throw new Error('Config yüklenemedi!');
            }
            const mongoUri = config.database.uri;
            
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 5000,
                maxPoolSize: 10,
                minPoolSize: 2
            });
            
            this.isConnected = true;
            console.log(`[DATABASE] MongoDB bağlantısı başarılı!`.green);
            
            mongoose.connection.on('disconnected', () => {
                console.log(`[DATABASE] MongoDB bağlantısı kesildi!`.red);
                this.isConnected = false;
            });

            mongoose.connection.on('error', (err) => {
                console.log(`[DATABASE] MongoDB hatası: ${err}`.red);
            });

        } catch (error) {
            console.log(`[DATABASE] MongoDB bağlantı hatası: ${error}`.red);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.isConnected) {
            await mongoose.disconnect();
            console.log(`[DATABASE] MongoDB bağlantısı kapatıldı.`.yellow);
        }
    }

    getStatus() {
        return this.isConnected;
    }
}

module.exports = new Database();
