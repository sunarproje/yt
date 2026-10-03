# Beleş TiVi — YouTube canlı yayın listeleri

## Kullanım

`channels.json` dosyasındaki `url` alanına YouTube canlı yayın bağlantısını yazın. Kanalın `id` değeri aynı kaldığı sürece çıktı adresi değişmez. Kanal adı için `name` alanını düzenleyebilirsiniz.

```json
[
  {"id":"akit","name":"Akit TV","url":"https://www.youtube.com/watch?v=U3PGGfxCioI"},
  {"id":"kanal2","name":"İkinci Kanal","url":"https://www.youtube.com/@KANAL/live"}
]
```

İkinci satır örnektir; gerçek yayın bağlantısıyla değiştirin. Birden fazla kanal eklenebilir. ID yalnızca küçük harf, rakam ve tire içermeli ve benzersiz olmalıdır. Normal video yerine o anda canlı olan, erişilebilir yayın gerekir. Her YouTube yayınının açılması garanti değildir.

## Bilgisayarda deneme

Node 22+ ve Python 3.12 gerekir. Bu bilgisayarda mevcut Codex Python kurulumu otomatik bulunur.

```powershell
cd C:\Users\mehmet\Documents\Codex\2026-09-28\an\outputs\youtube-live
powershell -ExecutionPolicy Bypass -File .\yenile.ps1
```

`streams/akit.m3u8` dosyasını VLC'de açın. `streams/channels.m3u` tüm başarılı kanalları birleştirir; M3U8 dosyalarıyla aynı klasörde tutulmalıdır. Yenileme komutu sadece bir kez çalışır; bilgisayarda arka plan görevi kurulmaz.

## GitHub otomasyonu

1. Kendi hesabınızda `belestivi-live` isimli boş bir depo oluşturun.
2. Bu klasörün dosyalarını depo köküne yükleyin. `.github/workflows/update.yml` dahil olmalıdır. ZIP dosyasını tek başına yüklemek kodları açmaz.
3. Actions etkin olmalı ve iş akışının depoya yazma izni bulunmalıdır.
4. Actions → Refresh authorised live streams → Run workflow ile çalıştırın.
5. Sonraki sefer sadece `channels.json` bağlantısını değiştirip kaydedin. Bu değişiklik otomatik yenileme başlatır. Ayrıca her saat 17. dakikada yenileme planlanır; GitHub zamanlaması gecikebilir.

Depo `sunarproje/belestivi-live`, dal `main` olursa Akit adresi:
`https://raw.githubusercontent.com/sunarproje/belestivi-live/main/streams/akit.m3u8`

Bu adres ancak depo oluşturulup otomasyon başarıyla çalıştıktan sonra kullanılabilir. Herkese açık depoda URL'ler ve geçmişi herkese açık olur; geçici Google URL'leri çözücünün IP adresini de içerebilir. Özel depo normal oynatıcılardan anonim açılamaz.

## Doğrulama ve sınırlar

yt-dlp 2026.8.19 sürümü sabitlendi. Ayrı ses ve görüntü HLS akışları tek master M3U8 içinde birleştirilir; birleşik HLS formatı da desteklenir. Her iki akışın son üç medya parçası kontrol edilir. En az 90 dakika geçerlilik aranır. Başarısız veya listeden çıkarılan kanalların M3U8 dosyaları silinir; diğer kanallar işlenmeye devam eder. Sonuçlar `streams/status.json` dosyasında yer alır.

Akit örneğinin ayrı ses/görüntü listesi kullanıcı tarafından VLC'de açıldı. Yeni üretici yerel ağdan medya erişim kontrolünü geçti. GitHub Actions ağından çıkarım henüz denenmedi; Google farklı ağlarda bot kontrolü veya erişim kısıtlaması uygulayabilir. GitHub Actions başarısı da her cihaz/ağda oynatma garantisi değildir. Çerez veya üçüncü taraf çözümleme hizmeti kullanılmaz.

Bağlantılar geçicidir. Güncelleme çalışmazsa veya oynatıcı eski bağlantıyı bellekte tutarsa listeyi yeniden açmak gerekebilir. Videolar GitHub'dan sunulmaz; medya Google sunucularından gelir.

Test: `node test.mjs`
