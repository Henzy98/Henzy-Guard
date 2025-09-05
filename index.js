const colors = require('colors');
const configManager = require('./config/configManager');
const { spawn } = require('child_process');
const readline = require('readline');

class HenzyGuardManager {
    constructor() {
        this.processes = new Map();
        this.isRunning = false;
    }

    async start() {
        console.log('🛡️  Henzy Guard System Manager'.cyan.bold);
        console.log('================================='.cyan);

        try {
            if (!configManager.configExists()) {
                console.log('❌ Config dosyası bulunamadı!'.red);
                console.log('📝 Lütfen önce kurulum yapın: npm run setup'.yellow);
                process.exit(1);
            }

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const masterPassword = await new Promise((resolve) => {
                rl.question('Master Password: ', (password) => {
                    rl.close();
                    resolve(password);
                });
            });

            const loaded = await configManager.loadConfig(masterPassword);
            if (!loaded) {
                console.log('❌ Config yüklenemedi! Geçersiz master password.'.red);
                process.exit(1);
            }

            console.log('✅ Config başarıyla yüklendi!'.green);
            
            await this.showMenu();

        } catch (error) {
            console.log(`❌ Başlatma hatası: ${error.message}`.red);
            process.exit(1);
        }
    }

    async showMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        while (true) {
            console.log('\n🤖 Bot Yönetim Menüsü:'.cyan);
            console.log('1. Tüm botları başlat');
            console.log('2. Database Bot başlat');
            console.log('3. Guard Bot 1 başlat (Kanal & Rol)');
            console.log('4. Guard Bot 2 başlat (Ban & Kick)');
            console.log('5. Guard Bot 3 başlat (URL & Link)');
            console.log('6. Guard Bot 4 başlat (Emoji & Sticker)');
            console.log('7. Çalışan botları görüntüle');
            console.log('8. Tüm botları durdur');
            console.log('9. Config durumunu görüntüle');
            console.log('0. Çıkış');

            const choice = await new Promise((resolve) => {
                rl.question('\nSeçiminiz (0-9): ', resolve);
            });

            switch (choice) {
                case '1':
                    await this.startAllBots();
                    break;
                case '2':
                    await this.startBot('database', 'Database Bot');
                    break;
                case '3':
                    await this.startBot('guard1', 'Guard Bot 1 (Kanal & Rol)');
                    break;
                case '4':
                    await this.startBot('guard2', 'Guard Bot 2 (Ban & Kick)');
                    break;
                case '5':
                    await this.startBot('guard3', 'Guard Bot 3 (URL & Link)');
                    break;
                case '6':
                    await this.startBot('guard4', 'Guard Bot 4 (Emoji & Sticker)');
                    break;
                case '7':
                    this.showRunningBots();
                    break;
                case '8':
                    await this.stopAllBots();
                    break;
                case '9':
                    this.showConfigStatus();
                    break;
                case '0':
                    console.log('👋 Henzy Guard System kapatılıyor...'.yellow);
                    await this.stopAllBots();
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log('❌ Geçersiz seçim!'.red);
            }
        }
    }

    async startBot(botName, displayName) {
        try {
            if (this.processes.has(botName)) {
                console.log(`⚠️  ${displayName} zaten çalışıyor!`.yellow);
                return;
            }

            console.log(`🚀 ${displayName} başlatılıyor...`.green);

            const process = spawn('node', [`bots/${botName}.js`], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
            });

            const masterPassword = await this.getMasterPassword();
            process.stdin.write(masterPassword + '\n');

            process.stdout.on('data', (data) => {
                console.log(`[${botName.toUpperCase()}] ${data.toString().trim()}`.cyan);
            });

            process.stderr.on('data', (data) => {
                console.log(`[${botName.toUpperCase()}] ERROR: ${data.toString().trim()}`.red);
            });

            process.on('close', (code) => {
                console.log(`[${botName.toUpperCase()}] Process exited with code ${code}`.yellow);
                this.processes.delete(botName);
            });

            this.processes.set(botName, {
                process: process,
                name: displayName,
                startTime: new Date()
            });

            console.log(`✅ ${displayName} başlatıldı!`.green);

        } catch (error) {
            console.log(`❌ ${displayName} başlatılamadı: ${error.message}`.red);
        }
    }

    async startAllBots() {
        console.log('🚀 Tüm botlar başlatılıyor...'.green);
        
        const bots = [
            ['database', 'Database Bot'],
            ['guard1', 'Guard Bot 1 (Kanal & Rol)'],
            ['guard2', 'Guard Bot 2 (Ban & Kick)'],
            ['guard3', 'Guard Bot 3 (URL & Link)'],
            ['guard4', 'Guard Bot 4 (Emoji & Sticker)']
        ];

        for (const [botName, displayName] of bots) {
            await this.startBot(botName, displayName);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('✅ Tüm botlar başlatıldı!'.green);
    }

    showRunningBots() {
        console.log('\n🤖 Çalışan Botlar:'.cyan);
        
        if (this.processes.size === 0) {
            console.log('📭 Hiç bot çalışmıyor.'.yellow);
            return;
        }

        for (const [botName, botInfo] of this.processes) {
            const uptime = Math.floor((Date.now() - botInfo.startTime.getTime()) / 1000);
            const uptimeStr = this.formatUptime(uptime);
            console.log(`✅ ${botInfo.name} - Çalışma süresi: ${uptimeStr}`.green);
        }
    }

    async stopAllBots() {
        console.log('🛑 Tüm botlar durduruluyor...'.yellow);

        for (const [botName, botInfo] of this.processes) {
            try {
                botInfo.process.kill('SIGTERM');
                console.log(`🛑 ${botInfo.name} durduruldu.`.yellow);
            } catch (error) {
                console.log(`❌ ${botInfo.name} durdurulamadı: ${error.message}`.red);
            }
        }

        this.processes.clear();
        console.log('✅ Tüm botlar durduruldu.'.green);
    }

    showConfigStatus() {
        console.log('\n⚙️  Config Durumu:'.cyan);
        
        try {
            const safeConfig = configManager.getConfigSafe();
            if (!safeConfig) {
                console.log('❌ Config yüklenmemiş!'.red);
                return;
            }

            console.log(`📅 Son güncelleme: ${new Date(safeConfig.security.lastUpdated).toLocaleString('tr-TR')}`.white);
            console.log(`🔐 Şifreleme: ${safeConfig.security.encryptionEnabled ? '✅ Aktif' : '❌ Deaktif'}`.white);
            console.log(`🗄️  Database: ${safeConfig.database.uri}`.white);
            
            console.log('\n🤖 Bot Durumları:'.cyan);
            for (const [botName, botConfig] of Object.entries(safeConfig.bots)) {
                const status = botConfig.enabled ? '✅ Aktif' : '❌ Deaktif';
                const token = botConfig.token ? '🔑 Token var' : '❌ Token yok';
                console.log(`  ${botConfig.name || botName}: ${status} - ${token}`.white);
            }

        } catch (error) {
            console.log(`❌ Config durumu alınamadı: ${error.message}`.red);
        }
    }

    async getMasterPassword() {
        return process.env.MASTER_PASSWORD || 'henzy123';
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}s ${minutes}d ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}d ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

if (require.main === module) {
    const manager = new HenzyGuardManager();
    manager.start().catch(console.error);
}

module.exports = HenzyGuardManager;
