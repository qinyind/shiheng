"use client";

import { useEffect, useMemo, useState } from "react";

type Sex = "male" | "female";
type Goal = "cut" | "gain";
type Level = "beginner" | "intermediate" | "advanced";
type Timing =
  | "breakfastEarly"
  | "breakfastLate"
  | "beforeLunch"
  | "afterLunch"
  | "beforeDinner"
  | "afterDinner"
  | "lateNight"
  | "none";
type DayType = "training" | "rest";

type Profile = {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  goal: Goal;
  timing: Timing;
  level: Level;
  cardioDaily: number;
};

type Macro = { carbs: number; protein: number; fat: number; kcal: number };
type MealPreset = {
  id: string;
  name: string;
  note: string;
  carbShare: number;
  proteinShare: number;
};
type Food = Macro & { id: string; name: string; category: string; unit?: string };
type AiEstimate = Macro & {
  name: string;
  grams: number;
  confidence: "low" | "medium" | "high";
  note: string;
};
type FoodEntry = {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  per100: Macro;
};
type DayLog = Record<string, FoodEntry[]>;
type DayMeta = {
  dayType: DayType;
  target: Macro;
  planLabel: string;
  weight: number;
  meals: MealPreset[];
};

const FOODS: Food[] = [
  { id: "rice", name: "熟米饭", category: "主食", carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 },
  { id: "mantou", name: "馒头 / 花卷", category: "主食", carbs: 50, protein: 7, fat: 1, kcal: 237 },
  { id: "oats", name: "速食燕麦片", category: "主食", carbs: 60, protein: 13.5, fat: 7, kcal: 367 },
  { id: "sweet-potato", name: "蒸煮红薯", category: "主食", carbs: 18, protein: 1.6, fat: 0.2, kcal: 80 },
  { id: "potato", name: "蒸煮土豆", category: "主食", carbs: 18, protein: 2, fat: 0.1, kcal: 81 },
  { id: "bread", name: "切片面包", category: "主食", carbs: 50, protein: 9, fat: 4, kcal: 272 },
  { id: "banana", name: "香蕉（可食部）", category: "水果", carbs: 22, protein: 1.1, fat: 0.3, kcal: 89 },
  { id: "apple", name: "苹果（可食部）", category: "水果", carbs: 14, protein: 0.3, fat: 0.2, kcal: 57 },
  { id: "chicken", name: "熟鸡胸肉", category: "蛋白质", carbs: 0, protein: 25, fat: 4, kcal: 136 },
  { id: "lean-meat", name: "一般熟瘦肉", category: "蛋白质", carbs: 0, protein: 25, fat: 6, kcal: 154 },
  { id: "fish", name: "熟鱼虾", category: "蛋白质", carbs: 0, protein: 23, fat: 3, kcal: 119 },
  { id: "egg", name: "全蛋", category: "蛋白质", carbs: 1.1, protein: 12.6, fat: 10.6, kcal: 143 },
  { id: "milk", name: "全脂牛奶", category: "蛋白质", carbs: 4.8, protein: 3.2, fat: 3.3, kcal: 61 },
  { id: "whey", name: "蛋白粉", category: "蛋白质", carbs: 8, protein: 75, fat: 6, kcal: 386 },
  { id: "tofu", name: "豆腐", category: "蛋白质", carbs: 3, protein: 7, fat: 5, kcal: 85 },
  { id: "nuts", name: "混合坚果", category: "脂肪", carbs: 18, protein: 20, fat: 50, kcal: 602 },
  { id: "oil", name: "烹调油（实际摄入）", category: "脂肪", carbs: 0, protein: 0, fat: 100, kcal: 900 },
  { id: "broccoli", name: "西兰花", category: "蔬菜", carbs: 7, protein: 2.8, fat: 0.4, kcal: 34 },
];

