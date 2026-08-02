import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("contains the finished meal tracker experience", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"餐标｜每日饮食指标与逐餐记录"/);
  assert.match(page, /5 减脂 · 晚饭前练/);
  assert.match(page, /13 增肌 · 晚饭前练/);
  assert.match(page, /meal-meter-state-v1/);
  assert.match(page, /\/api\/sync/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("packages a self-contained iOS client without embedded ChatGPT sign-in", async () => {
  const [config, index, assetNames] = await Promise.all([
    readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../capacitor-shell/index.html", import.meta.url), "utf8"),
    readdir(new URL("../capacitor-shell/assets/", import.meta.url)),
  ]);

  assert.doesNotMatch(config, /\bserver\s*:/);
  assert.doesNotMatch(config, /chatgpt\.site|auth\.openai\.com/);
  assert.match(index, /<div id="root"><\/div>/);
  assert.match(index, /\.\/assets\/index-[^"']+\.js/);
  assert.ok(assetNames.some((name) => /^index-.+\.js$/.test(name)));
  assert.ok(assetNames.some((name) => /^index-.+\.css$/.test(name)));

  const scriptName = assetNames.find((name) => /^index-.+\.js$/.test(name));
  assert.ok(scriptName);
  const script = await readFile(
    new URL(`../capacitor-shell/assets/${scriptName}`, import.meta.url),
    "utf8",
  );
  assert.match(script, /meal-meter-state-v1/);
});
