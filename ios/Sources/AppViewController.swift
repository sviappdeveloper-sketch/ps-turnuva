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
    web.load(URLRequest(url: URL(string: "\(Self.scheme)://app/index.html")!))
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if Self.adsReady && !askedConsent { askedConsent = true; setupAds() }
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
    guard ConsentInformation.shared.canRequestAds else { return }
    if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
      ATTrackingManager.requestTrackingAuthorization { [weak self] _ in DispatchQueue.main.async { self?.startAds() } }
    } else { startAds() }
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

extension AppViewController: FullScreenContentDelegate {
  func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { loadInter() }
  func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { loadInter() }
}

// WKUserContentController denetleyiciyi güçlü tutar; döngüyü kırmak için zayıf aracı
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
  weak var target: AppViewController?
  init(_ t: AppViewController) { target = t }
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
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
