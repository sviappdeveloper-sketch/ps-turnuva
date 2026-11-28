import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    OrgKontrol.kaydet()                                   // organizasyon bildirimleri (arka plan yenileme)
    UNUserNotificationCenter.current().delegate = self
    let w = UIWindow(frame: UIScreen.main.bounds)
    w.backgroundColor = UIColor(named: "LaunchBG")
    w.rootViewController = AppViewController()
    w.makeKeyAndVisible()
    window = w
    return true
  }

  func applicationDidEnterBackground(_ application: UIApplication) { OrgKontrol.zamanla() }

  // uygulama açıkken gelen bildirim de görünsün
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound])
  }

  // bildirime dokunulunca o organizasyon açılır
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
    if let id = response.notification.request.content.userInfo["org"] as? String {
      OrgKontrol.bekleyen = id
      NotificationCenter.default.post(name: OrgKontrol.acNotu, object: nil)
    }
    completionHandler()
  }
}
