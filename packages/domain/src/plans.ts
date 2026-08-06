import { FOODS, REST_MEALS } from "./constants.ts";
import { round } from "./numbers.ts";
import type { DayType, Goal, Macro, MealGuide, MealPreset, MealRole, Timing } from "./types.ts";

export function trainingMeals(timing: Timing): MealPreset[] {
  switch (timing) {
    case "breakfastEarly":
      return [
        { id: "breakfast", name: "早饭 · 练前", note: "少量、易消化", carbShare: 0.15, proteinShare: 0.2 },
        { id: "post", name: "练后餐", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "breakfastLate":
      return [
        { id: "breakfast", name: "早饭 · 练前", note: "训练前主餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭 · 练后", note: "全天最大餐", carbShare: 0.4, proteinShare: 0.3 },
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
        { id: "dinner", name: "晚饭 · 练后", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "afterDinner":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.3 },
        { id: "dinner", name: "晚饭 · 练前", note: "控制到五六分饱", carbShare: 0.15, proteinShare: 0 },
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
  // 训练落在午饭前后：无论真正的「午饭」在练前（afterLunch）还是练后（beforeLunch），
  // 都用统一的 "lunch" ID，与休息日午饭共享记录；真正的加餐槽才用 pre / post。
  const preIsLunch = key === "after-lunch";
  return [
    { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
    preIsLunch
      ? { id: "lunch", name: preName, note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 }
      : { id: "pre", name: preName, note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 },
    preIsLunch
      ? { id: "post", name: postName, note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 }
      : { id: "lunch", name: postName, note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
    { id: "dinner", name: dinnerName, note: preIsLunch ? "训练后的其他餐" : "其他餐", carbShare: 0.2, proteinShare: 0.3 },
    { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
  ];
}

export function mealRole(meal: MealPreset): MealRole {
  if (meal.name.includes("零食") || meal.name.includes("夜宵")) return "snack";
  if (meal.name.includes("练前")) return "pre";
  if (meal.name.includes("练后")) return "post";
  if (meal.name.includes("早饭")) return "breakfast";
  return "regular";
}

export function guideForMeal(meal: MealPreset, goal: Goal, dayType: DayType): MealGuide {
  const role = mealRole(meal);
  const leanMeatRule = "肉类只选瘦肉：无白色脂肪层的猪牛羊肉、去皮鸡鸭肉、鱼虾贝，或肝肾肚血。";
  const avoidFattyMeat = "这些不算瘦肉：鸡鸭皮、排骨/大排、糖醋里脊、锅包肉、猪蹄、牛腩、牛排、肥牛肥羊、炸肉、午餐肉、肉肠、肉馅和肉丸。";
  const avoidSugarFat = `${goal === "cut" ? "减脂期严格排除" : "增肌期也只偶尔吃"}糖油混合物：饼干、蛋糕、点心、甜品、油条、煎饼、手抓饼、葱油饼、花式面包和膨化食品。`;
  const fatShortage = goal === "cut"
    ? "若早饭不吃蛋黄牛奶，或午晚饭都吃低油无油菜，为避免脂肪不足，全天补30g坚果、或3个全蛋、或1盒全脂牛奶。"
    : "若早饭不吃蛋黄牛奶，或午晚饭都吃低油无油菜，为避免脂肪不足，全天坚果需增至60g。";
  if (role === "pre") return {
    summary: "这不是正式一餐：只垫少量易消化碳水，吃到五六分饱即可开练。",
    choices: ["香蕉：小根约20g、大根约30g碳水", "娃哈哈八宝粥：约30–47g碳水/罐", "旺仔小馒头：约37g碳水/袋", "脉动等运动饮料：约30g碳水/瓶"],
    cautions: [
      "练前餐不是正式一餐，只能吃到五六分饱；吃完不用专门等待，可以直接准备训练。",
      "极端重要：练前脂肪不能吃，蛋白质也不用专门补；若刚好吃正餐，只搭配少量瘦肉。",
      avoidFattyMeat,
      avoidSugarFat,
      "练前避开煎炒鸡蛋（含番茄炒蛋）、油烧茄子、干煸菜等吸油菜。",
    ],
  };
  if (role === "post") return {
    summary: "全天最大餐，最好练完后半小时内开始吃；先碳水和蛋白质。",
    choices: ["高GI主食：一般米饭、馒头、花卷、熟面", "蛋白质：一般熟瘦肉、去皮禽肉、鱼虾贝", "来不及吃正餐：便携快碳 + 蛋白粉"],
    cautions: [
      "练后餐与一般正餐顺序相反：先吃碳水和蛋白质，蔬菜少吃、后吃，避免胰岛素被压制。",
      leanMeatRule,
      avoidFattyMeat,
      avoidSugarFat,
      "水果必须置换主食，不能在主食之外额外吃；水果10g碳水约置换30g熟米饭。",
      "意面、燕麦麸皮等低GI或高纤主食，不作为练后主要碳水。",
    ],
  };
  if (role === "snack") return {
    summary: "预留的10%碳水用于抵扣牛奶、蔬菜和调料的漏算，不是让你再吃一份主食。",
    choices: ["低糖牛肉干 / 鸡肉干", "鸡蛋、乳制品", "蔬菜、无糖饮料"],
    cautions: [
      "零食/夜宵设计热量不多，可以不吃；把额度分到其他正餐，多吃几口瘦肉或主食即可。",
      "这10%的少量碳水是牛奶、蔬菜和调料的漏算预留，不用再专门吃面包、米面、奶茶或水果。",
      avoidSugarFat,
      "需要加餐时优先低糖瘦肉干、鸡蛋、乳制品、蔬菜或无糖饮料。",
    ],
  };
  if (role === "breakfast") return {
    summary: "早餐同时建立碳水、蛋白质和基础脂肪来源。",
    choices: ["主食任选：米饭/粥、馒头、切片面包、燕麦、薯类", "蛋白质优先：鸡蛋 + 纯牛奶；或鸡蛋", "鸡蛋可水煮、茶叶蛋、蒸蛋羹"],
    cautions: [
      "鸡蛋可以水煮、做茶叶蛋或鸡蛋羹，但不能用油煎蛋替代。",
      leanMeatRule,
      goal === "gain" ? "增肌方案每天还要安排约30g坚果；不吃坚果时，可用米饭和瘦肉合计约100g置换。" : "减脂方案的基础脂肪来自早餐蛋黄牛奶和正餐带油瘦肉菜。",
      fatShortage,
      "一般餐先吃、多吃蔬菜，再吃碳水，有助于控制餐后反应。",
    ],
  };
  return {
    summary: dayType === "rest" ? "休息日正餐：主食配瘦肉，蔬菜先吃、多吃。" : "其他正餐：主食配瘦肉，蔬菜先吃、多吃。",
    choices: ["主食：一般米饭、馒头、熟面、红薯、土豆、玉米", "瘦肉：去皮鸡鸭、无白色脂肪层的猪牛羊、鱼虾贝、肝肾肚血", "蔬菜不用定量，争取每天都吃"],
    cautions: [
      leanMeatRule,
      avoidFattyMeat,
      "水煮牛肉、毛血旺、口水鸡等重油菜，要先确认肉本身是瘦肉，再在盘边刮油或简单过水。",
      avoidSugarFat,
      "红薯、土豆、玉米、山药和芋头属于碳水主食，不算蔬菜。",
      "一般正餐先吃、多吃蔬菜，再吃碳水；只有力训后的练后餐相反。",
      fatShortage,
    ],
  };
}

export function getRecommendation(target: Macro, total: Macro, meal: MealPreset): { text: string; foodId: string; grams: number } {
  const remain = {
    carbs: target.carbs - total.carbs,
    protein: target.protein - total.protein,
    fat: target.fat - total.fat,
  };
  if (remain.carbs < -5 || remain.protein < -5 || remain.fat < -4) {
    return { text: "本餐已有指标超出，接下来优先选择无油蔬菜或停止加餐。", foodId: "broccoli", grams: 150 };
  }
  const role = mealRole(meal);
  if (role === "snack") {
    if (remain.protein > 10) {
      const food = FOODS.find((f) => f.id === "jerky")!;
      return { text: `本次加餐不再补主食；若确实饿，可用约 ${round((remain.protein / food.protein) * 100)}g 低糖瘦肉干补蛋白质。`, foodId: food.id, grams: round((remain.protein / food.protein) * 100) };
    }
    return { text: "这餐的碳水是漏算预留，不必吃满；可选鸡蛋、乳制品、蔬菜或无糖饮料。", foodId: "egg", grams: 50 };
  }
  if (role === "pre") {
    if (remain.carbs > 8) {
      const food = FOODS.find((f) => f.id === "banana")!;
      return { text: `练前只垫碳水：可吃约 ${round((remain.carbs / food.carbs) * 100)}g 香蕉，五六分饱即可，不必补蛋白质和脂肪。`, foodId: food.id, grams: round((remain.carbs / food.carbs) * 100) };
    }
    return { text: "练前碳水已接近目标，不要为了吃满而继续加餐，准备训练即可。", foodId: "banana", grams: 80 };
  }
  if (remain.protein > 10) {
    if (role === "breakfast") {
      const eggs = Math.max(1, Math.ceil(remain.protein / 6));
      return { text: `早餐还差约 ${round(remain.protein)}g 蛋白质，可安排约 ${eggs} 个全蛋；也可用鸡蛋加纯牛奶组合。`, foodId: "egg", grams: eggs * 50 };
    }
    const food = FOODS.find((f) => f.id === "chicken")!;
    return { text: `${role === "post" ? "练后优先补足" : "还差约"} ${round(remain.protein)}g 蛋白质，可选约 ${round((remain.protein / food.protein) * 100)}g 一般熟瘦肉。`, foodId: food.id, grams: round((remain.protein / food.protein) * 100) };
  }
  if (remain.carbs > 12) {
    const food = FOODS.find((f) => f.id === (role === "breakfast" ? "oats" : "rice"))!;
    const amount = round((remain.carbs / food.carbs) * 100);
    return { text: role === "post" ? `练后还差约 ${round(remain.carbs)}g 碳水，可补 ${amount}g 一般熟米饭；水果不能作为主要来源。` : `还差约 ${round(remain.carbs)}g 碳水，可选约 ${amount}g ${food.name}。`, foodId: food.id, grams: amount };
  }
  return { text: role === "post" ? "练后餐已接近目标；如吃蔬菜，请少吃、后吃。" : "本餐已经接近目标，先吃、多吃蔬菜即可。", foodId: "broccoli", grams: 150 };
}
