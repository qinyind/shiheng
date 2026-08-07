# 三端真机验收清单（食衡 · Expo）

> 覆盖 Web / iOS / Android 三个平台的手动核心流程。
> 自动化已覆盖：`npm test`（domain 单测 + 覆盖率）、`npm run build`（静态导出）、浏览器冒烟（旧数据迁移 + 加餐流）。
> 本清单补足自动化测不到的部分：真机手感、相机权限、离线、配对同步、跨设备合并。

## 环境准备

| 平台 | 方式 | 命令 |
|------|------|------|
| Web | Chrome 打开静态产物 | `npm run build && npm run start` → http://localhost:3000 |
| iOS | iPhone + Expo Go（与电脑同一 Wi-Fi） | `npm run dev` → 手机相机扫码 |
| Android | 安卓手机 + Expo Go（与电脑同一 Wi-Fi） | `npm run dev` → 手机相机扫码 |

配对同步需要先起 server：

```bash
cd services/server
cp .env.example .env        # 改 PAIRING_CODE 为长随机码（≥12 位）
docker compose up -d --build
curl http://127.0.0.1:18080/health   # 应返回 ok
```

- Web 配对填 `http://localhost:18080`；真机填 `http://<电脑局域网IP>:18080`
- AI 识餐需在 `.env` 配 `AI_API_KEY`，否则该功能报错

## A. 通用核心流（每个平台都过一遍）

- [ ] 启动：App 外壳渲染，显示「食衡」与今日热量环
- [ ] 4 个 Tab（今日 / 历史 / 食物 / 我的）切换正常
- [ ] 加餐：早饭添加「熟米饭 150g」→ 返回后餐卡出现该记录，热量环与三大营养素更新
- [ ] 删除记录：餐卡删除一条 → 热量回退
- [ ] 训练日 / 休息日切换：餐次方案变化，已有记录不丢
- [ ] 历史页：切换前一天 / 后一天，看到对应日期记录与训练日标记
- [ ] 自定义食物：食物页新增「自制酸奶」→ 加餐列表可选
- [ ] 我的页：改目标 / 训练安排 → 今日热量环目标随之变化

## B. Web 专属

- [ ] 旧数据迁移：升级前 localStorage 已有 `meal-meter-state-v1` → 首次打开自动迁移，数据保留
- [ ] 刷新页面数据不丢（localStorage 持久化）
- [ ] 桌面与手机宽度下布局正常

## C. iOS / Android 专属

- [ ] 相机权限弹窗 → 允许
- [ ] 冷启动后数据仍在（AsyncStorage / SecureStore）
- [ ] 断网记录一条 → 恢复联网 → 数据自动同步上去

## D. 配对同步（跨设备）

- [ ] 设备 A 配对成功（「我的」→ 服务器同步 → URL + 配对码）
- [ ] 设备 A 加一条记录 → 设备 B（同一 server）同步后能拉到
- [ ] 设备 B 改 profile → 设备 A 下次同步后更新（同 key 本地赢规则）
- [ ] 两台设备各删一条 → 墓碑合并后不复活

## E. AI 识餐（需 server 配 AI_API_KEY）

- [ ] 文字描述「熟米饭 200g，煎鸡胸肉 150g」→ 识别出食材与营养
- [ ] 拍照 / 选图 → 识别
- [ ] 手动校正某食材重量 → 总热量按比例更新
- [ ] 保存 → 记录进入所选餐次

## 结果记录

| 日期 | 平台 | 测试人 | 结果 | 备注 |
|------|------|--------|------|------|
|      | Web  |        |      |      |
|      | iOS  |        |      |      |
|      | Android |      |      |      |

## 已知限制

- 本机无 Xcode / Android SDK：iOS 与 Android 需真机 + Expo Go 扫码（或另装 SDK + AVD 跑模拟器）
- AI 识餐依赖 server 的 `AI_API_KEY`；未配置则提示错误
- 配对 URL：真机填 `http://<电脑局域网IP>:18080`，Web 填 `http://localhost:18080`
