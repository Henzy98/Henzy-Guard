const readline = require('readline');
const colors = require('colors');
const HenzyEncryption = require('./utils/encryption');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function decryptConfig() {
    console.log('🔓 Henzy Guard - Config Çözme'.cyan);
    console.log('═══════════════════════════════════'.cyan);
    
    const encryptedPath = path.join(__dirname, 'data', 'config.enc');
    const outputPath = path.join(__dirname, 'data', 'config-decrypted.json');
    
    if (!fs.existsSync(encryptedPath)) {
        console.log('❌ Şifreli config dosyası bulunamadı!'.red);
        console.log(`📁 Aranan konum: ${encryptedPath}`.yellow);
        process.exit(1);
    }
    
    rl.question('Master Key girin: ', async (masterKey) => {
        if (!masterKey || masterKey.trim() === '') {
            console.log('❌ Master key boş olamaz!'.red);
            process.exit(1);
        }
        
        try {
            console.log('🔓 Config dosyası çözülüyor...'.yellow);
            
            const encryption = new HenzyEncryption();
            const decryptedConfig = encryption.loadEncryptedConfig(encryptedPath, masterKey.trim());
            fs.writeFileSync(outputPath, JSON.stringify(decryptedConfig, null, 2));
            
            console.log('✅ Config başarıyla çözüldü!'.green);
            console.log(`📄 Çözülen dosya: ${outputPath}`.cyan);
            console.log('');
            console.log('📋 Config İçeriği:'.yellow);
            console.log('═══════════════════'.yellow);
            const safeConfig = JSON.parse(JSON.stringify(decryptedConfig));
            Object.keys(safeConfig.bots).forEach(botName => {
                if (safeConfig.bots[botName].token) {
                    const token = safeConfig.bots[botName].token;
                    safeConfig.bots[botName].token = token.substring(0, 8) + '...' + token.substring(token.length - 8);
                }
            });
            
            console.log(JSON.stringify(safeConfig, null, 2));
            
        } catch (error) {
            console.log('❌ Config çözülemedi! Yanlış master key veya bozuk dosya.'.red);
            console.error('Hata detayı:', error.message);
        }
        
        rl.close();
    });
}

decryptConfig();
