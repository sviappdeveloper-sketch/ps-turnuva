package com.sviapp.turnuvafiksturu;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// Turnuva Fikstürü Android kabuğu: public/index.html telefonun içinden açılır, internet gerekmez.
// Veriler (turnuvalar, oyuncular) cihazda localStorage'da tutulur.
public class MainActivity extends Activity {
    private WebView web;

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
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String sc = u.getScheme();
                if ("file".equals(sc) || "about".equals(sc) || "data".equals(sc)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;   // dış bağlantılar tarayıcıda açılır
            }
        });
        setContentView(web);
        if (saved != null) web.restoreState(saved);
        else web.loadUrl("file:///android_asset/public/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Geri tuşu: alt ekrandaysa bir önceki ekrana döner, ana menüdeyse uygulamadan çıkar.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        String js = "(function(){try{if(typeof V!=='undefined'&&V&&V.v!=='menu'){"
                + "var b=document.querySelector('.top .back');if(b){b.click()}else{go('menu')}return 'ok'}}catch(e){}return 'exit'})()";
        web.evaluateJavascript(js, val -> {
            if (val == null || val.contains("exit")) finish();
        });
    }
}
