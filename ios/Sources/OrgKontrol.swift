import UIKit
import BackgroundTasks
import UserNotifications

// =====================================================================
// Organizasyon bildirimleri (Android'deki OrgKontrol.java'nın iPhone karşılığı)
// Uygulama kapalıyken iOS arka plan yenilemesi (BGAppRefreshTask) ile takip edilen organizasyonlara bakılır;
// yeni skor girildiyse ya da şampiyon belli olduysa bildirim gösterilir. Ne sıklıkta çalışacağına iOS karar verir
// (en erken 15 dakikada bir). Takip listesi sayfadan gelir: window.TFBildirim.ayarla(json).
// Sayfanın verdiği oy/sp değerleri "kullanıcı bunu gördü" demektir; kişinin kendi girdiği skor için bildirim çıkmaz.
// =====================================================================
enum OrgKontrol {
  static let gorev = "com.sviapp.turnuvafiksturu.kontrol"
  private static let d = UserDefaults.standard

  // AppDelegate açılışta çağırır (iOS, görevin açılış bitmeden kaydedilmesini ister)
  static func kaydet() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: gorev, using: nil) { task in
      zamanla()
      let bir = Bayrak()
      task.expirationHandler = { if bir.ilk() { task.setTaskCompleted(success: false) } }
      calistir { if bir.ilk() { task.setTaskCompleted(success: true) } }
    }
  }

  static func zamanla() {
    guard let L = ayar()?["orgs"] as? [[String: Any]], !L.isEmpty else {
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: gorev); return
    }
    let r = BGAppRefreshTaskRequest(identifier: gorev)
    r.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(r)
  }

  private static func ayar() -> [String: Any]? {
    guard let s = d.string(forKey: "tf_ayar"), let data = s.data(using: .utf8) else { return nil }
    return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  }
  private static func durum() -> [String: [String: Any]] {
    return (d.dictionary(forKey: "tf_durum") as? [String: [String: Any]]) ?? [:]
  }
  private static func sayi(_ v: Any?) -> Int {
    if let n = v as? Int { return n }
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String { return Int(s) ?? 0 }
    return 0
  }

  static func ayarla(_ json: String) {
    guard let data = json.data(using: .utf8),
          let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
    let eski = durum()
    var yeni: [String: [String: Any]] = [:]
    for g in (o["orgs"] as? [[String: Any]]) ?? [] {
      guard let id = g["id"] as? String else { continue }
      let e = eski[id]
      let oy = max(sayi(e?["oy"]), sayi(g["oy"]))
      var sp = (g["sp"] as? String) ?? ""
      if sp.isEmpty { sp = (e?["sp"] as? String) ?? "" }
      yeni[id] = ["oy": oy, "sp": sp]
    }
    d.set(json, forKey: "tf_ayar")
    d.set(yeni, forKey: "tf_durum")
    zamanla()
  }

  // ilk: ilk organizasyon takibe alınınca bir kez sorulur; değilse (🔔 açıldı) reddedilmişse Ayarlar açılır
  static func izinIste(ilk: Bool) {
    let c = UNUserNotificationCenter.current()
    c.getNotificationSettings { s in
      DispatchQueue.main.async {
        if s.authorizationStatus == .notDetermined {
          if ilk && d.bool(forKey: "tf_soruldu") { return }
          d.set(true, forKey: "tf_soruldu")
          c.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        } else if s.authorizationStatus == .denied && !ilk {
          if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
        }
      }
    }
  }

  private static func str(_ f: [String: Any], _ k: String) -> String {
    return ((f[k] as? [String: Any])?["stringValue"] as? String) ?? ""
  }
  private static func num(_ f: [String: Any], _ k: String) -> Int {
    return sayi((f[k] as? [String: Any])?["integerValue"])
  }

  static func calistir(_ bitti: @escaping () -> Void) {
    guard let a = ayar(), let L = a["orgs"] as? [[String: Any]], !L.isEmpty,
          let key = a["key"] as? String, let pid = a["pid"] as? String else {
      DispatchQueue.main.async(execute: bitti); return
    }
    yenile(key: key, rt: (a["rt"] as? String) ?? "") { tok in
      let grup = DispatchGroup()
      let kutu = Kutu()
      for g in L {
        guard let id = g["id"] as? String else { continue }
        grup.enter()
        getir(pid: pid, id: id, tok: tok) { f in
          if let f = f { kutu.koy(id, f) }
          grup.leave()
        }
      }
      grup.notify(queue: .main) {
        var dur = durum()
        for (id, f) in kutu.hepsi() {
          guard f["oy"] != nil else { continue }
          let ad = str(f, "name"), sv = str(f, "sp"), oy = num(f, "oy"), mt = num(f, "mt")
          if let e = dur[id] {
            let eOy = sayi(e["oy"]), eSp = (e["sp"] as? String) ?? ""
            if !sv.isEmpty && sv != eSp { bildir(id, "🏆 " + ad, "Şampiyon: " + sv) }
            else if oy > eOy {
              bildir(id, ad, (oy - eOy == 1 ? "Yeni skor girildi" : "\(oy - eOy) yeni skor girildi") + " · \(oy)/\(mt) maç")
            }
          }
          dur[id] = ["oy": oy, "sp": sv]
        }
        d.set(dur, forKey: "tf_durum")
        bitti()
      }
    }
  }

  // giriş anahtarını yeniler (kapalı organizasyonları okuyabilmek için)
  private static func yenile(key: String, rt: String, _ cb: @escaping (String?) -> Void) {
    guard !rt.isEmpty, let u = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(key)") else { cb(nil); return }
    var r = URLRequest(url: u, timeoutInterval: 15)
    r.httpMethod = "POST"
    r.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    let rtq = rt.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? rt
    r.httpBody = "grant_type=refresh_token&refresh_token=\(rtq)".data(using: .utf8)
    URLSession.shared.dataTask(with: r) { data, resp, _ in
      guard (resp as? HTTPURLResponse)?.statusCode == 200, let data = data,
            let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { cb(nil); return }
      cb(o["id_token"] as? String)
    }.resume()
  }

  private static func getir(pid: String, id: String, tok: String?, _ cb: @escaping ([String: Any]?) -> Void) {
    let temiz = id.filter { $0.isLetter || $0.isNumber }
    guard let u = URL(string: "https://firestore.googleapis.com/v1/projects/\(pid)/databases/(default)/documents/orgs/\(temiz)?mask.fieldPaths=name&mask.fieldPaths=oy&mask.fieldPaths=mt&mask.fieldPaths=sp") else { cb(nil); return }
    var r = URLRequest(url: u, timeoutInterval: 15)
    if let t = tok { r.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
    URLSession.shared.dataTask(with: r) { data, resp, _ in
      guard (resp as? HTTPURLResponse)?.statusCode == 200, let data = data,
            let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { cb(nil); return }
      cb(o["fields"] as? [String: Any])
    }.resume()
  }

  private static func bildir(_ id: String, _ baslik: String, _ metin: String) {
    let c = UNMutableNotificationContent()
    c.title = baslik
    c.body = metin
    c.sound = .default
    c.userInfo = ["org": id]
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "org-" + id, content: c, trigger: nil))
  }

  // bildirime dokunulunca açılacak organizasyon (sayfa yüklenince AppViewController açar)
  static var bekleyen: String?
  static let acNotu = Notification.Name("TFOrgAc")
}

// tek sefer çalışacak işler için (görev bir kez kapatılır)
final class Bayrak: @unchecked Sendable {
  private let l = NSLock()
  private var oldu = false
  func ilk() -> Bool { l.lock(); defer { l.unlock() }; if oldu { return false }; oldu = true; return true }
}
// aynı anda gelen cevapları toplamak için
final class Kutu: @unchecked Sendable {
  private let l = NSLock()
  private var d: [String: [String: Any]] = [:]
  func koy(_ k: String, _ v: [String: Any]) { l.lock(); d[k] = v; l.unlock() }
  func hepsi() -> [String: [String: Any]] { l.lock(); defer { l.unlock() }; return d }
}
