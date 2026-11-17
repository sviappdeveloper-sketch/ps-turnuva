# Turnuva Fikstürü

Arkadaşlarla oynanan futbol turnuvaları için fikstür, skor, kart ve puan durumu uygulaması.
Tek sayfalık web uygulaması (`public/index.html`), iPhone'da internetsiz çalışan bir kabuğun (`ios/`) içinde.

```
public/          ← uygulamanın kendisi (iPhone paketine kopyalanır)
ios/             ← iPhone kabuğu (XcodeGen: project.yml, Config.xcconfig)
site/            ← gizlilik / destek sayfaları (GitHub Pages)
app-store/       ← mağaza metinleri (metadata.json) ve ekran görüntüleri
tool/            ← imza ve App Store Connect betikleri (Codemagic çalıştırır)
codemagic.yaml   ← derleme, yükleme, mağaza sayfası, incelemeye gönderme (Codemagic)
.github/workflows/appstore.yml ← aynısı GitHub Actions ile (ücretsiz; secret: ASC_KEY_P8, elle başlatılır)
```

## App Store'a yükleme

1. **GitHub Pages'i aç** (bir kez): depo → Settings → Pages → Source: **GitHub Actions**. Sonra Actions → "Web sayfaları" → Run workflow. Gizlilik adresi: https://sviappdeveloper-sketch.github.io/ps-turnuva/gizlilik.html
2. **Codemagic'e ekle**: Codemagic → Add application → GitHub → `ps-turnuva` → codemagic.yaml.
   - Environment variables → grup adı **`asc`**: `ASC_KEY_P8` = Top Potada'da kullandığın App Store Connect anahtarının (`9PJ9V3965R`) .p8 dosyasının tamamı, **Secure** işaretli.
   - Aynı gruba `ASC_TEL` = `+905xxxxxxxxx` (Apple incelemesi için iletişim telefonu).
3. **iOS TestFlight** işlemini çalıştır: paket kimliğini (`com.sviapp.turnuvafiksturu`) oluşturur, sertifika ve profili hazırlar. İlk seferde App Store Connect kaydı yoksa yükleme adımında durur; bu normal.
4. **App Store Connect → Uygulamalar → + → Yeni Uygulama**: iOS · Ad `Turnuva Fikstürü` · Birincil dil **Türkçe** · Paket kimliği `com.sviapp.turnuvafiksturu` · SKU `turnuvafiksturu`. Sonra **iOS TestFlight**'ı yeniden çalıştır.
5. **App Store: sayfayı hazırla**: ad, alt başlık, açıklama, anahtar kelimeler, 5 ekran görüntüsü, kategori, yaş derecesi, inceleme notu yazılır; derleme sürüme bağlanır. Sonunda eksikleri listeler.
6. App Store Connect'te elle (bir kez):
   - **Uygulama Gizliliği** → AdMob reklamları yüzünden "veri toplanıyor": aşağıdaki tabloya göre doldur → Yayımla.
   - **Fiyatlandırma ve Kullanılabilirlik** → Ücretsiz, tüm ülkeler.
7. **App Store: incelemeye gönder**. Sonuç genelde 1–3 gün içinde e-postayla gelir.

## Notlar

- Ad "PS Turnuva" değil: "PS" Sony'nin markası, Apple bu tür adları reddediyor. Açıklama ve anahtar kelimelerde de PlayStation, FIFA, EA FC gibi markalar kullanılmadı.
- Turnuva verileri yalnızca telefondaki localStorage'da durur: anahtar `tf2` (tüm turnuvalar ve kayıtlı listeler). Eski tek turnuvalık `pst1` verisi ilk açılışta kendiliğinden içeri alınır.
- Reklam: her 5 skor kaydında bir tam ekran AdMob reklamı. `ios/Config.xcconfig` içinde Google'ın test kimlikleri durdukça uygulama reklamsız çalışır; gerçek iOS kimliklerini (`TF_ADMOB_APP_ID`, `TF_AD_INTERSTITIAL`) yazınca reklamlar açılır.

### Uygulama Gizliliği yanıtları (AdMob ile)

| Veri türü | Amaç | Kimliğe bağlı | İzleme |
|---|---|---|---|
| Tanımlayıcılar → Aygıt kimliği | Üçüncü taraf reklamcılık, Analiz | Hayır | Evet |
| Kullanım verileri → Ürün etkileşimi | Üçüncü taraf reklamcılık, Analiz | Hayır | Evet |
| Kullanım verileri → Reklam verileri | Üçüncü taraf reklamcılık | Hayır | Evet |
| Konum → Yaklaşık konum | Üçüncü taraf reklamcılık | Hayır | Evet |
| Tanılama → Çökme ve Performans verileri | Analiz | Hayır | Hayır |

Diğer her şey: Toplanmıyor.
- Yeni sürüm: `ios/Config.xcconfig` içinde `MARKETING_VERSION`'ı artır (ör. 1.0.1), main'e gönder, sonra 5 ve 7.

## Organizasyon (Firebase) kurulumu

Organizasyonlar (gruplar + eleme, birden fazla yönetici, açık/kapalı) Firebase Firestore'da tutulur. Uygulama Firebase SDK'sı kullanmaz, REST ile konuşur (`public/org.js`).

1. https://console.firebase.google.com → **Proje ekle** → ad: `turnuva-fiksturu` (Google Analytics gerekmez).
2. **Build → Authentication → Başlayın → Sign-in method → Anonim (Anonymous) → Etkinleştir**.
3. **Build → Firestore Database → Veritabanı oluştur** → konum `eur3 (europe-west)` → üretim modu.
4. Firestore → **Kurallar (Rules)** sekmesi → bu depodaki `firestore.rules` dosyasının tamamını yapıştır → **Yayınla**.
5. Proje ayarları (⚙️) → **Genel** → Uygulamalarınız → **Web (</>)** → takma ad `turnuva` → kaydet. Görünen `apiKey` ve `projectId` değerleri `public/org.js` başındaki `FB={apiKey:"",projectId:""}` satırına yazılır (bu anahtar gizli değildir, güvenliği kurallar sağlar).

App Store "Uygulama Gizliliği" için ek: **Kullanıcı İçeriği → Diğer kullanıcı içeriği** (Uygulama işlevselliği, kimliğe bağlı değil, izleme yok) ve **Tanımlayıcılar → Kullanıcı kimliği** (Uygulama işlevselliği, kimliğe bağlı değil, izleme yok).
