import UIKit
import WebKit
import AppTrackingTransparency
import GoogleMobileAds
import UserMessagingPlatform

// =====================================================================
// Turnuva Fikstürü iOS kabuğu
// Uygulama (public/ klasörü) telefonun içinden "fikstur://app/" adresiyle açılır;
// internet gerekmez. Veriler (oyuncular, maçlar) cihazda localStorage'da tutulur.
// =====================================================================
final class AppViewController: UIViewController {
  static let scheme = "fikstur"
  private var web: WKWebView!

  // reklam: yalnızca tam ekran (geçiş) reklamı; web tarafı her 5 skor kaydında ister
  private var adsStarted = false, askedConsent = false
  private var inter: InterstitialAd?
  private var interLoading = false
  static var adsReady: Bool {
    let id = (Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String) ?? ""
    return id.hasPrefix("ca-app-pub-") && !id.contains("3940256099942544")
  }

  override var preferredStatusBarStyle: UIStatusBarStyle { .default }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(named: "LaunchBG")

    let cfg = WKWebViewConfiguration()
    if let root = Bundle.main.url(forResource: "public", withExtension: nil) {
      cfg.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: Self.scheme)
    }
    cfg.websiteDataStore = .default()   // localStorage kalıcı
    // PNG paylaşımı: window.TFPaylas.png(base64, dosyaAdı) → iOS paylaş menüsü
    cfg.userContentController.add(WeakMessageHandler(self), name: "tfpng")
    // organizasyon bildirimleri: window.TFBildirim.ayarla(json) / izinIste()
    cfg.userContentController.add(WeakMessageHandler(self), name: "tfbil")
    cfg.userContentController.addUserScript(WKUserScript(
      source: "window.TFBildirim={ayarla:function(j){window.webkit.messageHandlers.tfbil.postMessage({k:'ayarla',j:j})},izinIste:function(){window.webkit.messageHandlers.tfbil.postMessage({k:'izin'})}};",
      injectionTime: .atDocumentStart, forMainFrameOnly: true))
    cfg.userContentController.addUserScript(WKUserScript(
      source: "window.TFKaydir=1;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    cfg.userContentController.addUserScript(WKUserScript(
      source: "window.TFPaylas={png:function(b,n){window.webkit.messageHandlers.tfpng.postMessage({b:b,n:n})}};",
      injectionTime: .atDocumentStart, forMainFrameOnly: true))
    if Self.adsReady {
      cfg.userContentController.add(WeakMessageHandler(self), name: "tf")
      cfg.userContentController.addUserScript(WKUserScript(
        source: "window.TFReklam={goster:function(){window.webkit.messageHandlers.tf.postMessage('reklam')}};",
        injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    web = WKWebView(frame: view.bounds, configuration: cfg)
    web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    web.isOpaque = false
    web.backgroundColor = UIColor(named: "LaunchBG")
    web.scrollView.backgroundColor = UIColor(named: "LaunchBG")
    web.scrollView.contentInsetAdjustmentBehavior = .never   // kenar boşluklarını sayfa (safe-area) ayarlar
    web.scrollView.bounces = true
    web.allowsLinkPreview = false
    web.navigationDelegate = self
    view.addSubview(web)
    // soldan kenar kaydırması: sayfadaki appSwipeBack() bir önceki ekrana döner (ana menüde bir şey yapmaz)
    let kenar = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(kenarKaydir(_:)))
    kenar.edges = .left
    kenar.delegate = self
    web.addGestureRecognizer(kenar)
    web.load(URLRequest(url: URL(string: "\(Self.scheme)://app/index.html")!))
    acGozcu = NotificationCenter.default.addObserver(forName: OrgKontrol.acNotu, object: nil, queue: .main) { [weak self] _ in
      self?.orgAc()
    }
  }

  private var acGozcu: NSObjectProtocol?
  private var sayfaHazir = false
  // bildirime dokunulduysa sayfa hazır olunca o organizasyonu aç
  fileprivate func orgAc() {
    guard sayfaHazir, let id = OrgKontrol.bekleyen else { return }
    OrgKontrol.bekleyen = nil
    let temiz = id.filter { $0.isLetter || $0.isNumber }
    if !temiz.isEmpty { web.evaluateJavaScript("window.orgOpen&&orgOpen('\(temiz)')", completionHandler: nil) }
  }

  private var activeObs: NSObjectProtocol?
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    // App Tracking Transparency izni uygulama gerçekten "aktif" olduğunda istenir;
    // aktif olmadan istenirse iOS pencereyi göstermez (App Review bunu bulamaz).
    if activeObs == nil {
      activeObs = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
        self?.requestTrackingIfNeeded()
      }
    }
    requestTrackingIfNeeded()
  }
  private var trackingAsking = false
  private func requestTrackingIfNeeded() {
    guard Self.adsReady else { return }
    guard !trackingAsking else { return }
    guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { afterTracking(); return }
    trackingAsking = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      guard let self = self else { return }
      guard UIApplication.shared.applicationState == .active else { self.trackingAsking = false; return }
      ATTrackingManager.requestTrackingAuthorization { [weak self] status in
        DispatchQueue.main.async {
          guard let self = self else { return }
          self.trackingAsking = false
          if status != .notDetermined { self.afterTracking() }
        }
      }
    }
  }
  private func afterTracking() {
    if !askedConsent { askedConsent = true; setupAds() }
  }

  // ---------------- reklamlar (AdMob + AB izin formu + izleme izni) ----------------
  private func setupAds() {
    let info = ConsentInformation.shared
    info.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] _ in
      guard let self = self else { return }
      ConsentForm.loadAndPresentIfRequired(from: self) { [weak self] _ in self?.askTrackingThenStart() }
    }
    if info.canRequestAds { askTrackingThenStart() }
  }
  private func askTrackingThenStart() {
    // izin penceresi önceden (requestTrackingIfNeeded) gösterildi; burada yalnızca reklamlar başlar
    guard ConsentInformation.shared.canRequestAds else { return }
    startAds()
  }
  private func startAds() {
    if adsStarted { return }
    adsStarted = true
    MobileAds.shared.start(completionHandler: nil)
    loadInter()
  }
  private func loadInter() {
    guard adsStarted, inter == nil, !interLoading else { return }
    interLoading = true
    let unit = (Bundle.main.object(forInfoDictionaryKey: "TFAdInterstitial") as? String) ?? ""
    InterstitialAd.load(with: unit, request: Request()) { [weak self] ad, _ in
      self?.interLoading = false; self?.inter = ad
    }
  }
  fileprivate func showInterstitial() {
    guard let ad = inter else { loadInter(); return }
    inter = nil
    ad.fullScreenContentDelegate = self
    ad.present(from: self)
  }
}

