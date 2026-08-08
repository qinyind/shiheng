// 冒烟：验证 jest-expo 基建可用（后续由组件测试 agent 扩充/替换）
test('jest-expo harness works', () => {
  expect(1 + 1).toBe(2)
})
