package com.sviapp.turnuvafiksturu;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.TimeUnit;

// Organizasyon bildirimleri: uygulama kapalıyken de yaklaşık 15 dakikada bir takip edilen organizasyonlara bakar.
// Yeni skor girildiyse ya da şampiyon belli olduysa telefona bildirim gösterir; dokununca o organizasyon açılır.
// Takip listesi sayfadan gelir (window.TFBildirim.ayarla). Sayfanın verdiği oy/sp değerleri "kullanıcı bunu gördü"
// anlamına gelir, böylece kişinin kendi girdiği skor için bildirim çıkmaz.
public class OrgKontrol extends Worker {
    static final String PREF = "tf_bildirim", IS = "tf-org-kontrol", KANAL = "skorlar";

    public OrgKontrol(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static synchronized void ayarla(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json);
            SharedPreferences sp = c.getSharedPreferences(PREF, 0);
            JSONObject eski = new JSONObject(sp.getString("durum", "{}")), yeni = new JSONObject();
            JSONArray L = o.optJSONArray("orgs");
            int n = L == null ? 0 : L.length();
            for (int i = 0; i < n; i++) {
                JSONObject g = L.getJSONObject(i);
                String id = g.getString("id");
                JSONObject e = eski.optJSONObject(id);
                int oy = Math.max(e == null ? 0 : e.optInt("oy"), g.optInt("oy"));
                String s = g.optString("sp", "");
                if (s.isEmpty() && e != null) s = e.optString("sp", "");
                yeni.put(id, new JSONObject().put("oy", oy).put("sp", s));
            }
            sp.edit().putString("ayar", json).putString("durum", yeni.toString()).apply();
            WorkManager wm = WorkManager.getInstance(c);
            if (n == 0) { wm.cancelUniqueWork(IS); return; }
            PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(OrgKontrol.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
            wm.enqueueUniquePeriodicWork(IS, ExistingPeriodicWorkPolicy.KEEP, r);
        } catch (Exception ignored) {}
    }

    @NonNull @Override
    public Result doWork() {
        Context c = getApplicationContext();
        try {
            SharedPreferences sp = c.getSharedPreferences(PREF, 0);
            JSONObject ayar = new JSONObject(sp.getString("ayar", "{}"));
            JSONArray L = ayar.optJSONArray("orgs");
            if (L == null || L.length() == 0) return Result.success();
            String key = ayar.optString("key"), pid = ayar.optString("pid"), rt = ayar.optString("rt");
            String tok = rt.isEmpty() ? null : yenile(key, rt);
            for (int i = 0; i < L.length(); i++) {
                String id = L.getJSONObject(i).getString("id");
                JSONObject f = getir(pid, id, tok);
                if (f == null || !f.has("oy")) continue;
                String ad = str(f, "name"), sv = str(f, "sp");
                int oy = num(f, "oy"), mt = num(f, "mt");
                synchronized (OrgKontrol.class) {
                    JSONObject durum = new JSONObject(sp.getString("durum", "{}"));
                    JSONObject d = durum.optJSONObject(id);
                    if (d != null) {
                        int eOy = d.optInt("oy");
                        String eSp = d.optString("sp", "");
                        if (!sv.isEmpty() && !sv.equals(eSp)) bildir(c, id, "🏆 " + ad, "Şampiyon: " + sv);
                        else if (oy > eOy) bildir(c, id, ad, (oy - eOy == 1 ? "Yeni skor girildi" : (oy - eOy) + " yeni skor girildi") + " · " + oy + "/" + mt + " maç");
                    } else d = new JSONObject();
                    durum.put(id, d.put("oy", oy).put("sp", sv));
                    sp.edit().putString("durum", durum.toString()).apply();
                }
            }
        } catch (Exception ignored) {}
        return Result.success();
    }

    private static String str(JSONObject f, String k) { JSONObject v = f.optJSONObject(k); return v == null ? "" : v.optString("stringValue", ""); }
    private static int num(JSONObject f, String k) {
        JSONObject v = f.optJSONObject(k);
        try { return v == null ? 0 : Integer.parseInt(v.optString("integerValue", "0")); } catch (Exception e) { return 0; }
    }

    private static String oku(HttpURLConnection h) throws Exception {
        InputStream in = h.getResponseCode() < 400 ? h.getInputStream() : h.getErrorStream();
        if (in == null) return "";
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int r;
        while ((r = in.read(buf)) > 0) b.write(buf, 0, r);
        in.close();
        return b.toString("UTF-8");
    }

    // giriş anahtarını yeniler (kapalı organizasyonları okuyabilmek için)
    private static String yenile(String key, String rt) {
        try {
            HttpURLConnection h = (HttpURLConnection) new URL("https://securetoken.googleapis.com/v1/token?key=" + key).openConnection();
            h.setConnectTimeout(15000); h.setReadTimeout(15000);
            h.setRequestMethod("POST"); h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            try (OutputStream o = h.getOutputStream()) { o.write(("grant_type=refresh_token&refresh_token=" + URLEncoder.encode(rt, "UTF-8")).getBytes("UTF-8")); }
            if (h.getResponseCode() != 200) return null;
            return new JSONObject(oku(h)).optString("id_token", null);
        } catch (Exception e) { return null; }
    }

    private static JSONObject getir(String pid, String id, String tok) {
        try {
            String u = "https://firestore.googleapis.com/v1/projects/" + pid + "/databases/(default)/documents/orgs/" + URLEncoder.encode(id, "UTF-8")
                + "?mask.fieldPaths=name&mask.fieldPaths=oy&mask.fieldPaths=mt&mask.fieldPaths=sp";
            HttpURLConnection h = (HttpURLConnection) new URL(u).openConnection();
            h.setConnectTimeout(15000); h.setReadTimeout(15000);
            if (tok != null) h.setRequestProperty("Authorization", "Bearer " + tok);
            if (h.getResponseCode() != 200) return null;
            return new JSONObject(oku(h)).optJSONObject("fields");
        } catch (Exception e) { return null; }
    }

    static void bildir(Context c, String id, String baslik, String metin) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(new NotificationChannel(KANAL, "Organizasyon skorları", NotificationManager.IMPORTANCE_DEFAULT));
        Intent i = new Intent(c, MainActivity.class).putExtra("org", id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(c, KANAL)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setContentTitle(baslik)
            .setContentText(metin)
            .setColor(0xFF16A34A)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build();
        nm.notify(id.hashCode(), n);
    }
}