const PLAN_OPTIONS: Array<{ goal: Goal; timing: Timing; label: string }> = [
  { goal: "cut", timing: "breakfastEarly", label: "1 减脂 · 早饭后练（早起）" },
  { goal: "cut", timing: "breakfastLate", label: "2 减脂 · 早饭后练（晚起）" },
  { goal: "cut", timing: "beforeLunch", label: "3 减脂 · 午饭前练" },
  { goal: "cut", timing: "afterLunch", label: "4 减脂 · 午饭后练" },
  { goal: "cut", timing: "beforeDinner", label: "5 减脂 · 晚饭前练" },
  { goal: "cut", timing: "afterDinner", label: "6 减脂 · 晚饭后练" },
  { goal: "cut", timing: "lateNight", label: "7 减脂 · 夜里练" },
  { goal: "cut", timing: "none", label: "8 减脂 · 无力训者" },
  { goal: "gain", timing: "breakfastEarly", label: "9 增肌 · 早饭后练（早起）" },
  { goal: "gain", timing: "breakfastLate", label: "10 增肌 · 早饭后练（晚起）" },
  { goal: "gain", timing: "beforeLunch", label: "11 增肌 · 午饭前练" },
  { goal: "gain", timing: "afterLunch", label: "12 增肌 · 午饭后练" },
  { goal: "gain", timing: "beforeDinner", label: "13 增肌 · 晚饭前练" },
  { goal: "gain", timing: "afterDinner", label: "14 增肌 · 晚饭后练" },
  { goal: "gain", timing: "lateNight", label: "15 增肌 · 夜里练" },
];

const REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "稳定开启一天", carbShare: 0.2, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

const EARLY_REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "与训练日早饭一致", carbShare: 0.15, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

