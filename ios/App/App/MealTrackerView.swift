import SwiftUI
import UIKit

private let brandGreen = Color(red: 0.05, green: 0.42, blue: 0.30)
private let brandLime = Color(red: 0.73, green: 0.89, blue: 0.30)

enum Sex: String, Codable, CaseIterable, Identifiable {
    case male, female
    var id: String { rawValue }
    var title: String { self == .male ? "男" : "女" }
}

enum Goal: String, Codable, CaseIterable, Identifiable {
    case cut, gain
    var id: String { rawValue }
    var title: String { self == .cut ? "减脂" : "增肌" }
}

enum TrainingLevel: String, Codable, CaseIterable, Identifiable {
    case beginner, intermediate, advanced
    var id: String { rawValue }
    var title: String {
        switch self {
        case .beginner: return "新手"
        case .intermediate: return "中级"
        case .advanced: return "高级"
        }
    }
}

enum TrainingTiming: String, Codable, CaseIterable, Identifiable {
    case breakfastEarly, breakfastLate, beforeLunch, afterLunch
    case beforeDinner, afterDinner, lateNight, none

    var id: String { rawValue }
    var title: String {
        switch self {
        case .breakfastEarly: return "早饭后练（早起）"
        case .breakfastLate: return "早饭后练（晚起）"
        case .beforeLunch: return "午饭前练"
        case .afterLunch: return "午饭后练"
        case .beforeDinner: return "晚饭前练"
        case .afterDinner: return "晚饭后练"
        case .lateNight: return "夜里练"
        case .none: return "无力训"
        }
    }
}

enum DayType: String, Codable, CaseIterable, Identifiable {
    case training, rest
    var id: String { rawValue }
    var title: String { self == .training ? "训练日" : "休息日" }
}

struct Profile: Codable, Equatable {
    var sex: Sex = .male
    var age: Int = 27
    var height: Double = 180
    var weight: Double = 73
    var goal: Goal = .cut
    var timing: TrainingTiming = .beforeDinner
    var level: TrainingLevel = .beginner
    var cardioDaily: Double = 100
}

struct Macro: Codable, Equatable {
    var carbs: Double = 0
    var protein: Double = 0
    var fat: Double = 0
    var kcal: Double = 0

    static func + (lhs: Macro, rhs: Macro) -> Macro {
        Macro(carbs: lhs.carbs + rhs.carbs,
              protein: lhs.protein + rhs.protein,
              fat: lhs.fat + rhs.fat,
              kcal: lhs.kcal + rhs.kcal)
    }

    func scaled(by value: Double) -> Macro {
        Macro(carbs: carbs * value, protein: protein * value,
              fat: fat * value, kcal: kcal * value)
    }
}

struct MealPreset: Identifiable, Hashable {
    let id: String
    let name: String
    let note: String
    let carbShare: Double
    let proteinShare: Double
}

struct Food: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var category: String
    var per100: Macro
}

struct FoodEntry: Identifiable, Codable, Hashable {
    let id: UUID
    let dateKey: String
    let mealID: String
    let foodName: String
    let grams: Double
    let per100: Macro

    var macro: Macro { per100.scaled(by: grams / 100) }
}

extension Macro: Hashable {}

struct SavedState: Codable {
    var profile: Profile
    var entries: [FoodEntry]
    var customFoods: [Food]
    var dayTypes: [String: DayType]
    var deletedEntryIDs: Set<UUID>? = nil
    var deletedFoodIDs: Set<String>? = nil
}

enum SyncState: Equatable {
    case local, syncing, synced, error(String)
    var title: String {
        switch self {
        case .local: return "仅保存在本机"
        case .syncing: return "正在同步…"
        case .synced: return "已与服务器同步"
        case .error(let message): return message
        }
    }
}

@MainActor
final class MealStore: ObservableObject {
    @Published var profile: Profile { didSet { save() } }
    @Published var entries: [FoodEntry] { didSet { save() } }
    @Published var customFoods: [Food] { didSet { save() } }
    @Published var dayTypes: [String: DayType] { didSet { save() } }
    @Published var selectedDate = Date()
    @Published var serverURL: String { didSet { UserDefaults.standard.set(serverURL, forKey: "meal-meter-server-url") } }
    @Published var syncState: SyncState = .local

    private let storageKey = "meal-meter-native-state-v1"
    private var deletedEntryIDs: Set<UUID> = []
    private var deletedFoodIDs: Set<String> = []

    init() {
        profile = Profile()
        entries = []
        customFoods = []
        dayTypes = [:]
        serverURL = UserDefaults.standard.string(forKey: "meal-meter-server-url") ?? ""
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let state = try? JSONDecoder().decode(SavedState.self, from: data) else { return }
        profile = state.profile
        entries = state.entries
        customFoods = state.customFoods
        dayTypes = state.dayTypes
        deletedEntryIDs = state.deletedEntryIDs ?? []
        deletedFoodIDs = state.deletedFoodIDs ?? []
        if !serverURL.isEmpty && ServerClient.shared.isPaired { syncState = .synced }
    }

