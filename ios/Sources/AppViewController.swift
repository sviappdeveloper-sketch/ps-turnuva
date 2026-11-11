import UIKit
import WebKit

// =====================================================================
// Turnuva Fikstürü iOS kabuğu
// Uygulama (public/ klasörü) telefonun içinden "fikstur://app/" adresiyle açılır;
// internet gerekmez. Veriler (oyuncular, maçlar) cihazda localStorage'da tutulur.
// =====================================================================
final class AppViewController: UIViewController {
  static let scheme = "fikstur"
  private var web: WKWebView!

  override var preferredStatusBarStyle: UIStatusBarStyle { .default }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(named: "LaunchBG")

    let cfg = WKWebViewConfiguration()
    if let root = Bundle.main.url(forResource: "public", withExtension: nil) {
      cfg.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: Self.scheme)
    }
    cfg.websiteDataStore = .default()   // localStorage kalıcı

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