function trainingMeals(timing: Timing): MealPreset[] {
  switch (timing) {
    case "breakfastEarly":
      return [
        { id: "breakfast-pre", name: "早饭 · 练前", note: "少量、易消化", carbShare: 0.15, proteinShare: 0.2 },
        { id: "post", name: "练后餐", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "breakfastLate":
      return [
        { id: "breakfast-pre", name: "早饭 · 练前", note: "训练前主餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch-post", name: "午饭 · 练后", note: "全天最大餐", carbShare: 0.4, proteinShare: 0.3 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.3, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "beforeLunch":
      return standardTimedMeals("练前餐", "午饭 · 练后", "晚饭", "before-lunch");
    case "afterLunch":
      return standardTimedMeals("午饭 · 练前", "练后餐", "晚饭", "after-lunch");
    case "beforeDinner":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.3 },
        { id: "pre", name: "练前餐", note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 },
        { id: "dinner-post", name: "晚饭 · 练后", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "afterDinner":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.3 },
        { id: "dinner-pre", name: "晚饭 · 练前", note: "控制到五六分饱", carbShare: 0.15, proteinShare: 0 },
        { id: "post", name: "练后餐", note: "补充碳水和蛋白质", carbShare: 0.35, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "lateNight":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "post", name: "夜间练后餐", note: "训练后的主要补给", carbShare: 0.3, proteinShare: 0.2 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    default:
      return REST_MEALS;
  }
}

function standardTimedMeals(preName: string, postName: string, dinnerName: string, key: string): MealPreset[] {
  const preIsLunch = key === "after-lunch";
  return [
    { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
    { id: "pre", name: preName, note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 },
    { id: "post", name: postName, note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
    { id: "dinner", name: dinnerName, note: preIsLunch ? "训练后的其他餐" : "其他餐", carbShare: 0.2, proteinShare: 0.3 },
    { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
  ];
}

const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 27,
  height: 180,
  weight: 73,
  goal: "cut",
  timing: "beforeDinner",
  level: "beginner",
  cardioDaily: 100,
};

function strengthCalories(sex: Sex, level: Level) {
  const table = sex === "male" ? [150, 200, 250] : [100, 150, 200];
  return table[level === "beginner" ? 0 : level === "intermediate" ? 1 : 2];
}

function calculate(profile: Profile) {
  const { sex, age, height, weight, goal, cardioDaily, level, timing } = profile;
  const bmr = weight * 9.99 + height * 6.25 - age * 4.92 + (sex === "male" ? 5 : -161);
  const base = bmr / 0.7;
  const strength = timing === "none" ? 0 : strengthCalories(sex, level);
  const trainMaintenance = base + strength + cardioDaily;
  const restMaintenance = base + cardioDaily;
  const factor = goal === "cut" ? 0.64 : 0.84;
  const fat = goal === "cut" ? (weight >= 120 ? 70 : sex === "male" ? 60 : 50) : sex === "male" ? 80 : 70;
  const trainingKcal = trainMaintenance * factor;
  const restKcal = restMaintenance * factor;
  const remaining = Math.max(0, trainingKcal - fat * 9);
  const carbRatio = goal === "cut" ? 0.64 : 0.7;
  const proteinRatio = 1 - carbRatio;
  const protein = (remaining * proteinRatio) / 4;
  const trainingCarbs = (remaining * carbRatio) / 4;
  const restCarbs = Math.max(0, (restKcal - fat * 9 - protein * 4) / 4);
  return { bmr, base, strength, trainMaintenance, restMaintenance, trainingKcal, restKcal, fat, protein, trainingCarbs, restCarbs };
}

function macroForFood(entry: FoodEntry): Macro {
  const scale = entry.grams / 100;
  return {
    carbs: entry.per100.carbs * scale,
    protein: entry.per100.protein * scale,
    fat: entry.per100.fat * scale,
    kcal: entry.per100.kcal * scale,
  };
}

function sumMacros(entries: FoodEntry[]): Macro {
  return entries.reduce(
    (sum, entry) => {
      const m = macroForFood(entry);
      return { carbs: sum.carbs + m.carbs, protein: sum.protein + m.protein, fat: sum.fat + m.fat, kcal: sum.kcal + m.kcal };
    },
    { carbs: 0, protein: 0, fat: 0, kcal: 0 },
  );
}

function round(value: number, digits = 0) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Progress({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? (value / target) * 100 : value > 0 ? 120 : 0;
  const over = pct > 110;
  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <strong className={over ? "danger-text" : ""}>{round(value, 1)} / {round(target, 1)}g</strong>
      </div>
      <div className="progress-track"><span style={{ width: `${Math.min(pct, 100)}%`, background: over ? "var(--red)" : color }} /></div>
    </div>
  );
}

function getRecommendation(target: Macro, total: Macro) {
  const remain = {
    carbs: target.carbs - total.carbs,
    protein: target.protein - total.protein,
    fat: target.fat - total.fat,
  };
  if (remain.carbs < -5 || remain.protein < -5 || remain.fat < -4) {
    return { text: "本餐已有指标超出，接下来优先选择无油蔬菜或停止加餐。", foodId: "broccoli", grams: 150 };
  }
  if (remain.protein > 10) {
    const food = FOODS.find((f) => f.id === "chicken")!;
    return { text: `还差约 ${round(remain.protein)}g 蛋白质，可补 ${round((remain.protein / food.protein) * 100)}g 熟鸡胸肉。`, foodId: food.id, grams: round((remain.protein / food.protein) * 100) };
  }
  if (remain.carbs > 12) {
    const food = FOODS.find((f) => f.id === "rice")!;
    return { text: `还差约 ${round(remain.carbs)}g 碳水，可补 ${round((remain.carbs / food.carbs) * 100)}g 熟米饭。`, foodId: food.id, grams: round((remain.carbs / food.carbs) * 100) };
  }
  if (remain.fat > 7) {
    const food = FOODS.find((f) => f.id === "nuts")!;
    return { text: `脂肪还有余量，可补约 ${round((remain.fat / food.fat) * 100)}g 坚果。`, foodId: food.id, grams: round((remain.fat / food.fat) * 100) };
  }
  return { text: "本餐已经接近目标，搭配一份清淡蔬菜即可。", foodId: "broccoli", grams: 150 };
}

function AiFoodAnalyzer({ onSave }: { onSave: (food: Food) => void }) {
  const [description, setDescription] = useState("");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [estimate, setEstimate] = useState<AiEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function chooseImage(file?: File) {
    setError("");
    setSaved(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择照片或图片文件。");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("图片请控制在 8MB 以内。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result || ""));
      setImageName(file.name);
    };
    reader.onerror = () => setError("图片读取失败，请重新选择。");
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!description.trim() && !imageData) {
      setError("请先写下食物和份量，或拍一张照片。");
      return;
    }
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: description.trim(), image: imageData || undefined }),
      });
      const data = await response.json() as { estimate?: AiEstimate; error?: string };
      if (!response.ok || !data.estimate) throw new Error(data.error || "暂时无法完成识别，请稍后重试。");
      setEstimate(data.estimate);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成识别，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function updateEstimate<K extends keyof AiEstimate>(key: K, value: AiEstimate[K]) {
    setEstimate((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }

  function saveFood() {
    if (!estimate || estimate.grams <= 0 || !estimate.name.trim()) return;
    const scale = 100 / estimate.grams;
    onSave({
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: estimate.name.trim(),
      category: "我的食物",
      carbs: round(Math.max(0, estimate.carbs) * scale, 2),
      protein: round(Math.max(0, estimate.protein) * scale, 2),
      fat: round(Math.max(0, estimate.fat) * scale, 2),
      kcal: round(Math.max(0, estimate.kcal) * scale, 1),
    });
    setSaved(true);
  }

  const confidenceLabel = estimate?.confidence === "high" ? "较高" : estimate?.confidence === "medium" ? "中等" : "较低";

  return (
    <section className="ai-card" id="ai-food">
      <div className="ai-copy">
        <p className="eyebrow">03 · AI 智能识餐</p>
        <h2>说出来，或拍下来</h2>
        <p>描述食物、重量和烹饪方式，或拍摄餐盘 / 营养标签。AI 会估算整份营养；保存前可以手动校正。</p>
        <div className="ai-tips"><span>写清生重 / 熟重</span><span>带上油与酱料</span><span>照片尽量俯拍</span></div>
      </div>

      <div className="ai-input-panel">
        <label className="ai-text-label"><span>文字描述</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：熟米饭 200g，煎鸡胸肉 150g，用了约 8g 油；或输入包装营养成分表" /></label>
        <div className="photo-row">
          <label className="photo-button"><input type="file" accept="image/*" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])} /><span>{imageData ? "更换照片" : "拍照 / 选图"}</span></label>
          {imageData ? <div className="photo-preview"><img src={imageData} alt="待识别食物预览" /><span>{imageName}</span><button onClick={() => { setImageData(""); setImageName(""); }} aria-label="移除照片">×</button></div> : <p>支持餐盘、外卖、包装标签，最大 8MB</p>}
        </div>
        <button className="analyze-button" onClick={analyze} disabled={loading}>{loading ? "正在分析营养…" : "开始 AI 计算"}<span>✦</span></button>
        {error && <p className="ai-error" role="alert">{error}</p>}
      </div>

      {estimate && (
        <div className="ai-result">
          <div className="ai-result-head"><div><span>AI 估算结果</span><strong>置信度{confidenceLabel}</strong></div><p>{estimate.note}</p></div>
          <div className="estimate-grid">
            <label className="estimate-name"><span>保存名称</span><input value={estimate.name} onChange={(event) => updateEstimate("name", event.target.value)} /></label>
            <label><span>整份重量</span><div><input type="number" min="1" value={estimate.grams} onChange={(event) => updateEstimate("grams", Number(event.target.value))} /><b>g</b></div></label>
            {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
              <label key={key}><span>{key === "carbs" ? "整份碳水" : key === "protein" ? "整份蛋白质" : key === "fat" ? "整份脂肪" : "整份热量"}</span><div><input type="number" min="0" step="0.1" value={round(estimate[key], 1)} onChange={(event) => updateEstimate(key, Number(event.target.value))} /><b>{key === "kcal" ? "kcal" : "g"}</b></div></label>
            ))}
          </div>
          <div className="save-result-row"><p>保存后会自动换算为每 100g 营养，并出现在所有餐次的“我的食物”中。</p><button onClick={saveFood} disabled={saved}>{saved ? "已保存到我的食物" : "保存为自定义食物"}</button></div>
        </div>
      )}
    </section>
  );
}

