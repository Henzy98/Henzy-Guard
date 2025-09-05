# 🛡️ Henzy Guard System

MongoDB tabanlı çoklu Discord guard bot sistemi. Sunucunuzu çeşitli tehditlere karşı korumak için 6 ayrı bot kullanır.

## 🤖 Bot Yapısı

- **Database Bot**: Merkezi veritabanı yönetimi ve slash komut sistemi
- **Guard Bot 1**: Kanal ve rol silme/oluşturma koruması
- **Guard Bot 2**: Ban, kick ve timeout koruması
- **Guard Bot 3**: URL, link ve davet koruması
- **Guard Bot 4**: Emoji, sticker, webhook ve sunucu ayarları koruması
- **Moderation Bot**: Moderasyon komutları ve kullanıcı yönetimi

## 🔐 Güvenlik Özellikleri

- **Şifreli Config**: Tüm bot token'ları AES-256-CBC ile şifrelenir
- **Master Key Koruması**: PM2 ile direkt başlatma engellenir
- **Whitelist Sistemi**: Güvenilir kullanıcılar için izin sistemi
- **Aksiyon Limitleri**: Hızlı işlem yapanlara otomatik ceza
- **Detaylı Loglama**: Tüm guard aktiviteleri MongoDB'de saklanır

## 📦 Kurulum

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. MongoDB Kurulumu
MongoDB'yi yerel olarak kurun veya MongoDB Atlas kullanın.

### 3. Config Oluşturma ve Botları Başlatma

⚠️ **ÖNEMLİ**: Botlar sadece şifreli config sistemi ile başlatılabilir!

```bash
node sifrele.js
```

Bu komut:
- İlk çalıştırmada config oluşturacak ve şunları soracak:
  - Sunucu ID (Guild ID)
  - Sunucu Sahibi ID (Owner ID) 
  - Log Kanalı ID
  - MongoDB URI
  - 6 bot token'ı (database, guard1, guard2, guard3, guard4, moderation)
  - Master Key (şifreleme için)
- Config'i şifreleyecek
- PM2 ile tüm botları otomatik başlatacak

### 4. Sonraki Başlatmalar

Config oluşturulduktan sonra botları başlatmak için:

```bash
node sifrele.js
```

Master key'i girip botları başlatın.

## 🚨 GÜVENLİK UYARISI

⚠️ **Şifreli config sistemi aktif - Bu yöntemle başlatmazsanız çalışmaz!**

✅ **Tek geçerli başlatma yöntemi:**
```bash
node sifrele.js  # Master key ile güvenli başlatma
```

## 🎛️ Database Bot Slash Komutları

### Guard Panel Yönetimi
```
/guard-panel status          # Guard botlarının durumunu göster
/guard-panel start           # Tüm guard botlarını başlat
/guard-panel stop            # Tüm guard botlarını durdur
/guard-panel restart         # Tüm guard botlarını yeniden başlat
```

### Whitelist Yönetimi
```
/whitelist add @user         # Kullanıcıyı whitelist'e ekle
/whitelist remove @user      # Kullanıcıyı whitelist'ten çıkar
/whitelist list              # Whitelist'i görüntüle
```

### Guard Ayarları
```
/guard-settings view         # Mevcut guard ayarlarını göster
/guard-settings toggle       # Guard'ı aç/kapat (kanal, rol, ban, kick, url, emoji, sticker, anti-raid, spam)
```

### Yardım
```
/help                        # Tüm komutları göster
```

## 🛡️ Guard Türleri

### Guard Bot 1 - Kanal & Rol
- Kanal silme/oluşturma koruması
- Rol silme/oluşturma koruması
- Rol izin değişikliği koruması
- Otomatik geri oluşturma

### Guard Bot 2 - Ban & Kick
- Ban koruması (otomatik unban)
- Kick koruması
- Timeout koruması (otomatik kaldırma)
- Hızlı işlem tespiti

### Guard Bot 3 - URL & Link
- URL/Link silme
- Discord davet linki engelleme
- IP adresi engelleme
- Şüpheli link tespiti
- Spam link koruması

### Guard Bot 4 - Emoji & Sticker
- Emoji oluşturma/silme koruması
- Sticker oluşturma/silme koruması
- Webhook koruması
- Sunucu ayarları koruması
- Integration koruması

## ⚙️ Yapılandırma

### Guard Limitleri
Varsayılan limitler (10 saniye içinde):
- Kanal işlemleri: 3
- Rol işlemleri: 3
- Ban işlemleri: 2
- Kick işlemleri: 3

### Ceza Türleri
- `ban`: Kullanıcıyı sunucudan yasakla
- `kick`: Kullanıcıyı sunucudan at
- `timeout`: Kullanıcıya 10 dakika timeout ver

## 🗄️ Veritabanı Yapısı

### Collections
- `guilds`: Sunucu ayarları ve guard konfigürasyonları
- `whitelists`: Güvenilir kullanıcı listesi
- `guardlogs`: Tüm guard aktivite logları

## 🔧 Geliştirme

### Yeni Guard Ekleme
1. `bots/` klasöründe yeni bot dosyası oluştur
2. `package.json`'a script ekle
3. `configManager.js`'e bot konfigürasyonu ekle
4. `setup.js`'e token girişi ekle

### Config Sistemi
Tüm hassas veriler şifreli olarak saklanır:
```javascript
const configManager = require('./config/configManager');
await configManager.loadConfig(masterPassword);
const token = configManager.getBotToken('botName');
```

## 📋 Gereksinimler

- Node.js 16+
- MongoDB 4.4+
- Discord.js 14+
- 5 ayrı Discord bot uygulaması

## 🔧 Ek Araçlar

### Config Çözme
Şifreli config'i görüntülemek için:
```bash
node coz.js
```
Master key girip config içeriğini görebilirsiniz.

## 🚨 Önemli Notlar

- **Her bot için ayrı token gereklidir**
- **Master key'i güvenli bir yerde saklayın**
- **Botlar SADECE `node sifrele.js` ile başlatılabilir**
- **PM2 ile direkt başlatma güvenlik sistemi tarafından engellenir**
- Botlara gerekli izinleri verin:
  - Manage Channels
  - Manage Roles  
  - Ban Members
  - Kick Members
  - Manage Messages
  - View Audit Log
  - Administrator (önerilen)

## 📞 Destek

Herhangi bir sorun yaşarsanız:
1. `node sifrele.js` ile başlattığınızdan emin olun
2. Master key'in doğru olduğunu kontrol edin
3. MongoDB bağlantısını doğrulayın
4. Bot izinlerini kontrol edin
5. PM2 loglarını kontrol edin: `pm2 logs`

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

---

**⚠️ Uyarı**: Bu sistem güçlü koruma sağlar ancak doğru yapılandırılması gerekir. Test sunucusunda denedikten sonra ana sunucunuzda kullanın.
