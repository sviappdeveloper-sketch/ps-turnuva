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
- 2026-11-26: İletişim e-postası iletisim@sviapp.com oldu.
- 2026-11-24: Serbest karşılaşma (sınırsız, skorları kaydediliyor) eklendi. Turnuva kodla paylaşılıp görüntülenebiliyor. Turnuvayı kuran kişi turnuvayı içinden silebiliyor. Geri tuşu uygulama içindeki geriyle aynı çalışıyor; ana menüde "Çıkmak istiyor musun?" sorusu çıkıyor.
- 2026-11-18: App Store derleme, imzalama ve incelemeye gönderme işi GitHub Actions'a taşındı (Xcode 26). Organizasyon özelliğine Bildir/Gizle düğmesi, uygunsuz ad süzgeci ve kullanım şartı eklendi. iOS 1.1.0 mağaza metinleri hazırlandı.
- 2026-11-17: Organizasyon: gruplar ve eleme, yönetici şifresiyle çok kişili düzenleme, PNG olarak paylaşım.
- 2026-11-16: Android: AdMob geçiş reklamı (her 5 skor kaydında bir), AB izin formu, Play için imzalı AAB.

## Bekleyen işler / kontrol edilecekler
- Android sürümünü Google Play'de yayınlama isteği var. Play Console'daki durumu kontrol et.