    var foods: [Food] { Self.builtInFoods + customFoods }
    var dateKey: String { Self.key(for: selectedDate) }
    var effectiveDayType: DayType {
        if profile.timing == .none { return .rest }
        return dayTypes[dateKey] ?? .training
    }
    var target: Macro { targets(for: effectiveDayType) }
    var meals: [MealPreset] { mealPresets(for: effectiveDayType) }
    var todayEntries: [FoodEntry] { entries.filter { $0.dateKey == dateKey } }
    var consumed: Macro { todayEntries.reduce(Macro()) { $0 + $1.macro } }
    var planLabel: String {
        let timings = TrainingTiming.allCases
        let timingIndex = timings.firstIndex(of: profile.timing) ?? 0
        let number = profile.goal == .cut ? timingIndex + 1 : timingIndex + 9
        return "\(number) \(profile.goal.title) · \(profile.timing.title)"
    }

    func entries(for mealID: String) -> [FoodEntry] {
        todayEntries.filter { $0.mealID == mealID }
    }

    func consumed(for mealID: String) -> Macro {
        entries(for: mealID).reduce(Macro()) { $0 + $1.macro }
    }

    func target(for meal: MealPreset) -> Macro {
        let daily = target
        return Macro(carbs: daily.carbs * meal.carbShare,
                     protein: daily.protein * meal.proteinShare,
                     fat: daily.fat * meal.proteinShare,
                     kcal: daily.kcal * ((meal.carbShare + meal.proteinShare) / 2))
    }

