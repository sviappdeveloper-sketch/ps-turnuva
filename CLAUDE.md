# Turnuva Fikstürü (eski adı PS Turnuva) — Claude devir notu

Bu dosya, uygulamada hangi Claude hesabı veya oturumu çalışırsa çalışsın kaldığı yerden devam edebilmesi için tutulur.
GitHub: `sviappdeveloper-sketch/ps-turnuva`

## Çalışma kuralları (her oturumda uy)
- Kullanıcı kodlama bilmiyor ve Türkçe yazıyor. Türkçe ve sade cevap ver.
- Kullanıcı açıkça istemedikçe son kayıtlı sürümdeki hiçbir özelliği silme veya kaybetme. Değiştirmeden önce mevcut olanı diğer dallar dahil kontrol et.
- Uygulamaları birbirine karıştırma. Bir uygulamanın Firebase, giriş veya mağaza ayarı değişirken diğerlerinin ayarına dokunma.
- Geliştirici adını her yerde tam olarak **Svi App Developer** diye yaz. Site sviapp.com, iletişim adresi iletisim@sviapp.com.
- Derlemeyi teslim ederken yalnızca APK dosyasının kendisini gönder. Zip, rar veya yanında başka dosya olmasın.
- Tüm testlerde (TestFlight ve Play) sitaresivi@icloud.com test kullanıcısı olarak ekli olsun.
- Mağaza ve konsol adımlarını (AdMob, Play Console, App Store Connect, Firebase) mümkün olduğunca kendin yap.
- Derlemeler ücretsiz yoldan, GitHub Actions ile yapılıyor. Codemagic dakikaları bitti.
- **Bu dosyayı güncel tut:** Her oturumun sonunda yaptığın işi tarihiyle "Son işlemler" bölümünün en üstüne ekle, "Bekleyen işler" bölümünü güncelle, sonra commit'leyip push'la.

## Uygulama durumu
- Arkadaşlar arasındaki PlayStation futbol turnuvaları için: fikstür, puan, gol, kart, lig ve turnuva, istatistikler.
- Mağaza adı "Turnuva Fikstürü". Uygulama ücretsiz ve reklamlı; yalnızca ara sıra tam ekran (geçiş) reklamı çıkıyor, banner yok.
- Online "Organizasyon" özelliği (gruplar ve eleme) için Firebase projesi: `turnuva-fiksturu`.
- iOS derlemesi GitHub Actions'ta (`ios.yml`, `appstore.yml`, `appstore-gonder.yml`). Android derlemesi `android.yml` ile yapılıyor (APK ve imzalı AAB). Site `pages.yml` ile yayınlanıyor.
- Dallar: main, android, apk, organizasyon.

## Son işlemler (en yeni en üstte)
- 2026-11-28: Organizasyon: "Mail ile devam et" (anonim hesap maile bağlanır, başka telefonda girişte organizasyonlar geri gelir ve anonim organizasyonlar yeni hesaba taşınır), "Şifremi unuttum" (mail girişinde sıfırlama e-postası; katılma ekranında da), "Hesabı sil". İsteğe bağlı başlangıç/bitiş tarihi ve Başlayacak / Devam eden / Biten sekmeleri. Bildirimler: organizasyon başına 🔔 (varsayılan açık); Android'de WorkManager ~15 dakikada bir, iPhone'da arka plan yenileme (BGAppRefreshTask) ile uygulama kapalıyken de yeni skor/şampiyon bildirimi. Organizasyon bölümündeki tanıtım yazıları kaldırıldı (App Store için kullanım şartı satırı bırakıldı). Android'de geri hareketi sayfa cevap vermese bile tek seferde kapatmıyor, yerel çıkış sorusu çıkıyor; iPhone'a yerel soldan kenar kaydırması eklendi. firestore.rules güncellendi (kurucu kendi organizasyonlarını listeler, sahipliği devredebilir). Gizlilik sayfası güncellendi. Not: kullanıcının "geri çalışmıyor" şikâyeti büyük olasılıkla eski (17 Kasım) sürümden; 24 Kasım derlemesi Play/TestFlight'a hiç yüklenmemişti.
- 2026-11-26: İletişim e-postası iletisim@sviapp.com oldu.
- 2026-11-24: Serbest karşılaşma (sınırsız, skorları kaydediliyor) eklendi. Turnuva kodla paylaşılıp görüntülenebiliyor. Turnuvayı kuran kişi turnuvayı içinden silebiliyor. Geri tuşu uygulama içindeki geriyle aynı çalışıyor; ana menüde "Çıkmak istiyor musun?" sorusu çıkıyor.
- 2026-11-18: App Store derleme, imzalama ve incelemeye gönderme işi GitHub Actions'a taşındı (Xcode 26). Organizasyon özelliğine Bildir/Gizle düğmesi, uygunsuz ad süzgeci ve kullanım şartı eklendi. iOS 1.1.0 mağaza metinleri hazırlandı.
- 2026-11-17: Organizasyon: gruplar ve eleme, yönetici şifresiyle çok kişili düzenleme, PNG olarak paylaşım.
- 2026-11-16: Android: AdMob geçiş reklamı (her 5 skor kaydında bir), AB izin formu, Play için imzalı AAB.

## Bekleyen işler / kontrol edilecekler
- **Firebase konsolu (turnuva-fiksturu), yapılmadıysa:** Authentication → Sign-in method → Email/Password'ü aç; Authentication → Templates → şablon dili Türkçe; Firestore → Rules → depodaki `firestore.rules`'u yapıştırıp Publish. Bunlar yapılmadan mail ile giriş ve başka telefonda organizasyonların gelmesi çalışmaz.
- App Store Connect → Uygulama Gizliliği'ne "İletişim bilgisi → E-posta adresi (uygulama işlevi, kimliğe bağlı, izleme yok)" eklenmeli. Play Console → Veri güvenliği'ne e-posta adresi ve hesap silme eklenmeli.
- Yeni iOS sürümü (bildirim + mail) TestFlight'a/App Store'a gönderilecek; gerekirse MARKETING_VERSION 1.2.0 yapılmalı.
- Android sürümünü Google Play'de yayınlama isteği var. Play Console'daki durumu kontrol et.
