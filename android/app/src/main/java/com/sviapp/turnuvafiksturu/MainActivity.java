package com.sviapp.turnuvafiksturu;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.concurrent.atomic.AtomicBoolean;
import android.widget.FrameLayout;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// Turnuva Fikstürü Android kabuğu: public/index.html telefonun içinden açılır.
// Veriler (turnuvalar, oyuncular) cihazda localStorage'da tutulur; organizasyonlar Firebase'de. İnternet ayrıca reklam içindir:
// her 5 skor kaydında bir tam ekran AdMob reklamı (sayfa window.TFReklam.goster() çağırır).
public class MainActivity extends Activity {
    private WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean adsStarted = new AtomicBoolean(false);
    private ConsentInformation consent;
    private InterstitialAd inter;
    private boolean interLoading;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(getResources().getColor(R.color.bg, getTheme()));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage kalıcı
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Reklam(), "TFReklam");
        web.addJavascriptInterface(new Paylas(), "TFPaylas");
        web.addJavascriptInterface(new Cikis(), "TFCikis");
        web.addJavascriptInterface(new Bildirim(), "TFBildirim");
        bekleyenOrg = getIntent() == null ? null : getIntent().getStringExtra("org");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String sc = u.getScheme();
                if ("file".equals(sc) || "about".equals(sc) || "data".equals(sc)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;   // dış bağlantılar tarayıcıda açılır
            }
            @Override public void onPageFinished(WebView v, String url) { orgAc(); }
        });
        // Android 15+ uygulamayı ekranın kenarına kadar çizer; durum çubuğu ve alt gezinme
        // çubuğu kadar boşluk bırakılır ki içerik onların altında kalmasın.
        FrameLayout kok = new FrameLayout(this);
        kok.setBackgroundColor(getResources().getColor(R.color.bg, getTheme()));
        kok.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (android.os.Build.VERSION.SDK_INT >= 35) kok.setOnApplyWindowInsetsListener((v, ins) -> {
            int t = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime();
            android.graphics.Insets i = ins.getInsets(t);
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        });
        setContentView(kok);
        if (saved != null) web.restoreState(saved);
        else web.loadUrl("file:///android_asset/public/index.html");
        setupAds();
        geriKaydet();
    }

    // AEA/BK kullanıcıları için izin formu (UMP), ardından AdMob başlatılır
    private void setupAds() {
        consent = UserMessagingPlatform.getConsentInformation(this);
        consent.requestConsentInfoUpdate(this, new ConsentRequestParameters.Builder().build(),
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, err -> { if (consent.canRequestAds()) startAds(); }),
            err -> { if (consent.canRequestAds()) startAds(); });
        if (consent.canRequestAds()) startAds();
    }

    private void startAds() {
        if (!adsStarted.compareAndSet(false, true)) return;
        new Thread(() -> {
            MobileAds.initialize(this, st -> {});
            main.post(this::loadInter);
        }).start();
    }

    private void loadInter() {
        if (!adsStarted.get() || inter != null || interLoading) return;
        interLoading = true;
        InterstitialAd.load(this, getString(R.string.ad_interstitial), new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd ad) { interLoading = false; inter = ad; }
            @Override public void onAdFailedToLoad(LoadAdError e) { interLoading = false; inter = null; main.postDelayed(MainActivity.this::loadInter, 30000); }
        });
    }

    private void showInterstitial() {
        final InterstitialAd ad = inter;
        if (ad == null) { loadInter(); return; }
        inter = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { loadInter(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError e) { loadInter(); }
        });
        ad.show(this);
    }

    // PNG paylaşımı: sayfa window.TFPaylas.png(base64, dosyaAdı) çağırır, Android paylaş menüsü açılır
    private class Paylas {
        // düz metin paylaşımı (turnuva kodu): window.TFPaylas.metin("...")
        @JavascriptInterface public void metin(String t) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, t == null ? "" : t);
            main.post(() -> startActivity(Intent.createChooser(i, "Paylaş")));
        }
        @JavascriptInterface public void png(String b64, String ad) {
            try {
                byte[] veri = Base64.decode(b64, Base64.DEFAULT);
                File dir = new File(getCacheDir(), "paylas");
                dir.mkdirs();
                File[] eski = dir.listFiles();
                if (eski != null) for (File f : eski) f.delete();
                String temiz = (ad == null || ad.isEmpty()) ? "turnuva.png" : ad.replaceAll("[\\/:*?\"<>|]", "-");
                File f = new File(dir, temiz);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(veri); }
                Uri u = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".paylas", f);
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("image/png");
                i.putExtra(Intent.EXTRA_STREAM, u);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                main.post(() -> startActivity(Intent.createChooser(i, "Paylaş")));
            } catch (Exception ignored) {}
        }
    }

    private class Reklam {
        @JavascriptInterface public void goster() { main.post(MainActivity.this::showInterstitial); }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Geri tuşu / geri hareketi: sayfadaki appBack() karar verir. Alt ekrandaysa bir önceki ekrana döner;
    // ana menüde "Uygulamadan çıkmak istiyor musunuz?" sorulur, Evet denirse TFCikis.cik() uygulamayı kapatır.
    // Sayfa cevap veremezse (yüklenmemiş, hata) uygulama yine tek geriyle kapanmaz: aynı soru yerel pencereyle sorulur.
    private void geri() {
        if (soruAcik) return;
        web.evaluateJavascript("(function(){try{if(window.appBack)return appBack()}catch(e){}return 'ask'})()", val -> {
            if (val == null || !val.contains("ok")) cikisSor();
        });
    }

    private boolean soruAcik;
    private void cikisSor() {
        if (soruAcik || isFinishing()) return;
        soruAcik = true;
        new android.app.AlertDialog.Builder(this)
            .setMessage("Uygulamadan çıkmak istiyor musunuz?")
            .setNegativeButton("Hayır", (d, w) -> d.dismiss())
            .setPositiveButton("Evet", (d, w) -> finish())
            .setOnDismissListener(d -> soruAcik = false)
            .show();
    }

    // ---------------- organizasyon bildirimleri (OrgKontrol) ----------------
    private String bekleyenOrg;   // bildirime dokunulunca açılacak organizasyon kodu
    private void orgAc() {
        if (bekleyenOrg == null) return;
        String id = bekleyenOrg.replaceAll("[^A-Za-z0-9]", "");
        bekleyenOrg = null;
        if (!id.isEmpty()) web.evaluateJavascript("window.orgOpen&&orgOpen('" + id + "')", null);
    }
    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        bekleyenOrg = i.getStringExtra("org");
        orgAc();
    }
    private static final String IZIN = "android.permission.POST_NOTIFICATIONS";
    private class Bildirim {
        @JavascriptInterface public void ayarla(String j) {
            OrgKontrol.ayarla(getApplicationContext(), j == null ? "{}" : j);
            if (j != null && j.contains("\"id\"")) main.post(MainActivity.this::ilkIzin);
        }
        @JavascriptInterface public void izinIste() { main.post(MainActivity.this::izinIste); }
    }
    // ilk organizasyon takibe alındığında bildirim izni bir kez sorulur (Android 13+)
    private void ilkIzin() {
        if (android.os.Build.VERSION.SDK_INT < 33) return;
        android.content.SharedPreferences p = getSharedPreferences(OrgKontrol.PREF, 0);
        if (p.getBoolean("soruldu", false) || checkSelfPermission(IZIN) == android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        p.edit().putBoolean("soruldu", true).apply();
        requestPermissions(new String[]{IZIN}, 7);
    }
    // 🔔 açılınca: izin yoksa sorulur; kesin reddedildiyse bildirim ayarları açılır
    private void izinIste() {
        boolean acik = androidx.core.app.NotificationManagerCompat.from(this).areNotificationsEnabled();
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(IZIN) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            android.content.SharedPreferences p = getSharedPreferences(OrgKontrol.PREF, 0);
            if (!p.getBoolean("soruldu", false) || shouldShowRequestPermissionRationale(IZIN)) {
                p.edit().putBoolean("soruldu", true).apply();
                requestPermissions(new String[]{IZIN}, 7);
                return;
            }
            acik = false;
        }
        if (!acik && android.os.Build.VERSION.SDK_INT >= 26) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName())); } catch (Exception ignored) {}
        }
    }

    private class Cikis {
        @JavascriptInterface public void cik() { main.post(MainActivity.this::finish); }
    }

    // Android 13+ (hedef API 36): geri hareketi onBackPressed'i çağırmaz, bu yüzden geri çağrısı kaydedilir
    private android.window.OnBackInvokedCallback geriCagri;
    private void geriKaydet() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            geriCagri = this::geri;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, geriCagri);
        }
    }

    @Override
    protected void onDestroy() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && geriCagri != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(geriCagri);
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { geri(); }
}
