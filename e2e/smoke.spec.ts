import { test, expect } from '@playwright/test'

// 冒烟：验证 Playwright 基建 + Web 静态产物可渲染
// （关键流程测试由 E2E agent 扩充到本目录）
test('home page renders with default profile data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('食衡').first()).toBeVisible({ timeout: 30_000 })
})