    func add(food: Food, grams: Double, mealID: String) {
        entries.append(FoodEntry(id: UUID(), dateKey: dateKey, mealID: mealID,
                                 foodName: food.name, grams: grams, per100: food.per100))
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    func remove(_ entry: FoodEntry) {
        deletedEntryIDs.insert(entry.id)
        entries.removeAll { $0.id == entry.id }
    }

    func setDayType(_ type: DayType) {
        dayTypes[dateKey] = type
    }

    func addCustomFood(name: String, category: String, macro: Macro) {
        customFoods.append(Food(id: "custom-\(UUID().uuidString)", name: name,
                                category: category, per100: macro))
    }

    func removeCustomFood(at offsets: IndexSet) {
        for index in offsets { deletedFoodIDs.insert(customFoods[index].id) }
        customFoods.remove(atOffsets: offsets)
    }

    var isServerPaired: Bool { !serverURL.isEmpty && ServerClient.shared.isPaired }

    func pair(serverURL: String, pairingCode: String) async {
        syncState = .syncing
        do {
            try await ServerClient.shared.pair(serverURL: serverURL, pairingCode: pairingCode)
            self.serverURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            try await syncNow()
        } catch {
            syncState = .error(error.localizedDescription)
        }
    }

    func disconnectServer() {
        ServerClient.shared.disconnect()
        syncState = .local
    }

    func syncNow() async throws {
        guard isServerPaired else { throw ServerAPIError.notPaired }
        syncState = .syncing
        do {
            var remote = try await ServerClient.shared.fetchState(serverURL: serverURL)
            var merged = remote.state.map { merge(local: snapshot(), remote: $0) } ?? snapshot()
            do {
                remote = try await ServerClient.shared.pushState(serverURL: serverURL, state: merged, baseVersion: remote.version)
            } catch ServerAPIError.conflict(let latest) {
                if let latestState = latest.state { merged = merge(local: merged, remote: latestState) }
                remote = try await ServerClient.shared.pushState(serverURL: serverURL, state: merged, baseVersion: latest.version)
            }
            apply(remote.state ?? merged)
            syncState = .synced
        } catch {
            syncState = .error(error.localizedDescription)
            throw error
        }
    }

    func analyzeFood(description: String, image: UIImage?) async throws -> NutritionEstimate {
        guard isServerPaired else { throw ServerAPIError.notPaired }
        return try await ServerClient.shared.analyze(serverURL: serverURL, description: description, image: image)
    }

    func add(estimate: NutritionEstimate, mealID: String, saveCustom: Bool) {
        let food = Food(id: "ai-\(UUID().uuidString)", name: estimate.name, category: "AI 识别", per100: estimate.per100)
        if saveCustom { customFoods.append(food) }
        add(food: food, grams: estimate.grams, mealID: mealID)
    }

    func totals(for key: String) -> Macro {
        entries.filter { $0.dateKey == key }.reduce(Macro()) { $0 + $1.macro }
    }

    func targets(for type: DayType) -> Macro {
        let bmr = profile.weight * 9.99 + profile.height * 6.25 - Double(profile.age) * 4.92 + (profile.sex == .male ? 5 : -161)
        let base = bmr / 0.7
        let strengthValues: [Double] = profile.sex == .male ? [150, 200, 250] : [100, 150, 200]
        let levelIndex = TrainingLevel.allCases.firstIndex(of: profile.level) ?? 0
        let strength = profile.timing == .none ? 0 : strengthValues[levelIndex]
        let maintenance = base + profile.cardioDaily + (type == .training ? strength : 0)
        let factor = profile.goal == .cut ? 0.64 : 0.84
        let fat: Double = profile.goal == .cut
            ? (profile.weight >= 120 ? 70 : profile.sex == .male ? 60 : 50)
            : (profile.sex == .male ? 80 : 70)
        let kcal = maintenance * factor
        let remaining = Swift.max(0.0, kcal - fat * 9)
        let carbRatio = profile.goal == .cut ? 0.64 : 0.70
        let protein = remaining * (1 - carbRatio) / 4
        let trainingCarbs = remaining * carbRatio / 4
        let restCarbs = Swift.max(0.0, (kcal - fat * 9 - protein * 4) / 4)
        let carbs = type == .training ? trainingCarbs : restCarbs
        return Macro(carbs: carbs, protein: protein, fat: fat, kcal: kcal)
    }

    func mealPresets(for type: DayType) -> [MealPreset] {
        if type == .rest {
            return [
                MealPreset(id: "breakfast", name: "早饭", note: "稳定开启一天", carbShare: 0.20, proteinShare: 0.20),
                MealPreset(id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.30),
                MealPreset(id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.30),
                MealPreset(id: "snack", name: "零食 / 夜宵", note: "为漏算预留", carbShare: 0.10, proteinShare: 0.20)
            ]
        }
        switch profile.timing {
        case .breakfastEarly:
            return fiveMeals("早饭 · 练前", "练后餐", "午饭", "晚饭", 0.15, 0.35, 0.20, 0.20)
        case .breakfastLate:
            return fourMeals("早饭 · 练前", "午饭 · 练后", "晚饭", 0.20, 0.40, 0.30)
        case .beforeLunch:
            return standardMeals(pre: "练前餐", post: "午饭 · 练后", other: "晚饭")
        case .afterLunch:
            return standardMeals(pre: "午饭 · 练前", post: "练后餐", other: "晚饭")
        case .beforeDinner:
            return standardMeals(pre: "练前餐", post: "晚饭 · 练后", other: "午饭", otherBeforePre: true)
        case .afterDinner:
            return standardMeals(pre: "晚饭 · 练前", post: "练后餐", other: "午饭", otherBeforePre: true)
        case .lateNight:
            return fiveMeals("早饭", "午饭", "晚饭", "夜间练后餐", 0.20, 0.20, 0.20, 0.30)
        case .none:
            return mealPresets(for: .rest)
        }
    }

    private func standardMeals(pre: String, post: String, other: String, otherBeforePre: Bool = false) -> [MealPreset] {
        let first = MealPreset(id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.20, proteinShare: 0.20)
        let preMeal = MealPreset(id: "pre", name: pre, note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0)
        let postMeal = MealPreset(id: "post", name: post, note: "全天最大餐", carbShare: 0.35, proteinShare: 0.30)
        let otherMeal = MealPreset(id: "other", name: other, note: "其他餐", carbShare: 0.20, proteinShare: 0.30)
        let snack = MealPreset(id: "snack", name: "零食 / 夜宵", note: "为漏算预留", carbShare: 0.10, proteinShare: 0.20)
        return otherBeforePre ? [first, otherMeal, preMeal, postMeal, snack] : [first, preMeal, postMeal, otherMeal, snack]
    }

    private func fiveMeals(_ a: String, _ b: String, _ c: String, _ d: String,
                           _ aShare: Double, _ bShare: Double, _ cShare: Double, _ dShare: Double) -> [MealPreset] {
        [MealPreset(id: "a", name: a, note: "按训练安排", carbShare: aShare, proteinShare: 0.20),
         MealPreset(id: "b", name: b, note: "按训练安排", carbShare: bShare, proteinShare: 0.20),
         MealPreset(id: "c", name: c, note: "其他餐", carbShare: cShare, proteinShare: 0.20),
         MealPreset(id: "d", name: d, note: "其他餐", carbShare: dShare, proteinShare: 0.20),
         MealPreset(id: "snack", name: "零食 / 夜宵", note: "为漏算预留", carbShare: 0.10, proteinShare: 0.20)]
    }

    private func fourMeals(_ a: String, _ b: String, _ c: String,
                           _ aShare: Double, _ bShare: Double, _ cShare: Double) -> [MealPreset] {
        [MealPreset(id: "a", name: a, note: "训练前主餐", carbShare: aShare, proteinShare: 0.20),
         MealPreset(id: "b", name: b, note: "全天最大餐", carbShare: bShare, proteinShare: 0.30),
         MealPreset(id: "c", name: c, note: "其他餐", carbShare: cShare, proteinShare: 0.30),
         MealPreset(id: "snack", name: "零食 / 夜宵", note: "为漏算预留", carbShare: 0.10, proteinShare: 0.20)]
    }

    private func save() {
        let state = snapshot()
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func snapshot() -> SavedState {
        SavedState(profile: profile, entries: entries, customFoods: customFoods, dayTypes: dayTypes,
                   deletedEntryIDs: deletedEntryIDs, deletedFoodIDs: deletedFoodIDs)
    }

    private func apply(_ state: SavedState) {
        deletedEntryIDs = state.deletedEntryIDs ?? []
        deletedFoodIDs = state.deletedFoodIDs ?? []
        profile = state.profile
        entries = state.entries.filter { !deletedEntryIDs.contains($0.id) }
        customFoods = state.customFoods.filter { !deletedFoodIDs.contains($0.id) }
        dayTypes = state.dayTypes
        save()
    }

    private func merge(local: SavedState, remote: SavedState) -> SavedState {
        let entryTombstones = (local.deletedEntryIDs ?? []).union(remote.deletedEntryIDs ?? [])
        let foodTombstones = (local.deletedFoodIDs ?? []).union(remote.deletedFoodIDs ?? [])
        let entries = Dictionary((remote.entries + local.entries).map { ($0.id, $0) }, uniquingKeysWith: { _, local in local })
            .values.filter { !entryTombstones.contains($0.id) }.sorted { $0.dateKey < $1.dateKey }
        let foods = Dictionary((remote.customFoods + local.customFoods).map { ($0.id, $0) }, uniquingKeysWith: { _, local in local })
            .values.filter { !foodTombstones.contains($0.id) }
        return SavedState(profile: local.profile, entries: Array(entries), customFoods: Array(foods),
                          dayTypes: remote.dayTypes.merging(local.dayTypes) { _, local in local },
                          deletedEntryIDs: entryTombstones, deletedFoodIDs: foodTombstones)
    }

    static func key(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static let builtInFoods: [Food] = [
        Food(id: "rice", name: "熟米饭", category: "主食", per100: Macro(carbs: 30, protein: 2.6, fat: 0.3, kcal: 133)),
        Food(id: "mantou", name: "馒头 / 花卷", category: "主食", per100: Macro(carbs: 50, protein: 7, fat: 1, kcal: 237)),
        Food(id: "oats", name: "速食燕麦片", category: "主食", per100: Macro(carbs: 60, protein: 13.5, fat: 7, kcal: 367)),
        Food(id: "sweet-potato", name: "蒸煮红薯", category: "主食", per100: Macro(carbs: 18, protein: 1.6, fat: 0.2, kcal: 80)),
        Food(id: "potato", name: "蒸煮土豆", category: "主食", per100: Macro(carbs: 18, protein: 2, fat: 0.1, kcal: 81)),
        Food(id: "bread", name: "切片面包", category: "主食", per100: Macro(carbs: 50, protein: 9, fat: 4, kcal: 272)),
        Food(id: "banana", name: "香蕉", category: "水果", per100: Macro(carbs: 22, protein: 1.1, fat: 0.3, kcal: 89)),
        Food(id: "apple", name: "苹果", category: "水果", per100: Macro(carbs: 14, protein: 0.3, fat: 0.2, kcal: 57)),
        Food(id: "chicken", name: "熟鸡胸肉", category: "蛋白质", per100: Macro(carbs: 0, protein: 25, fat: 4, kcal: 136)),
        Food(id: "lean-meat", name: "一般熟瘦肉", category: "蛋白质", per100: Macro(carbs: 0, protein: 25, fat: 6, kcal: 154)),
        Food(id: "fish", name: "熟鱼虾", category: "蛋白质", per100: Macro(carbs: 0, protein: 23, fat: 3, kcal: 119)),
        Food(id: "egg", name: "全蛋", category: "蛋白质", per100: Macro(carbs: 1.1, protein: 12.6, fat: 10.6, kcal: 143)),
        Food(id: "milk", name: "全脂牛奶", category: "蛋白质", per100: Macro(carbs: 4.8, protein: 3.2, fat: 3.3, kcal: 61)),
        Food(id: "whey", name: "蛋白粉", category: "蛋白质", per100: Macro(carbs: 8, protein: 75, fat: 6, kcal: 386)),
        Food(id: "tofu", name: "豆腐", category: "蛋白质", per100: Macro(carbs: 3, protein: 7, fat: 5, kcal: 85)),
        Food(id: "nuts", name: "混合坚果", category: "脂肪", per100: Macro(carbs: 18, protein: 20, fat: 50, kcal: 602)),
        Food(id: "oil", name: "烹调油", category: "脂肪", per100: Macro(carbs: 0, protein: 0, fat: 100, kcal: 900)),
        Food(id: "broccoli", name: "西兰花", category: "蔬菜", per100: Macro(carbs: 7, protein: 2.8, fat: 0.4, kcal: 34))
    ]
}

struct MealTrackerRootView: View {
    @StateObject private var store = MealStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView {
            TodayView(store: store)
                .tabItem { Label("今日", systemImage: "fork.knife") }
            HistoryView(store: store)
                .tabItem { Label("历史", systemImage: "calendar") }
            FoodLibraryView(store: store)
                .tabItem { Label("食物", systemImage: "leaf") }
            ProfileView(store: store)
                .tabItem { Label("我的", systemImage: "person.crop.circle") }
        }
        .accentColor(brandGreen)
        .task {
            if store.isServerPaired { try? await store.syncNow() }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active && store.isServerPaired {
                Task { try? await store.syncNow() }
            }
        }
    }
}

private struct TodayView: View {
    @ObservedObject var store: MealStore
    @State private var selectedMeal: MealPreset?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 18) {
                    dateBar
                    dayTypePicker
                    SummaryCard(store: store)
                    recommendation
                    ForEach(store.meals) { meal in
                        MealCard(store: store, meal: meal) { selectedMeal = meal }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
            .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
            .navigationTitle("餐标")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Text(store.effectiveDayType.title)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(brandGreen)
                }
            }
            .sheet(item: $selectedMeal) { meal in
                AddFoodView(store: store, meal: meal)
            }
        }
        .navigationViewStyle(.stack)
    }

    private var dateBar: some View {
        HStack {
            Button { store.selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: store.selectedDate) ?? store.selectedDate } label: {
                Image(systemName: "chevron.left")
            }
            DatePicker("日期", selection: $store.selectedDate, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
            Button { store.selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: store.selectedDate) ?? store.selectedDate } label: {
                Image(systemName: "chevron.right")
            }
            Spacer()
            if !Calendar.current.isDateInToday(store.selectedDate) {
                Button("今天") { store.selectedDate = Date() }
                    .font(.subheadline.weight(.semibold))
            }
        }
        .padding(.top, 4)
    }

    private var dayTypePicker: some View {
        Picker("日期类型", selection: Binding(get: { store.effectiveDayType }, set: { store.setDayType($0) })) {
            ForEach(DayType.allCases) { Text($0.title).tag($0) }
        }
        .pickerStyle(.segmented)
        .disabled(store.profile.timing == .none)
    }

    private var recommendation: some View {
        let leftCarbs = max(0, store.target.carbs - store.consumed.carbs)
        let leftProtein = max(0, store.target.protein - store.consumed.protein)
        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles")
                .font(.title3)
                .foregroundColor(brandGreen)
            VStack(alignment: .leading, spacing: 4) {
                Text("下一餐建议").font(.subheadline.weight(.semibold))
                Text(leftProtein > 25
                     ? "蛋白质还差 \(Int(leftProtein.rounded()))g，优先鸡胸肉、鱼虾或蛋白粉；碳水还可安排 \(Int(leftCarbs.rounded()))g。"
                     : "蛋白质接近目标，按剩余 \(Int(leftCarbs.rounded()))g 碳水选择米饭、红薯或水果。")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding(16)
        .background(brandLime.opacity(0.20), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct SummaryCard: View {
    @ObservedObject var store: MealStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("今日摄入").font(.caption.weight(.semibold)).foregroundColor(brandLime)
                    Text("\(Int(store.consumed.kcal.rounded()))")
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                    Text("目标 \(Int(store.target.kcal.rounded())) kcal")
                        .font(.caption).foregroundColor(.white.opacity(0.68))
                }
                Spacer()
                ZStack {
                    Circle().stroke(Color.white.opacity(0.14), lineWidth: 9)
                    Circle()
                        .trim(from: 0, to: min(1, store.target.kcal > 0 ? store.consumed.kcal / store.target.kcal : 0))
                        .stroke(brandLime, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(Int(min(999, store.target.kcal > 0 ? store.consumed.kcal / store.target.kcal * 100 : 0)))%")
                        .font(.caption.weight(.bold))
                }
                .frame(width: 76, height: 76)
            }
            MacroProgress(label: "碳水", value: store.consumed.carbs, target: store.target.carbs, color: .orange)
            MacroProgress(label: "蛋白质", value: store.consumed.protein, target: store.target.protein, color: brandLime)
            MacroProgress(label: "脂肪", value: store.consumed.fat, target: store.target.fat, color: .yellow)
            Divider().overlay(Color.white.opacity(0.15))
            Text(store.planLabel).font(.caption).foregroundColor(.white.opacity(0.72))
        }
        .padding(20)
        .foregroundColor(.white)
        .background(
            LinearGradient(colors: [Color(red: 0.08, green: 0.16, blue: 0.12), brandGreen],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
    }
}

private struct MacroProgress: View {
    let label: String
    let value: Double
    let target: Double
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(label).font(.caption)
                Spacer()
                Text("\(value, specifier: "%.1f") / \(target, specifier: "%.1f")g")
                    .font(.caption2.monospacedDigit())
                    .foregroundColor(value > target * 1.1 ? .red : .white.opacity(0.82))
            }
            ProgressView(value: min(value, target), total: max(target, 1)).tint(color)
        }
    }
}

