import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// server-setup 配对/同步 + AI 识餐 两条核心功能流的 Web E2E。
//
// - 不起真实后端：page.route('**/v1/**') 桩掉所有 /v1/* 请求，返回内存数据。
// - 生产构建里 __DEV__ = false，serverClient 只放行 https；桩服务器一律用 https://server.test。
// - CORS：跨域 fetch 带 Authorization + JSON body 会先发 OPTIONS 预检；route 桩必须应答预检并带 CORS 头，
//   否则浏览器层面拦截，app 永远收不到桩响应。
// - seedState 用 addInitScript，每次导航都会重跑，会覆盖已配对状态 —— 配对类断言避免 reload。
// - 日期相对断言，不写死绝对日期。
// ============================================================================

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
const TOKEN_KEY = 'meal-meter-device-token'
const SERVER_URL_KEY = 'meal-meter-server-url'

const SERVER_URL = 'https://server.test'
const TOKEN = 'test-token-abc123'

// 本地当天（与浏览器同机时区）。
function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function emptyState() {
  return {
    profile: DEFAULT_PROFILE,
    entries: [],
    customFoods: [],
    dayTypes: {},
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  }
}

// 在应用 hydration 前种入已配对状态（SavedState + token + serverURL 三键）。
// 注意：addInitScript 每次导航都会重跑并覆盖这组键，因此本 spec 内配对类断言不 reload。
async function seedPaired(page: Page, state: unknown) {
  await page.addInitScript(
    ([stateKey, tokenKey, urlKey, s, token, url]) => {
      localStorage.setItem(stateKey, JSON.stringify(s))
      localStorage.setItem(tokenKey, token)
      localStorage.setItem(urlKey, url)
    },
    [STATE_KEY, TOKEN_KEY, SERVER_URL_KEY, state, TOKEN, SERVER_URL],
  )
}

// ---- /v1/* 桩服务 ----

type Envelope = { version: number; state: unknown; updatedAt: string | null }

type StubOptions = {
  pairToken?: string
  initialSync?: Envelope
  putConflict?: Envelope // 第一次 PUT 返回 409 + 该信封（乐观锁冲突）
  putResponse?: Envelope
  estimate?: unknown // /v1/ai/analyze-food 的 estimate
  holdGetSync?: { promise: Promise<void> } // 挂起 GET /v1/sync 直到 resolve（模拟慢网同步在途）
  holdPutSync?: { promise: Promise<void> } // 挂起 PUT /v1/sync 直到 resolve（模拟 push 在途）
  onRequest?: (method: string, path: string, body?: unknown) => void
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

async function stubServer(page: Page, opts: StubOptions) {
  let putCount = 0
  await page.route('**/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname

    let body: unknown
    if (method === 'POST' || method === 'PUT') {
      try {
        body = JSON.parse(request.postData() || '{}')
      } catch {
        body = undefined
      }
    }
    opts.onRequest?.(method, path, body)

    const json = async (data: unknown, status = 200) => {
      await route.fulfill({ status, contentType: 'application/json', headers: corsHeaders(), body: JSON.stringify(data) })
    }

    // 预检：带 Authorization / JSON body 的跨域请求都会先发 OPTIONS。
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(), body: '' })
      return
    }
    if (path.endsWith('/v1/auth/pair')) return json({ token: opts.pairToken ?? TOKEN })
    if (path.endsWith('/v1/ai/analyze-food')) {
      if (!opts.estimate) return json({ error: 'estimate not stubbed' }, 500)
      return json({ estimate: opts.estimate })
    }
    if (path.endsWith('/v1/sync')) {
      if (method === 'GET') {
        if (opts.holdGetSync) await opts.holdGetSync.promise
        return json(opts.initialSync ?? { version: 1, state: null, updatedAt: null })
      }
      if (method === 'PUT') {
        if (opts.holdPutSync) await opts.holdPutSync.promise
        putCount += 1
        if (opts.putConflict && putCount === 1) return json(opts.putConflict, 409)
        return json(opts.putResponse ?? { version: 1, state: null, updatedAt: null })
      }
    }
    return json({ error: `unhandled ${method} ${path}` }, 404)
  })
}