function MealCard({ meal, target, entries, foods, onAdd, onRemove }: {
  meal: MealPreset;
  target: Macro;
  entries: FoodEntry[];
  foods: Food[];
  onAdd: (entry: FoodEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [foodId, setFoodId] = useState("rice");
  const [grams, setGrams] = useState(100);
  const [custom, setCustom] = useState({ name: "", carbs: 0, protein: 0, fat: 0, kcal: 0 });
  const total = useMemo(() => sumMacros(entries), [entries]);
  const recommendation = getRecommendation(target, total);
  const maxRatio = Math.max(
    target.carbs ? total.carbs / target.carbs : total.carbs ? 2 : 0,
    target.protein ? total.protein / target.protein : total.protein ? 2 : 0,
    target.fat ? total.fat / target.fat : total.fat ? 2 : 0,
  );
  const status = !entries.length ? "待记录" : maxRatio > 1.1 ? "有超标" : maxRatio >= 0.8 ? "接近目标" : "还可补充";

  function addFood() {
    if (!grams || grams <= 0) return;
    const food = foods.find((item) => item.id === foodId);
    const per100 = foodId === "custom"
      ? { carbs: custom.carbs, protein: custom.protein, fat: custom.fat, kcal: custom.kcal || custom.carbs * 4 + custom.protein * 4 + custom.fat * 9 }
      : food!;
    const name = foodId === "custom" ? custom.name || "自定义食物" : food!.name;
    onAdd({ id: `${Date.now()}-${Math.random()}`, foodId, name, grams, per100 });
  }

  function applyRecommendation() {
    setFoodId(recommendation.foodId);
    setGrams(Math.max(1, recommendation.grams));
  }

  return (
    <article className="meal-card">
      <header className="meal-head">
        <div>
          <p className="eyebrow">{meal.note}</p>
          <h3>{meal.name}</h3>
        </div>
        <span className={`status ${status === "有超标" ? "status-danger" : status === "接近目标" ? "status-good" : ""}`}>{status}</span>
      </header>

      <div className="meal-targets">
        <Progress label="碳水" value={total.carbs} target={target.carbs} color="var(--carb)" />
        <Progress label="蛋白质" value={total.protein} target={target.protein} color="var(--protein)" />
        <Progress label="脂肪" value={total.fat} target={target.fat} color="var(--fat)" />
      </div>

      {entries.length > 0 && (
        <div className="food-list">
          {entries.map((entry) => {
            const macro = macroForFood(entry);
            return (
              <div className="food-row" key={entry.id}>
                <div><strong>{entry.name}</strong><span>{round(entry.grams)}g · {round(macro.kcal)} kcal</span></div>
                <div className="food-macros">C {round(macro.carbs, 1)} · P {round(macro.protein, 1)} · F {round(macro.fat, 1)}</div>
                <button className="icon-button" onClick={() => onRemove(entry.id)} aria-label={`删除${entry.name}`}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="add-food">
        <select value={foodId} onChange={(e) => setFoodId(e.target.value)} aria-label="选择食物">
          {[...new Set(foods.map((f) => f.category))].map((category) => (
            <optgroup key={category} label={category}>
              {foods.filter((f) => f.category === category).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
            </optgroup>
          ))}
          <option value="custom">＋ 自定义食物</option>
        </select>
        <label className="gram-input"><input type="number" min="1" value={grams} onChange={(e) => setGrams(Number(e.target.value))} /><span>克</span></label>
        <button className="add-button" onClick={addFood}>添加</button>
      </div>
      {foodId === "custom" && (
        <div className="custom-food">
          <input placeholder="食物名称" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
            <label key={key}><span>{key === "carbs" ? "碳水" : key === "protein" ? "蛋白质" : key === "fat" ? "脂肪" : "热量"}/100g</span><input type="number" min="0" value={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: Number(e.target.value) })} /></label>
          ))}
        </div>
      )}

      <button className="recommendation" onClick={applyRecommendation}>
        <span className="spark">✦</span><span><b>本餐推荐</b>{recommendation.text}</span><span className="arrow">↗</span>
      </button>
    </article>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [dayType, setDayType] = useState<DayType>("training");
  const [date, setDate] = useState(todayString());
  const [logs, setLogs] = useState<Record<string, DayLog>>({});
  const [metas, setMetas] = useState<Record<string, DayMeta>>({});
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("meal-meter-state-v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.logs) setLogs(parsed.logs);
        if (parsed.metas) setMetas(parsed.metas);
        if (Array.isArray(parsed.customFoods)) setCustomFoods(parsed.customFoods);
      }
    } catch { /* device-local storage is optional */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("meal-meter-state-v1", JSON.stringify({ profile, logs, metas, customFoods }));
  }, [profile, logs, metas, customFoods, ready]);

  const calc = useMemo(() => calculate(profile), [profile]);
  const computedDayType: DayType = profile.timing === "none" ? "rest" : dayType;
  const computedTarget: Macro = computedDayType === "training"
    ? { carbs: calc.trainingCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.trainingKcal }
    : { carbs: calc.restCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.restKcal };
  const computedMeals = computedDayType === "training" ? trainingMeals(profile.timing) : profile.timing === "breakfastEarly" ? EARLY_REST_MEALS : REST_MEALS;
  const dateMeta = metas[date];
  const effectiveDayType = dateMeta?.dayType ?? computedDayType;
  const dailyTarget = dateMeta?.target ?? computedTarget;
  const meals = dateMeta?.meals ?? computedMeals;
  const dateLog = logs[date] || {};
  const dayEntries = meals.flatMap((meal) => dateLog[meal.id] || []);
  const consumed = sumMacros(dayEntries);
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  const currentPlanLabel = PLAN_OPTIONS.find((p) => p.goal === profile.goal && p.timing === profile.timing)?.label || "自定义方案";
  const availableFoods = useMemo(() => [...FOODS, ...customFoods], [customFoods]);

  const historyRows = useMemo(() => Object.keys(logs)
    .filter((recordDate) => Object.values(logs[recordDate] || {}).some((items) => items.length > 0))
    .sort((a, b) => b.localeCompare(a))
    .map((recordDate) => {
      const total = sumMacros(Object.values(logs[recordDate] || {}).flat());
      const meta = metas[recordDate];
      const target = meta?.target;
      return {
        date: recordDate,
        total,
        meta,
        completion: target?.kcal ? Math.round((total.kcal / target.kcal) * 100) : 0,
      };
    }), [logs, metas]);

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function changePlan(value: string) {
    const [goal, timing] = value.split(":") as [Goal, Timing];
    setProfile((current) => ({ ...current, goal, timing }));
    if (timing === "none") setDayType("rest");
  }

  function addEntry(mealId: string, entry: FoodEntry) {
    if (!metas[date]) {
      setMetas((current) => ({ ...current, [date]: { dayType: computedDayType, target: computedTarget, planLabel: currentPlanLabel, weight: profile.weight, meals: computedMeals } }));
    }
    setLogs((current) => ({
      ...current,
      [date]: { ...current[date], [mealId]: [...(current[date]?.[mealId] || []), entry] },
    }));
  }

  function removeEntry(mealId: string, id: string) {
    setLogs((current) => ({
      ...current,
      [date]: { ...current[date], [mealId]: (current[date]?.[mealId] || []).filter((entry) => entry.id !== id) },
    }));
  }

  function clearDay() {
    setLogs((current) => ({ ...current, [date]: {} }));
    setMetas((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
  }

  function saveCustomFood(food: Food) {
    setCustomFoods((current) => [...current.filter((item) => !(item.name === food.name && item.category === "我的食物")), food]);
  }

  function chooseDayType(next: DayType) {
    setDayType(next);
    const nextTarget: Macro = next === "training"
      ? { carbs: calc.trainingCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.trainingKcal }
      : { carbs: calc.restCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.restKcal };
    const nextMeals = next === "training" ? trainingMeals(profile.timing) : profile.timing === "breakfastEarly" ? EARLY_REST_MEALS : REST_MEALS;
    setMetas((current) => ({ ...current, [date]: { dayType: next, target: nextTarget, planLabel: currentPlanLabel, weight: profile.weight, meals: nextMeals } }));
  }

  function openRecord(recordDate: string) {
    setDate(recordDate);
    document.getElementById("today")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const planValue = `${profile.goal}:${profile.timing}`;
  const completion = dailyTarget.kcal ? Math.min(100, Math.round((consumed.kcal / dailyTarget.kcal) * 100)) : 0;

  return (
    <main>
      <section className="hero">
        <nav className="topbar">
          <a className="brand" href="#top" aria-label="餐标首页"><span>餐</span>餐标</a>
          <div className="top-note"><i /> 数据只保存在你的设备</div>
        </nav>

        <div className="hero-copy" id="top">
          <p className="kicker">把 Excel 方案变成每一口的判断</p>
          <h1>今天这顿，<em>吃对了吗？</em></h1>
          <p>选择训练方案，系统自动拆分每日与每餐指标。记录食物或让 AI 看图识餐，立即看到余量、超标项和下一口建议。</p>
        </div>

        <div className="profile-panel" id="settings">
          <div className="panel-title"><span>01</span><div><h2>建立今日目标</h2><p>{currentPlanLabel}</p></div><button className="settings-toggle" onClick={() => setSettingsOpen((value) => !value)}>{settingsOpen ? "收起参数" : "调整参数"}</button></div>
          <div className="profile-quick">
            <span><b>{profile.weight}</b> kg</span><span><b>{round(bmi, 1)}</b> BMI</span><span><b>{round(dailyTarget.kcal)}</b> kcal</span><span><b>{round(dailyTarget.protein)}</b>g 蛋白质</span>
          </div>
          <div className={`settings-body ${settingsOpen ? "open" : ""}`}>
          <div className="profile-grid">
            <label className="field field-wide"><span>Excel 方案</span><select value={planValue} onChange={(e) => changePlan(e.target.value)}>{PLAN_OPTIONS.map((p) => <option key={`${p.goal}:${p.timing}`} value={`${p.goal}:${p.timing}`}>{p.label}</option>)}</select></label>
            <label className="field"><span>性别</span><select value={profile.sex} onChange={(e) => updateProfile("sex", e.target.value as Sex)}><option value="male">男</option><option value="female">女</option></select></label>
            <label className="field"><span>年龄</span><div className="number-field"><input type="number" min="18" max="90" value={profile.age} onChange={(e) => updateProfile("age", Number(e.target.value))} /><b>岁</b></div></label>
            <label className="field"><span>身高</span><div className="number-field"><input type="number" min="120" max="230" value={profile.height} onChange={(e) => updateProfile("height", Number(e.target.value))} /><b>cm</b></div></label>
            <label className="field"><span>体重</span><div className="number-field"><input type="number" min="35" max="250" step="0.1" value={profile.weight} onChange={(e) => updateProfile("weight", Number(e.target.value))} /><b>kg</b></div></label>
            <label className="field"><span>力训水平</span><select value={profile.level} disabled={profile.timing === "none"} onChange={(e) => updateProfile("level", e.target.value as Level)}><option value="beginner">新手</option><option value="intermediate">有基础</option><option value="advanced">老手</option></select></label>
            <label className="field"><span>日均有氧消耗</span><div className="number-field"><input type="number" min="0" max="1000" value={profile.cardioDaily} onChange={(e) => updateProfile("cardioDaily", Number(e.target.value))} /><b>kcal</b></div></label>
          </div>
          <div className="formula-strip">
            <span>BMI <b>{round(bmi, 1)}</b></span><span>基础代谢 <b>{round(calc.bmr)} kcal</b></span><span>今日平衡热量 <b>{round(effectiveDayType === "training" ? calc.trainMaintenance : calc.restMaintenance)} kcal</b></span>
            <p>沿用原表 Mifflin–St Jeor 与配额系数；结果用于饮食规划，不代替医疗建议。</p>
          </div>
          </div>
        </div>
      </section>

      <section className="dashboard-shell" id="today">
        <div className="day-toolbar">
          <div className="date-control"><button onClick={() => setDate(shiftDate(date, -1))} aria-label="前一天">←</button><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button onClick={() => setDate(shiftDate(date, 1))} aria-label="后一天">→</button></div>
          <div className="day-switch" aria-label="训练日类型">
            <button className={effectiveDayType === "training" ? "active" : ""} disabled={profile.timing === "none"} onClick={() => chooseDayType("training")}>力训日</button>
            <button className={effectiveDayType === "rest" ? "active" : ""} onClick={() => chooseDayType("rest")}>休息日</button>
          </div>
          <button className="clear-button" onClick={clearDay}>清空当天</button>
        </div>

        <section className="summary-card">
          <div className="summary-intro">
            <p className="eyebrow">02 · 今日摄入总览</p>
            <h2>{effectiveDayType === "training" ? "力训日" : "休息日"}目标</h2>
            <p>{profile.goal === "cut" ? "当前是减脂配额，关注趋势与训练表现。" : "当前是增肌配额，以缓慢增重为目标。"}</p>
          </div>
          <div className="calorie-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{round(consumed.kcal)}</strong><span>/ {round(dailyTarget.kcal)} kcal</span></div>
          </div>
          <div className="summary-macros">
            <Progress label="碳水" value={consumed.carbs} target={dailyTarget.carbs} color="var(--carb)" />
            <Progress label="蛋白质" value={consumed.protein} target={dailyTarget.protein} color="var(--protein)" />
            <Progress label="脂肪" value={consumed.fat} target={dailyTarget.fat} color="var(--fat)" />
          </div>
          <div className="target-numbers">
            <div><span>碳水</span><strong>{round(dailyTarget.carbs)}<small>g</small></strong></div>
            <div><span>蛋白质</span><strong>{round(dailyTarget.protein)}<small>g</small></strong></div>
            <div><span>脂肪</span><strong>{round(dailyTarget.fat)}<small>g</small></strong></div>
          </div>
        </section>

        <AiFoodAnalyzer onSave={saveCustomFood} />

        <div className="section-heading">
          <div><p className="eyebrow">04 · 逐餐记录</p><h2>每一餐都有清楚的边界</h2></div>
          <p>选择食物并输入可食重量，系统按完整营养数据计算。包装食品请优先使用“自定义食物”填写标签数值。</p>
        </div>

        <section className="meal-grid">
          {meals.map((meal) => {
            const target = {
              carbs: dailyTarget.carbs * meal.carbShare,
              protein: dailyTarget.protein * meal.proteinShare,
              fat: dailyTarget.fat * meal.proteinShare,
              kcal: dailyTarget.kcal * ((meal.carbShare + meal.proteinShare) / 2),
            };
            return <MealCard key={meal.id} meal={meal} target={target} entries={dateLog[meal.id] || []} foods={availableFoods} onAdd={(entry) => addEntry(meal.id, entry)} onRemove={(id) => removeEntry(meal.id, id)} />;
          })}
        </section>

        <section className="history-section" id="history">
          <div className="section-heading history-heading">
            <div><p className="eyebrow">05 · 历史记录</p><h2>每天的变化，都留得住</h2></div>
            <p>记录按日期保存在当前设备；每一天会锁定当时的方案、体重和目标，之后调整参数不会改写旧记录。</p>
          </div>
          {historyRows.length ? (
            <div className="history-list">
              {historyRows.map((row) => (
                <button className="history-row" key={row.date} onClick={() => openRecord(row.date)}>
                  <div className="history-date"><strong>{row.date.slice(5).replace("-", "/")}</strong><span>{row.meta?.dayType === "training" ? "力训日" : "休息日"} · {row.meta?.weight || profile.weight}kg</span></div>
                  <div className="history-plan">{row.meta?.planLabel || "历史方案"}</div>
                  <div className="history-macros"><span>C {round(row.total.carbs)}g</span><span>P {round(row.total.protein)}g</span><span>F {round(row.total.fat)}g</span></div>
                  <div className={`history-score ${row.completion > 110 ? "over" : ""}`}><strong>{row.completion}%</strong><span>{round(row.total.kcal)} kcal</span></div>
                  <span className="history-arrow">→</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-history"><span>○</span><h3>还没有历史记录</h3><p>在任意一餐添加食物后，当天记录会自动保存在这里。</p></div>
          )}
        </section>

        <footer>
          <div className="footer-mark"><span>餐</span><strong>把目标落到每一餐。</strong></div>
          <p>配额逻辑源自所提供的《健身 Excel 超级套表》。智能秤体脂与软件计算均仅作趋势参考。</p>
        </footer>
      </section>
      <nav className="mobile-nav" aria-label="移动端导航">
        <button onClick={() => scrollTo("today")}><span>●</span>今日</button>
        <button onClick={() => scrollTo("ai-food")}><span>✦</span>识餐</button>
        <button onClick={() => scrollTo("history")}><span>◷</span>历史</button>
        <button onClick={() => { setSettingsOpen(true); scrollTo("settings"); }}><span>⌁</span>设置</button>
      </nav>
    </main>
  );
}