private struct MealCard: View {
    @ObservedObject var store: MealStore
    let meal: MealPreset
    let onAdd: () -> Void

    var body: some View {
        let target = store.target(for: meal)
        let consumed = store.consumed(for: meal.id)
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(meal.name).font(.headline)
                    Text(meal.note).font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                Button(action: onAdd) {
                    Image(systemName: "plus").font(.headline)
                        .frame(width: 36, height: 36)
                        .background(brandGreen, in: Circle()).foregroundColor(.white)
                }
                .accessibilityLabel("给\(meal.name)添加食物")
            }
            HStack(spacing: 14) {
                smallMetric("碳水", consumed.carbs, target.carbs)
                smallMetric("蛋白", consumed.protein, target.protein)
                smallMetric("脂肪", consumed.fat, target.fat)
                smallMetric("热量", consumed.kcal, target.kcal, unit: "k")
            }
            if store.entries(for: meal.id).isEmpty {
                Button(action: onAdd) {
                    Label("记录这餐吃了什么", systemImage: "plus.circle")
                        .font(.subheadline).foregroundColor(brandGreen)
                }
            } else {
                ForEach(store.entries(for: meal.id)) { entry in
                    HStack {
                        Image(systemName: "leaf.fill").font(.caption).foregroundColor(brandGreen)
                        VStack(alignment: .leading) {
                            Text(entry.foodName).font(.subheadline)
                            Text("\(Int(entry.grams.rounded()))g · \(Int(entry.macro.kcal.rounded())) kcal")
                                .font(.caption2).foregroundColor(.secondary)
                        }
                        Spacer()
                        Button { store.remove(entry) } label: {
                            Image(systemName: "trash").foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(18)
        .background(Color(UIColor.secondarySystemGroupedBackground),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func smallMetric(_ label: String, _ value: Double, _ target: Double, unit: String = "g") -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text("\(Int(value.rounded()))/\(Int(target.rounded()))\(unit)")
                .font(.caption.weight(.semibold)).monospacedDigit()
                .foregroundColor(value > target * 1.1 ? .red : .primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AddFoodView: View {
    @ObservedObject var store: MealStore
    let meal: MealPreset
    @Environment(\.dismiss) private var dismiss
    @State private var foodID = "rice"
    @State private var grams = 150.0
    @State private var showAI = false

    var body: some View {
        NavigationView {
            Form {
                Section("食物") {
                    Picker("选择食物", selection: $foodID) {
                        ForEach(store.foods) { food in
                            Text("\(food.name) · \(food.category)").tag(food.id)
                        }
                    }
                    TextField("重量（克）", value: $grams, format: .number)
                        .keyboardType(.decimalPad)
                }
                if let food = store.foods.first(where: { $0.id == foodID }) {
                    let estimate = food.per100.scaled(by: grams / 100)
                    Section("本次估算") {
                        HStack { Text("热量"); Spacer(); Text("\(Int(estimate.kcal.rounded())) kcal") }
                        HStack { Text("碳水"); Spacer(); Text("\(estimate.carbs, specifier: "%.1f")g") }
                        HStack { Text("蛋白质"); Spacer(); Text("\(estimate.protein, specifier: "%.1f")g") }
                        HStack { Text("脂肪"); Spacer(); Text("\(estimate.fat, specifier: "%.1f")g") }
                    }
                }
                Section("智能识餐") {
                    Button { showAI = true } label: {
                        Label("用文字或照片自动计算", systemImage: "camera.macro")
                    }
                    Text(store.isServerPaired ? "AI 会估算整份食物，确认后可直接记入本餐并保存为自定义食物。" : "请先在“我的方案”中连接服务器。")
                        .font(.footnote).foregroundColor(.secondary)
                }
            }
            .navigationTitle(meal.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("添加") {
                        guard let food = store.foods.first(where: { $0.id == foodID }), grams > 0 else { return }
                        store.add(food: food, grams: grams, mealID: meal.id)
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
            .sheet(isPresented: $showAI) { AIAnalyzeView(store: store, meal: meal) }
        }
    }
}

private struct AIAnalyzeView: View {
    @ObservedObject var store: MealStore
    let meal: MealPreset
    @Environment(\.dismiss) private var dismiss
    @State private var description = ""
    @State private var image: UIImage?
    @State private var showPicker = false
    @State private var estimate: NutritionEstimate?
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var saveCustom = true

    var body: some View {
        NavigationView {
            Form {
                Section("描述食物") {
                    TextEditor(text: $description).frame(minHeight: 90)
                    Text("示例：熟米饭 150g、煎鸡胸肉 180g，用油约 8g")
                        .font(.caption).foregroundColor(.secondary)
                    Button { showPicker = true } label: {
                        Label(image == nil ? "选择食物或营养标签照片" : "重新选择照片", systemImage: "photo")
                    }
                    if let image { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 180).clipShape(RoundedRectangle(cornerRadius: 12)) }
                }
                if let estimate {
                    Section("AI 估算 · 整份") {
                        HStack { Text(estimate.name).font(.headline); Spacer(); Text("约 \(Int(estimate.grams.rounded()))g") }
                        HStack { Text("碳水"); Spacer(); Text("\(estimate.carbs, specifier: "%.1f")g") }
                        HStack { Text("蛋白质"); Spacer(); Text("\(estimate.protein, specifier: "%.1f")g") }
                        HStack { Text("脂肪"); Spacer(); Text("\(estimate.fat, specifier: "%.1f")g") }
                        HStack { Text("热量"); Spacer(); Text("\(Int(estimate.kcal.rounded())) kcal") }
                        Text(estimate.note).font(.caption).foregroundColor(.secondary)
                        Toggle("保存为自定义食物", isOn: $saveCustom)
                        Button("记入\(meal.name)") {
                            store.add(estimate: estimate, mealID: meal.id, saveCustom: saveCustom)
                            dismiss()
                        }.font(.body.weight(.semibold))
                    }
                }
                if !errorMessage.isEmpty { Section { Text(errorMessage).foregroundColor(.red).font(.footnote) } }
                Section {
                    Button {
                        Task { await analyze() }
                    } label: {
                        HStack { Spacer(); if isLoading { ProgressView().padding(.trailing, 8) }; Text(isLoading ? "正在识别" : "开始计算"); Spacer() }
                    }
                    .disabled(isLoading || (description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && image == nil) || !store.isServerPaired)
                }
            }
            .navigationTitle("AI 识餐")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
            .sheet(isPresented: $showPicker) { ImagePicker(image: $image) }
        }
    }

    @MainActor private func analyze() async {
        isLoading = true
        errorMessage = ""
        defer { isLoading = false }
        do { estimate = try await store.analyzeFood(description: description, image: image) }
        catch { errorMessage = error.localizedDescription }
    }
}

private struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss
    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .photoLibrary
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: ImagePicker
        init(parent: ImagePicker) { self.parent = parent }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

private struct HistoryView: View {
    @ObservedObject var store: MealStore

    private var keys: [String] {
        Array(Set(store.entries.map(\.dateKey))).sorted(by: >)
    }

    var body: some View {
        NavigationView {
            Group {
                if keys.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "calendar.badge.plus").font(.system(size: 40)).foregroundColor(brandGreen)
                        Text("还没有饮食记录").font(.headline)
                        Text("在“今日”中添加第一餐后会自动出现在这里。")
                            .font(.subheadline).foregroundColor(.secondary).multilineTextAlignment(.center)
                    }.padding(32)
                } else {
                    List(keys, id: \.self) { key in
                        let total = store.totals(for: key)
                        Button {
                            let formatter = DateFormatter()
                            formatter.dateFormat = "yyyy-MM-dd"
                            if let date = formatter.date(from: key) { store.selectedDate = date }
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(key).font(.headline).foregroundColor(.primary)
                                    Spacer()
                                    Text("\(Int(total.kcal.rounded())) kcal").font(.subheadline.weight(.semibold)).foregroundColor(brandGreen)
                                }
                                Text("碳水 \(Int(total.carbs.rounded()))g  ·  蛋白质 \(Int(total.protein.rounded()))g  ·  脂肪 \(Int(total.fat.rounded()))g")
                                    .font(.caption).foregroundColor(.secondary)
                            }.padding(.vertical, 6)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("历史记录")
        }
        .navigationViewStyle(.stack)
    }
}

private struct FoodLibraryView: View {
    @ObservedObject var store: MealStore
    @State private var search = ""
    @State private var showAdd = false

    private var filtered: [Food] {
        search.isEmpty ? store.foods : store.foods.filter { $0.name.localizedCaseInsensitiveContains(search) || $0.category.contains(search) }
    }

    var body: some View {
        NavigationView {
            List {
                ForEach(filtered) { food in
                    HStack(spacing: 12) {
                        Image(systemName: icon(for: food.category))
                            .frame(width: 34, height: 34).foregroundColor(brandGreen)
                            .background(brandGreen.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(food.name).font(.subheadline.weight(.semibold))
                            Text("每100g · 碳水 \(food.per100.carbs, specifier: "%.1f")g · 蛋白 \(food.per100.protein, specifier: "%.1f")g · 脂肪 \(food.per100.fat, specifier: "%.1f")g")
                                .font(.caption2).foregroundColor(.secondary)
                        }
                    }.padding(.vertical, 4)
                }
                if !store.customFoods.isEmpty {
                    Section("自定义食物") {
                        ForEach(store.customFoods) { Text($0.name) }
                            .onDelete(perform: store.removeCustomFood)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $search, prompt: "搜索食物")
            .navigationTitle("食物库")
            .toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }
            .sheet(isPresented: $showAdd) { AddCustomFoodView(store: store) }
        }
        .navigationViewStyle(.stack)
    }

    private func icon(for category: String) -> String {
        switch category {
        case "主食": return "takeoutbag.and.cup.and.straw.fill"
        case "水果": return "apple.logo"
        case "蛋白质": return "bolt.heart.fill"
        case "脂肪": return "drop.fill"
        default: return "leaf.fill"
        }
    }
}

private struct AddCustomFoodView: View {
    @ObservedObject var store: MealStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var category = "自定义"
    @State private var carbs = 0.0
    @State private var protein = 0.0
    @State private var fat = 0.0
    @State private var kcal = 0.0

    var body: some View {
        NavigationView {
            Form {
                Section("基本信息") {
                    TextField("食物名称", text: $name)
                    TextField("分类", text: $category)
                }
                Section("每 100g 营养") {
                    numberField("碳水", value: $carbs, unit: "g")
                    numberField("蛋白质", value: $protein, unit: "g")
                    numberField("脂肪", value: $fat, unit: "g")
                    numberField("热量", value: $kcal, unit: "kcal")
                }
            }
            .navigationTitle("自定义食物")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        store.addCustomFood(name: name, category: category,
                                            macro: Macro(carbs: carbs, protein: protein, fat: fat, kcal: kcal))
                        dismiss()
                    }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func numberField(_ label: String, value: Binding<Double>, unit: String) -> some View {
        HStack { Text(label); Spacer(); TextField("0", value: value, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing); Text(unit).foregroundColor(.secondary) }
    }
}

private struct ProfileView: View {
    @ObservedObject var store: MealStore
    @State private var showServer = false

    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: "figure.strengthtraining.traditional")
                            .font(.title2).foregroundColor(brandGreen)
                            .frame(width: 46, height: 46)
                            .background(brandGreen.opacity(0.10), in: Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(store.planLabel).font(.headline)
                            Text("BMI \(store.profile.weight / pow(store.profile.height / 100, 2), specifier: "%.1f") · 数据保存在此 iPhone")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }.padding(.vertical, 4)
                }
                Section("身体数据") {
                    Picker("性别", selection: $store.profile.sex) { ForEach(Sex.allCases) { Text($0.title).tag($0) } }
                    Stepper("年龄  \(store.profile.age) 岁", value: $store.profile.age, in: 15...80)
                    measurementField("身高", value: $store.profile.height, unit: "cm")
                    measurementField("体重", value: $store.profile.weight, unit: "kg")
                }
                Section("训练方案") {
                    Picker("目标", selection: $store.profile.goal) { ForEach(Goal.allCases) { Text($0.title).tag($0) } }
                    Picker("训练时段", selection: $store.profile.timing) {
                        ForEach(TrainingTiming.allCases.filter { store.profile.goal == .cut || $0 != .none }) { Text($0.title).tag($0) }
                    }
                    Picker("训练水平", selection: $store.profile.level) { ForEach(TrainingLevel.allCases) { Text($0.title).tag($0) } }
                    measurementField("每日有氧消耗", value: $store.profile.cardioDaily, unit: "kcal")
                }
                Section("当前每日目标") {
                    let target = store.target
                    HStack { Text("碳水"); Spacer(); Text("\(Int(target.carbs.rounded()))g") }
                    HStack { Text("蛋白质"); Spacer(); Text("\(Int(target.protein.rounded()))g") }
                    HStack { Text("脂肪"); Spacer(); Text("\(Int(target.fat.rounded()))g") }
                    HStack { Text("热量"); Spacer(); Text("\(Int(target.kcal.rounded())) kcal") }
                }
                Section("服务器同步") {
                    HStack {
                        Label(store.syncState.title, systemImage: store.isServerPaired ? "checkmark.icloud" : "icloud.slash")
                            .font(.footnote).foregroundColor(store.isServerPaired ? brandGreen : .secondary)
                        Spacer()
                        if case .syncing = store.syncState { ProgressView() }
                    }
                    if store.isServerPaired {
                        Button("立即同步") { Task { try? await store.syncNow() } }
                    }
                    Button(store.isServerPaired ? "服务器设置" : "连接自己的服务器") { showServer = true }
                    Text(store.isServerPaired ? "身体数据、饮食历史和自定义食物会通过 HTTPS 同步；OpenAI 密钥只保存在服务器。" : "不连接时仍可完整离线使用，数据只保存在此 iPhone。")
                        .font(.footnote).foregroundColor(.secondary)
                }
            }
            .navigationTitle("我的方案")
            .sheet(isPresented: $showServer) { ServerSetupView(store: store) }
        }
        .navigationViewStyle(.stack)
    }

    private func measurementField(_ label: String, value: Binding<Double>, unit: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("0", value: value, format: .number)
                .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 90)
            Text(unit).foregroundColor(.secondary)
        }
    }
}

private struct ServerSetupView: View {
    @ObservedObject var store: MealStore
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    @State private var pairingCode = ""
    @State private var working = false

    var body: some View {
        NavigationView {
            Form {
                Section("服务器地址") {
                    TextField("https://meals.example.com", text: $url)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("服务器配对码", text: $pairingCode)
                    Text("正式版本只接受 HTTPS。配对成功后，设备令牌保存在 iPhone 钥匙串中。")
                        .font(.caption).foregroundColor(.secondary)
                }
                Section {
                    Button {
                        working = true
                        Task {
                            await store.pair(serverURL: url, pairingCode: pairingCode)
                            working = false
                            if store.isServerPaired { dismiss() }
                        }
                    } label: {
                        HStack { Spacer(); if working { ProgressView().padding(.trailing, 8) }; Text("连接并同步"); Spacer() }
                    }.disabled(working || url.isEmpty || pairingCode.isEmpty)
                    if store.isServerPaired {
                        Button("断开此设备", role: .destructive) { store.disconnectServer(); dismiss() }
                    }
                }
                if case .error(let message) = store.syncState {
                    Section("连接结果") { Text(message).font(.footnote).foregroundColor(.red) }
                }
            }
            .navigationTitle("服务器设置")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { url = store.serverURL }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("关闭") { dismiss() } } }
        }
    }
}