async function gotoHome(page: Page) {
  await page.goto('/')
  await expect(page.getByText('食衡').first()).toBeVisible()
}

// 可控 promise：测试手动 resolve 来放行被挂起的请求（模拟慢网同步在途）。
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// 走完整 UI 加餐流程：在「午饭」添加 100g 熟米饭（与 flows.spec.ts 一致）。
async function addLunchRice(page: Page) {
  await page.getByLabel('在午饭添加食物').click()
  await expect(page.getByText('本餐推荐：').first()).toBeVisible()
  await page.getByText('熟米饭', { exact: true }).click()
  await page.getByLabel('克数').fill('100')
  await page.getByText('添加', { exact: true }).click()
  await expect(page.getByText('食衡').first()).toBeVisible()
}

// ---------------------------------------------------------------------------
// 1. 服务器配对流
// ---------------------------------------------------------------------------
test('配对：填 URL+配对码提交 → pair 被调、token 落盘、回首页已配对', async ({ page }) => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  await stubServer(page, {
    pairToken: TOKEN,
    onRequest: (method, path, body) => calls.push({ method, path, body }),
  })

  await gotoHome(page)
  // 未配对：首页同步状态为「仅保存在当前设备」
  await expect(page.getByText('已保存在当前设备').first()).toBeVisible()

  // 进配对屏
  await page.getByLabel('服务器配对').click()
  await expect(page.getByText('服务器配对').first()).toBeVisible()

  // 填 URL + 配对码并提交
  await page.getByPlaceholder('https://example.com').fill(SERVER_URL)
  await page.getByPlaceholder('6 位配对码').fill('123456')
  await page.getByText('配对并同步', { exact: true }).click()

  // pair 请求发出，body 携带配对码
  await expect.poll(() => calls.some((c) => c.method === 'POST' && c.path.endsWith('/v1/auth/pair'))).toBe(true)
  const pairCall = calls.find((c) => c.method === 'POST' && c.path.endsWith('/v1/auth/pair'))
  expect((pairCall?.body as { pairingCode?: string } | undefined)?.pairingCode).toBe('123456')

  // token 与 serverURL 落盘（localStorage）。pair() 内 serverURL 异步写入，poll 等待落盘而非一次读到旧值
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(TOKEN)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SERVER_URL_KEY)).toBe(SERVER_URL)

  // 配对后：同步成功 + 按钮切换为「立即同步」
  await expect(page.getByText('已与服务器同步').first()).toBeVisible()
  await expect(page.getByText('立即同步', { exact: true }).first()).toBeVisible()

  // 回首页 → 已配对状态（SPA history.back，不触发 reload，不重跑 seed）
  await page.evaluate(() => history.back())
  await expect(page.getByText('食衡').first()).toBeVisible()
  await expect(page.getByText('云端已同步').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2a. 同步流：首页加载自动拉取远端并合并展示
// ---------------------------------------------------------------------------
test('同步：已配对首页加载自动 GET+PUT，远端条目合并进 UI', async ({ page }) => {
  const today = todayKey()
  await seedPaired(page, emptyState())

  const remoteState = {
    profile: DEFAULT_PROFILE,
    entries: [
      { id: 'remote-1', dateKey: today, mealID: 'lunch', foodName: '香煎三文鱼', grams: 150, per100: { carbs: 0, protein: 22, fat: 12, kcal: 196 } },
    ],
    customFoods: [],
    dayTypes: {},
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  }

  const requests: string[] = []
  await stubServer(page, {
    initialSync: { version: 7, state: remoteState, updatedAt: '2026-08-08T10:00:00.000Z' },
    putResponse: { version: 8, state: null, updatedAt: '2026-08-08T10:00:01.000Z' },
    onRequest: (method, path) => requests.push(`${method} ${path}`),
  })

  await gotoHome(page)

  // 自动同步：GET 拉取远端 → PUT 推送合并结果
  await expect.poll(() => requests.filter((r) => r === 'GET /v1/sync').length).toBeGreaterThan(0)
  await expect.poll(() => requests.filter((r) => r === 'PUT /v1/sync').length).toBeGreaterThan(0)

  // 远端条目合并进首页 UI
  await expect(page.getByText('香煎三文鱼', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('150g', { exact: true }).first()).toBeVisible()

  // 同步状态已同步
  await expect(page.getByText('云端已同步').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2b. 同步流：PUT 409 冲突 → 取 latest 合并重试 → 最终一致不崩溃
// ---------------------------------------------------------------------------
test('同步：PUT 409 冲突时取 latest 合并重试，不崩溃且最终一致', async ({ page }) => {
  const today = todayKey()
  // 本地已有一条记录
  await seedPaired(page, {
    profile: DEFAULT_PROFILE,
    entries: [
      { id: 'local-1', dateKey: today, mealID: 'lunch', foodName: '熟米饭', grams: 100, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } },
    ],
    customFoods: [],
    dayTypes: {},
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  })

  // 远端：GET 返回 v1 空态；第一次 PUT(v1) 冲突，带回 v2 的更新状态
  const remoteLatest = {
    profile: DEFAULT_PROFILE,
    entries: [
      { id: 'remote-2', dateKey: today, mealID: 'dinner', foodName: '清蒸鲈鱼', grams: 200, per100: { carbs: 0, protein: 20, fat: 5, kcal: 125 } },
    ],
    customFoods: [],
    dayTypes: {},
    deletedEntryIDs: [],
    deletedFoodIDs: [],
  }

  const putBodies: Array<{ baseVersion?: number }> = []
  await stubServer(page, {
    initialSync: { version: 1, state: emptyState(), updatedAt: '2026-08-08T09:00:00.000Z' },
    putConflict: { version: 2, state: remoteLatest, updatedAt: '2026-08-08T09:00:01.000Z' },
    putResponse: { version: 2, state: null, updatedAt: '2026-08-08T09:00:02.000Z' },
    onRequest: (method, path, body) => {
      if (method === 'PUT') putBodies.push((body ?? {}) as { baseVersion?: number })
    },
  })

  await gotoHome(page)

  // 本地 + 远端(latest) 均被合并展示
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('清蒸鲈鱼', { exact: true }).first()).toBeVisible()

  // 冲突重试路径：第一次 PUT baseVersion=1 → 409；第二次 PUT baseVersion=2 → 200
  await expect.poll(() => putBodies.length).toBe(2)
  expect(putBodies[0].baseVersion).toBe(1)
  expect(putBodies[1].baseVersion).toBe(2)

  // 最终状态一致（已同步，未崩溃）
  await expect(page.getByText('云端已同步').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2c. 同步流：同步在途时新记录的餐不被旧快照覆盖丢失（数据丢失回归）
// ---------------------------------------------------------------------------
test('同步：同步在途时新记录的餐不被旧快照覆盖丢失', async ({ page }) => {
  const hold = deferred()
  const requests: string[] = []
  await seedPaired(page, emptyState())
  await stubServer(page, {
    holdGetSync: { promise: hold.promise },
    putResponse: { version: 2, state: null, updatedAt: '2026-08-08T10:00:02.000Z' },
    onRequest: (method, path) => requests.push(`${method} ${path}`),
  })

  await gotoHome(page)
  // 自动同步启动：GET 已发出（挂起中 = 同步在途）
  await expect.poll(() => requests.some((r) => r === 'GET /v1/sync')).toBe(true)

  // 同步在途时用户加餐（旧代码用同步开始时的旧快照，会把这餐整体覆盖丢掉）
  await addLunchRice(page)

  // 放行 GET，同步继续
  hold.resolve()
  await expect.poll(() => requests.some((r) => r === 'PUT /v1/sync')).toBe(true)

  // 新记录的餐必须仍在：UI 与 localStorage（持久化订阅写回）
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STATE_KEY)
  const names = (stored.entries ?? []).map((e: { foodName: string }) => e.foodName)
  expect(names).toContain('熟米饭')
})

// ---------------------------------------------------------------------------
// 2d. 同步流：push 在途时新记录的餐不被同步结果覆盖丢失（apply 前 re-read 回归）
// ---------------------------------------------------------------------------
test('同步：push 在途时新记录的餐不被同步结果覆盖丢失', async ({ page }) => {
  // 覆盖 syncNow 的 push 窗口（apply 前再次用最新 get() 合并）。
  // 若 revert 掉 apply 前的 re-read，这里 merged 在 push 发出时已定形，不含本餐，
  // applyState(remote.state ?? merged) 会把本餐整体覆盖掉 —— 本测试即失败。
  const holdPut = deferred()
  const requests: string[] = []
  await seedPaired(page, emptyState())
  await stubServer(page, {
    initialSync: { version: 1, state: emptyState(), updatedAt: '2026-08-08T09:00:00.000Z' },
    holdPutSync: { promise: holdPut.promise },
    putResponse: { version: 2, state: null, updatedAt: '2026-08-08T09:00:02.000Z' },
    onRequest: (method, path) => requests.push(`${method} ${path}`),
  })

  await gotoHome(page)
  // 自动同步：GET 完成、PUT 已发出（挂起中 = push 在途）
  await expect.poll(() => requests.some((r) => r === 'PUT /v1/sync')).toBe(true)

  // push 在途时用户加餐（merged 在 PUT 发出前已构建，不包含这餐）
  await addLunchRice(page)

  // 放行 PUT，同步收尾
  holdPut.resolve()
  await expect.poll(() => requests.filter((r) => r === 'PUT /v1/sync').length).toBeGreaterThanOrEqual(1)

  // 新记录的餐必须仍在：UI 与 localStorage
  await expect(page.getByText('熟米饭', { exact: true }).first()).toBeVisible()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STATE_KEY)
  const names = (stored.entries ?? []).map((e: { foodName: string }) => e.foodName)
  expect(names).toContain('熟米饭')
})

// ---------------------------------------------------------------------------
// 3. AI 识餐流
// ---------------------------------------------------------------------------
test('AI 识餐：输入描述→分析→展示 estimate→保存后首页出现条目', async ({ page }) => {
  await seedPaired(page, emptyState())

  const estimate = {
    name: '清炒虾仁',
    grams: 200,
    carbs: 4,
    protein: 26,
    fat: 1.2,
    kcal: 129,
    confidence: 'high',
    note: '估算含少量油',
    ingredients: [
      { name: '鲜虾仁', grams: 120, carbs: 1, protein: 24, fat: 1, kcal: 109 },
      { name: '芦笋', grams: 80, carbs: 3, protein: 2, fat: 0.2, kcal: 20 },
    ],
  }

  await stubServer(page, { estimate })

  await gotoHome(page)
  await page.getByText('AI 识餐 ✦').click()

  // 识餐屏
  await expect(page.getByText('说出来，或拍下来').first()).toBeVisible()

  // 只输入描述（不传图）
  await page.getByPlaceholder(/例如：/).fill('清炒虾仁 200g，用了约 8g 油')
  await page.getByText(/开始 AI 计算/).click()

  // 展示 estimate 结果
  await expect(page.getByText(/清炒虾仁 · 2 种基础食材/).first()).toBeVisible()
  await expect(page.getByText('置信度较高').first()).toBeVisible()
  await expect(page.getByText('估算含少量油').first()).toBeVisible()
  const nameInputs = page.getByLabel('基础食材')
  await expect(nameInputs).toHaveCount(2)
  await expect(nameInputs.first()).toHaveValue('鲜虾仁')
  await expect(nameInputs.nth(1)).toHaveValue('芦笋')

  // 保存两种食材并加入记录
  await expect(page.getByText('保存 2 种食材并加入记录', { exact: true }).first()).toBeVisible()
  await page.getByText('保存 2 种食材并加入记录', { exact: true }).click()

  // 回首页，条目出现
  await expect(page.getByText('食衡').first()).toBeVisible()
  await expect(page.getByText('鲜虾仁', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('芦笋', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('120g', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('80g', { exact: true }).first()).toBeVisible()

  // store（localStorage）出现对应条目
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), STATE_KEY)
  const names = (stored.entries ?? []).map((e: { foodName: string }) => e.foodName)
  expect(names).toContain('鲜虾仁')
  expect(names).toContain('芦笋')
})