extension AppViewController: UIGestureRecognizerDelegate {
  @objc fileprivate func kenarKaydir(_ g: UIScreenEdgePanGestureRecognizer) {
    guard g.state == .ended else { return }
    let t = g.translation(in: view)
    if t.x > 60 || g.velocity(in: view).x > 500 {
      web.evaluateJavaScript("window.appSwipeBack&&appSwipeBack()", completionHandler: nil)
    }
  }
  func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith o: UIGestureRecognizer) -> Bool { true }
}

extension AppViewController {
  fileprivate func sharePNG(base64: String, name: String) {
    guard let data = Data(base64Encoded: base64) else { return }
    let safe = name.replacingOccurrences(of: "/", with: "-")
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe.isEmpty ? "turnuva.png" : safe)
    try? data.write(to: url)
    let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
    if let pop = vc.popoverPresentationController {
      pop.sourceView = view
      pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
      pop.permittedArrowDirections = []
    }
    present(vc, animated: true)
  }
}

extension AppViewController: FullScreenContentDelegate {
  func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { loadInter() }
  func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { loadInter() }
}

// WKUserContentController denetleyiciyi güçlü tutar; döngüyü kırmak için zayıf aracı
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
  weak var target: AppViewController?
  init(_ t: AppViewController) { target = t }
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    if message.name == "tfbil", let d = message.body as? [String: Any] {
      if (d["k"] as? String) == "ayarla", let j = d["j"] as? String {
        OrgKontrol.ayarla(j)
        if j.contains("\"id\"") { OrgKontrol.izinIste(ilk: true) }
      } else if (d["k"] as? String) == "izin" { OrgKontrol.izinIste(ilk: false) }
      return
    }
    if message.name == "tfpng", let d = message.body as? [String: Any], let b = d["b"] as? String {
      target?.sharePNG(base64: b, name: (d["n"] as? String) ?? "turnuva.png"); return
    }
    if (message.body as? String) == "reklam" { target?.showInterstitial() }
  }
}

// dış bağlantılar Safari'de açılır; WebView kapanırsa yeniden yüklenir
extension AppViewController: WKNavigationDelegate {
  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
               decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = action.request.url else { decisionHandler(.allow); return }
    if url.scheme == Self.scheme || url.scheme == "about" || url.scheme == "data" {
      decisionHandler(.allow); return
    }
    UIApplication.shared.open(url)
    decisionHandler(.cancel)
  }
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { sayfaHazir = true; orgAc() }
}

// Uygulama içindeki public/ klasörünü "fikstur://app/..." adresinden sunar
private final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
  let root: URL
  init(root: URL) { self.root = root.standardizedFileURL }

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { task.didFailWithError(URLError(.badURL)); return }
    var path = url.path
    if path.isEmpty || path == "/" { path = "/index.html" }
    let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
    guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
      let r = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
      task.didReceive(r); task.didReceive(Data()); task.didFinish(); return
    }
    let headers = ["Content-Type": Self.mime(file.pathExtension), "Content-Length": String(data.count), "Cache-Control": "no-cache"]
    let r = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
    task.didReceive(r); task.didReceive(data); task.didFinish()
  }
  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

  static func mime(_ ext: String) -> String {
    switch ext.lowercased() {
    case "html", "htm": return "text/html; charset=utf-8"
    case "js": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json": return "application/json"
    case "png": return "image/png"
    case "svg": return "image/svg+xml"
    default: return "application/octet-stream"
    }
  }
}
