import Foundation
import Security
import UIKit

struct NutritionEstimate: Codable, Equatable {
    let name: String
    let grams: Double
    let carbs: Double
    let protein: Double
    let fat: Double
    let kcal: Double
    let confidence: String
    let note: String

    var totalMacro: Macro { Macro(carbs: carbs, protein: protein, fat: fat, kcal: kcal) }
    var per100: Macro { totalMacro.scaled(by: 100 / max(grams, 1)) }
}

struct RemoteStateEnvelope: Codable {
    let version: Int
    let state: SavedState?
    let updatedAt: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decode(Int.self, forKey: .version)
        state = try? container.decode(SavedState.self, forKey: .state)
        updatedAt = try? container.decode(String.self, forKey: .updatedAt)
    }
}

enum ServerAPIError: LocalizedError {
    case invalidURL
    case notPaired
    case server(String)
    case invalidResponse
    case conflict(RemoteStateEnvelope)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "服务器地址无效，请填写 https:// 开头的地址。"
        case .notPaired: return "请先使用服务器配对码连接。"
        case .server(let message): return message
        case .invalidResponse: return "服务器返回了无法识别的数据。"
        case .conflict: return "服务器已有更新，正在合并数据。"
        }
    }
}

private struct PairResponse: Codable { let token: String }
private struct ErrorResponse: Codable { let error: String? }
private struct AnalysisResponse: Codable { let estimate: NutritionEstimate; let cached: Bool }

final class ServerClient {
    static let shared = ServerClient()
    private let session: URLSession
    private let tokenKey = "meal-meter-device-token"

    init(session: URLSession = .shared) { self.session = session }

    var isPaired: Bool { KeychainStore.read(tokenKey) != nil }

    func pair(serverURL: String, pairingCode: String) async throws {
        let body = ["pairingCode": pairingCode, "deviceName": await UIDevice.current.name]
        let response: PairResponse = try await send(serverURL: serverURL, path: "/v1/auth/pair", method: "POST", body: body, authenticated: false)
        guard !response.token.isEmpty else { throw ServerAPIError.invalidResponse }
        try KeychainStore.save(response.token, key: tokenKey)
    }

    func fetchState(serverURL: String) async throws -> RemoteStateEnvelope {
        try await send(serverURL: serverURL, path: "/v1/sync", method: "GET", body: Optional<String>.none)
    }

    func pushState(serverURL: String, state: SavedState, baseVersion: Int) async throws -> RemoteStateEnvelope {
        let payload = SyncRequest(baseVersion: baseVersion, state: state)
        return try await send(serverURL: serverURL, path: "/v1/sync", method: "PUT", body: payload)
    }

    func analyze(serverURL: String, description: String, image: UIImage?) async throws -> NutritionEstimate {
        var imageDataURL: String?
        if let image {
            let resized = image.resizedForUpload(maxDimension: 1600)
            guard let data = resized.jpegData(compressionQuality: 0.72) else { throw ServerAPIError.invalidResponse }
            imageDataURL = "data:image/jpeg;base64,\(data.base64EncodedString())"
        }
        let payload = AnalysisRequest(description: description, imageDataURL: imageDataURL)
        let response: AnalysisResponse = try await send(serverURL: serverURL, path: "/v1/ai/analyze-food", method: "POST", body: payload)
        return response.estimate
    }

    func disconnect() { KeychainStore.delete(tokenKey) }

    private func send<Response: Decodable, Body: Encodable>(serverURL: String, path: String, method: String,
                                                             body: Body?, authenticated: Bool = true) async throws -> Response {
        guard var base = URLComponents(string: serverURL.trimmingCharacters(in: .whitespacesAndNewlines)),
              ["https", "http"].contains(base.scheme?.lowercased()), base.host != nil else { throw ServerAPIError.invalidURL }
        #if !DEBUG
        guard base.scheme?.lowercased() == "https" else { throw ServerAPIError.invalidURL }
        #endif
        base.path = base.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path
        guard let url = base.url else { throw ServerAPIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authenticated {
            guard let token = KeychainStore.read(tokenKey) else { throw ServerAPIError.notPaired }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, urlResponse) = try await session.data(for: request)
        guard let http = urlResponse as? HTTPURLResponse else { throw ServerAPIError.invalidResponse }
        if http.statusCode == 409, let envelope = try? JSONDecoder().decode(RemoteStateEnvelope.self, from: data) {
            throw ServerAPIError.conflict(envelope)
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data).error) ?? "服务器请求失败（\(http.statusCode)）"
            throw ServerAPIError.server(message)
        }
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else { throw ServerAPIError.invalidResponse }
        return decoded
    }
}

private struct SyncRequest: Codable { let baseVersion: Int; let state: SavedState }
private struct AnalysisRequest: Codable { let description: String; let imageDataURL: String? }

private enum KeychainStore {
    static func save(_ value: String, key: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: Bundle.main.bundleIdentifier ?? "meal-meter",
                                    kSecAttrAccount as String: key]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw ServerAPIError.server("无法安全保存设备令牌（\(status)）") }
    }

    static func read(_ key: String) -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: Bundle.main.bundleIdentifier ?? "meal-meter",
                                    kSecAttrAccount as String: key,
                                    kSecReturnData as String: true,
                                    kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: Bundle.main.bundleIdentifier ?? "meal-meter",
                                    kSecAttrAccount as String: key]
        SecItemDelete(query as CFDictionary)
    }
}

private extension UIImage {
    func resizedForUpload(maxDimension: CGFloat) -> UIImage {
        let largest = max(size.width, size.height)
        guard largest > maxDimension else { return self }
        let scale = maxDimension / largest
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        return UIGraphicsImageRenderer(size: target).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
    }
}
