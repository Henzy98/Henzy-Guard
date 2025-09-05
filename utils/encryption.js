const crypto = require('crypto');
const fs = require('fs');

class HenzyEncryption {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.keyLength = 32;
        this.ivLength = 16;
        this.saltLength = 32;
    }

    deriveKey(masterKey, salt) {
        return crypto.pbkdf2Sync(masterKey, salt, 100000, this.keyLength, 'sha512');
    }

    loadEncryptedConfig(filePath, masterKey) {
        const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const salt = Buffer.from(encryptedData.salt, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const key = this.deriveKey(masterKey, salt);
        
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    saveEncryptedConfig(config, masterKey, filePath) {
        const salt = crypto.randomBytes(this.saltLength);
        const iv = crypto.randomBytes(this.ivLength);
        const key = this.deriveKey(masterKey, salt);
        
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        
        let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const encryptedData = {
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            data: encrypted
        };
        
        fs.writeFileSync(filePath, JSON.stringify(encryptedData, null, 2));
        return true;
    }

    encryptForMemory(config, masterKey) {
        const salt = crypto.randomBytes(this.saltLength);
        const iv = crypto.randomBytes(this.ivLength);
        const key = this.deriveKey(masterKey, salt);
        
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        
        let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            data: encrypted
        };
    }

    decryptFromMemory(encryptedData, masterKey) {
        const salt = Buffer.from(encryptedData.salt, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const key = this.deriveKey(masterKey, salt);
        
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }
}

module.exports = HenzyEncryption;
