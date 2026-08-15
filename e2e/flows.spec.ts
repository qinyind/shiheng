import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// 食衡 Web 关键流程 E2E（跑在真实静态产物 apps/expo/dist，经 webServer 托管）
// - 定位策略：Pressable 在 react-native-web 下渲染成无 role 的 div，
//   带 accessibilityLabel 的用 getByLabel，纯文本按钮用 getByText。
//   底部 tab 有 role="tab"，可用 getByRole('tab', …)。
// - 每个 test 独立 context（Playwright 默认隔离 localStorage）。
// - 日期一律相对断言，不写死绝对日期。
// ============================================================================

// 与 packages/domain DEFAULT_PROFILE 一致。
const DEFAULT_PROFILE = {
  sex: 'male',
  age: 27,
  height: 180,
  weight: 73,
  goal: 'cut',
  timing: 'beforeDinner',
  level: 'beginner',
  cardioDaily: 100,
}

const STATE_KEY = 'meal-meter-native-state-v1'

// 本地当天（与浏览器同机时区）。
function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// "2026-08-08" → "8月8日"（history 行日期 formatDate().split(' ')[0]）。
function monthDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}月${d}日`
}

// 在应用 hydration 前把 SavedState 种进 localStorage。
// 注意：addInitScript 会把函数序列化到浏览器执行，外层闭包变量不会带上，
// 因此 STORE 键与状态都必须作为 arg 传入。
async function seedState(page: Page, state: unknown) {
  await page.addInitScript(([key, s]) => {
    localStorage.setItem(key, JSON.stringify(s))
  }, [STATE_KEY, state])
}

async function gotoHome(page: Page) {
  await page.goto('/')
  await expect(page.getByText('食衡').first()).toBeVisible()
}

// 走完整 UI 加餐流程：在「午饭」添加 100g 熟米饭。
async function addLunchRice(page: Page) {
  await page.getByLabel('在午饭添加食物').click()
  await expect(page.getByText('本餐推荐：').first()).toBeVisible()
  await page.getByText('熟米饭', { exact: true }).click()
  await page.getByLabel('克数').fill('100')
  await page.getByText('添加', { exact: true }).click()
  // 回到首页
  await expect(page.getByText('食衡').first()).toBeVisible()
}

// ---------------------------------------------------------------------------
// 1. 首页渲染默认数据
// ---------------------------------------------------------------------------
test('首页渲染默认数据（1738 kcal / 108g 蛋白 / 力训日）', async ({ page }) => {
  await gotoHome(page)

  // hero 快捷数据（体重/BMI 已按精简需求移除，只保留 kcal + 蛋白质）
  await expect(page.getByText('1738', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('108', { exact: true }).first()).toBeVisible()

  // 默认力训日：汇总卡标题 + 方案标题
  await expect(page.getByText('力训日 · 减脂配额').first()).toBeVisible()
  await expect(page.getByText(/5 减脂/).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. 日期导航
// ---------------------------------------------------------------------------
test('日期导航：左右箭头相对切换日期', async ({ page }) => {
  await gotoHome(page)

  const dateLabel = page.getByText(/月\d+日 周/)
  const before = (await dateLabel.textContent()) ?? ''
  expect(before).not.toBe('')

  // 后一天 → 日期变化
  await page.getByLabel('后一天').click()
  await expect(dateLabel).not.toHaveText(before)
  const afterNext = (await dateLabel.textContent()) ?? ''
  expect(afterNext).not.toBe(before)

  // 前一天 → 回到原日期；再点前一天 → 又变化
  await page.getByLabel('前一天').click()
  await expect(dateLabel).toHaveText(before)
  await page.getByLabel('前一天').click()
  await expect(dateLabel).not.toHaveText(before)
})

// ---------------------------------------------------------------------------
// 3. 加餐流程
// ---------------------------------------------------------------------------
test('加餐：选食物+克数保存，条目出现且当日 kcal 汇总更新', async ({ page }) => {
  await gotoHome(page)

  // 打开午饭加餐屏（路由 /add-food?mealID=lunch）
  await page.getByLabel('在午饭添加食物').click()
  await expect(page.getByText('本餐推荐：').first()).toBeVisible()
  expect(page.url()).toContain('/add-food')

  // 选食物（熟米饭）并设克数
  await page.getByText('熟米饭', { exact: true }).click()
  await page.getByLabel('克数').fill('100')
  await page.getByText('添加', { exact: true }).click()

  // 回到首页：条目出现，当日 kcal 汇总更新（133 kcal）
  await expect(page.getByText('食衡').first()).toBeVisible()
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('100g', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('133', { exact: true }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. 训练日切换
// ---------------------------------------------------------------------------
test('训练日切换：切到休息日后计划标题与目标变化', async ({ page }) => {
  await gotoHome(page)

  // 默认力训日
  await expect(page.getByText('力训日 · 减脂配额').first()).toBeVisible()

  // 切到休息日
  await page.getByText('休息日', { exact: true }).click()

  await expect(page.getByText('休息日 · 减脂配额').first()).toBeVisible()
  await expect(page.getByText('今天是休息日').first()).toBeVisible()
  // 休息日 kcal 目标（1642）更新
  await expect(page.getByText('1642', { exact: true }).first()).toBeVisible()

  // 切回力训日
  await page.getByText('力训日', { exact: true }).click()
  await expect(page.getByText('力训日 · 减脂配额').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 5. 历史页
// ---------------------------------------------------------------------------
test('历史页：有记录时渲染历史行', async ({ page }) => {
  const today = todayKey()
  await seedState(page, {
    profile: DEFAULT_PROFILE,
    entries: [
      { id: 'e1', dateKey: today, mealID: 'lunch', foodName: '熟米饭', grams: 100, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } },
      { id: 'e2', dateKey: today, mealID: 'dinner', foodName: '熟鸡胸肉', grams: 150, per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 } },
    ],
    customFoods: [],
    dayTypes: { [today]: 'training' },
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  })

  await gotoHome(page)
  // 确认 seed 已生效（hydration 完成后首页能见到该条目），再进历史页
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: '历史' }).click()

  // 不再显示空态
  await expect(page.getByText('还没有历史记录').first()).not.toBeVisible()
  // 当天行：日期、力训日元信息（体重已移出）、汇总 kcal 337
  await expect(page.getByText(monthDay(today), { exact: true }).first()).toBeVisible()
  await expect(page.getByText('力训日', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('337').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 6. 数据持久化
// ---------------------------------------------------------------------------
test('数据持久化：加餐后 reload 条目仍在（localStorage）', async ({ page }) => {
  await gotoHome(page)
  await addLunchRice(page)

  // 已写入 localStorage
  const stored = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)
  expect(stored).toContain('熟米饭')

  // reload 后条目仍在
  await page.reload()
  await expect(page.getByText('食衡').first()).toBeVisible()
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('100g', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('133', { exact: true }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 7. 回归：切换方案后 pre 条目不被迁移改写
// ---------------------------------------------------------------------------
test('回归：timing 变更后 pre 条目不被迁移改写（mealID 保持 pre）', async ({ page }) => {
  // 模拟：条目在旧 timing（beforeDinner 的练前餐=pre）记录，后切换为 afterDinner。
  // 旧代码的 applyState 迁移会把 pre 静默改写成 dinner；修复后必须保持 pre。
  const today = todayKey()
  await seedState(page, {
    profile: { ...DEFAULT_PROFILE, timing: 'afterDinner' },
    entries: [
      { id: 'e1', dateKey: today, mealID: 'pre', foodName: '香蕉', grams: 100, per100: { carbs: 22, protein: 1.1, fat: 0.3, kcal: 89 } },
    ],
    customFoods: [],
    dayTypes: { [today]: 'training' },
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  })

  await gotoHome(page)
  // 等 hydration 的持久化订阅把状态写回 localStorage（Web 端为同步 setItem）
  await page.waitForFunction((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    try {
      const s = JSON.parse(raw)
      return Array.isArray(s.entries) && s.entries.some((e: { id: string }) => e.id === 'e1')
    } catch {
      return false
    }
  }, STATE_KEY)

  const stored = await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)
  const parsed = stored ? JSON.parse(stored) : null
  expect(parsed.entries.find((e: { id: string }) => e.id === 'e1').mealID).toBe('pre')
})
