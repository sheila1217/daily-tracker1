import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
Chart.register(annotationPlugin);

import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { auth } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import './App.css';
import WaterIntakeReminder from './WaterIntakeReminder'
import CalorieDeficitReminder from './CalorieDeficitReminder'
import DailyNutritionSummary from './DailyNutritionSummary.jsx'
// ==================================

// 單餐營養素分析
export function analyzeMealNutrition(stats, targets) {
  const { calories, protein, fat, carbs, fiber } = stats;
  const kcalStatus = getStatus(calories, targets.calories * 0.8, targets.calories * 1.2);
  // 自動推算總熱量（若未輸入），纖維不計入熱量
  const totalKcal = calories > 0 ? calories : (protein * 4 + fat * 9 + carbs * 4);
  const proteinPct = totalKcal ? (protein * 4 / totalKcal * 100) : 0;
  const fatPct = totalKcal ? (fat * 9 / totalKcal * 100) : 0;
  const carbsPct = totalKcal ? (carbs * 4 / totalKcal * 100) : 0;
  return {
    calories: {
      value: totalKcal, // 顯示推算熱量
      target: targets.calories,
      status: kcalStatus.status,
      color: kcalStatus.color,
      icon: kcalStatus.icon,
      text: kcalStatus.text,
      range: `${Math.round(targets.calories*0.8)}~${Math.round(targets.calories*1.2)}`
    },
    protein: getMacroStatus(protein, proteinPct, targets.proteinRange, "protein"),
    fat: getMacroStatus(fat, fatPct, targets.fatRange, "fat"),
    carbs: getMacroStatus(carbs, carbsPct, targets.carbsRange, "carbs"),
    fiber: getFiberStatus(fiber, targets.fiberRange),
    percent: {
      protein: proteinPct,
      fat: fatPct,
      carbs: carbsPct
    }
  };
}

function getStatus(val, min, max) {
  if (val === 0) return { status: "無資料", color: "#888", icon: "—", text: "尚未輸入" };
  if (val < min * 0.8) return { status: "明顯不足", color: "#e57373", icon: "🚨", text: "明顯不足" };
  if (val < min) return { status: "偏低", color: "#ffb74d", icon: "⚠️", text: "偏低" };
  if (val > max * 1.15) return { status: "明顯過高", color: "#e57373", icon: "🚨", text: "明顯過高" };
  if (val > max) return { status: "偏高", color: "#ffb74d", icon: "⚠️", text: "偏高" };
  return { status: "合理", color: "#81c784", icon: "✅", text: "合理" };
}

function getMacroStatus(g, pct, [minPct, maxPct], field) {
  if (g === 0) return { value: g, percent: pct, status: "無資料", icon: "—", color: "#888", text: "尚未輸入" };
  if (pct < minPct - 5) return { value: g, percent: pct, status: "明顯不足", icon: "🚨", color: "#e57373", text: "明顯不足" };
  if (pct < minPct) return { value: g, percent: pct, status: "偏低", icon: "⚠️", color: "#ffb74d", text: "偏低" };
  if (pct > maxPct + 5) return { value: g, percent: pct, status: "明顯過高", icon: "🚨", color: "#e57373", text: "明顯過高" };
  if (pct > maxPct) return { value: g, percent: pct, status: "偏高", icon: "⚠️", color: "#ffb74d", text: "偏高" };
  return { value: g, percent: pct, status: "合理", icon: "✅", color: "#81c784", text: "合理" };
}

function getFiberStatus(fiber, [minG, maxG]) {
  if (fiber === 0) return { value: fiber, status: "無資料", icon: "—", color: "#888", text: "尚未輸入" };
  if (fiber < minG) return { value: fiber, status: "偏低", icon: "⚠️", color: "#ffb74d", text: "偏低" };
  if (fiber > maxG) return { value: fiber, status: "偏高", icon: "⚠️", color: "#ffb74d", text: "偏高" };
  return { value: fiber, status: "合理", icon: "✅", color: "#81c784", text: "合理" };
}


// 每餐建議目標
const MEAL_NUTRITION_TARGETS = {
  "早餐":    { calories: 375, proteinRange: [20, 30], fatRange: [20, 30], carbsRange: [35, 50], fiberRange: [6, 10] },
  "午餐":    { calories: 525, proteinRange: [20, 30], fatRange: [20, 35], carbsRange: [40, 60], fiberRange: [10, 12] },
  "晚餐":    { calories: 525, proteinRange: [20, 30], fatRange: [20, 35], carbsRange: [40, 60], fiberRange: [10, 12] },
  "點心":    { calories: 75,  proteinRange: [0, 100], fatRange: [0, 100], carbsRange: [0, 100], fiberRange: [0, 10] },
  "加餐":    { calories: 100, proteinRange: [0, 100], fatRange: [0, 100], carbsRange: [0, 100], fiberRange: [0, 10] }
};

// 1. 營養素名稱顯示
const FIELD_DISPLAY_MAP = {
  protein: '🥚 蛋白質',
  fat:     '🧈 脂肪',
  carbs:   '🍚 碳水',
  fiber:   '🥦 膳食纖維'
};

// 2. 狀態icon/色彩
const STATUS_CONFIG = {
  合理:        { icon: "✅", className: "bg-green-100 text-green-800 border-green-200" },
  偏低:        { icon: "⚠️", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  明顯不足:    { icon: "🚨", className: "bg-red-100 text-red-800 border-red-200" },
  偏高:        { icon: "⚠️", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  明顯過高:    { icon: "🚨", className: "bg-red-100 text-red-800 border-red-200" },
  無資料:      { icon: "—", className: "bg-gray-100 text-gray-700 border-gray-200" }
};

// 3. 完整建議
function getSuggestion(field, status, remainMealTypes = []) {
  const remainStr = remainMealTypes.length > 0 ? `，請於${remainMealTypes.join('、')}補足` : '';
  if (field === "protein") {
    switch(status) {
      case "明顯不足": return "建議補充雞蛋、豆製品、乳製品等高蛋白食物，可於剩餘餐次增加主菜分量" + remainStr;
      case "偏低": return "可適量增加瘦肉、魚類或雞蛋攝取，於剩餘餐點補足蛋白質" + remainStr;
      case "偏高": return "蛋白質略高，請減少剩餘餐點的高蛋白食物攝取（如肉類、豆製品），避免超過每日建議" + remainStr;
      case "明顯過高": return "蛋白質攝取明顯過多，建議後續餐點減少肉類、蛋白粉等攝取，注意腎臟健康" + remainStr;
      default: return null;
    }
  }
  if (field === "fat") {
    switch(status) {
      case "明顯不足": return "脂肪明顯不足，可於剩餘餐次補充健康脂肪來源，如堅果、酪梨或橄欖油" + remainStr;
      case "偏低": return "脂肪偏低，可在剩餘餐點增加適量好油脂" + remainStr;
      case "偏高": return "脂肪略高，請減少剩餘餐點油脂用量及高脂食物（如炸物、肥肉）" + remainStr;
      case "明顯過高": return "脂肪攝取明顯過多，建議避免油炸、高脂食品，後續餐點選擇清淡調理" + remainStr;
      default: return null;
    }
  }
  if (field === "carbs") {
    switch(status) {
      case "明顯不足": return "碳水明顯不足，可於剩餘餐次補充全穀類、地瓜、根莖類等" + remainStr;
      case "偏低": return "碳水偏低，可增加主食分量，如糙米飯、燕麥" + remainStr;
      case "偏高": return "碳水攝取略高，請減少剩餘餐點精緻澱粉（如白飯、麵包）" + remainStr;
      case "明顯過高": return "碳水明顯過高，建議後續餐點減少主食，選擇低GI食物" + remainStr;
      default: return null;
    }
  }
  if (field === "fiber") {
    switch(status) {
      case "明顯不足":
      case "偏低":
        return "膳食纖維攝取不足，應於剩餘餐次多攝取蔬菜、水果、全穀類" + remainStr;
      case "偏高":
      case "明顯過高":
        return "纖維攝取過多，請減量高纖食物，並補充水分" + remainStr;
      default: return null;
    }
  }
  return null;
}

function getSuggestionColor(status) {
  switch(status) {
    case "合理": return "#388e3c";       // 綠色
    case "無資料": return "#888";        // 灰色
    case "偏低":
    case "偏高":   return "#ff9800";     // 橘色
    case "明顯不足":
    case "明顯過高": return "#d32f2f";   // 紅色
    default: return "#888";
  }
}

function MealNutritionAnalysis({ mealType, stats }) {
  const targets = MEAL_NUTRITION_TARGETS[mealType];
  const analysis = analyzeMealNutrition(stats, targets);

  const suggestions = {
    protein: getSuggestion("protein", analysis.protein.status),
    fat: getSuggestion("fat", analysis.fat.status),
    carbs: getSuggestion("carbs", analysis.carbs.status),
    fiber: getSuggestion("fiber", analysis.fiber.status)
  };

  return (
    <div style={{
      background: "#f7fbfd",
      border: "1px dashed #b3c7dd",
      borderRadius: 8,
      padding: "14px 18px 10px 18px",
      margin: "12px 0 8px 0",
      fontSize: 15,
      textAlign: 'left'
    }}>
      <div style={{
        fontWeight: 700,
        color: "#1976d2",
        marginBottom: 10,
        fontSize: 18,
        textAlign: 'left',
        letterSpacing: 1
      }}>
        {mealType}營養分析
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
        {/* 熱量 */}
        <div>
          <span style={{ fontWeight: 600 }}>熱量：</span>
          <span>
            {analysis.calories.icon} {analysis.calories.value} kcal
          </span>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>
            (建議 {analysis.calories.target}kcal, 合理 {analysis.calories.range})
          </span>
          {analysis.calories.text !== "合理" && (
            <div style={{
              color: getSuggestionColor(analysis.calories.status),
              fontSize: 13,
              fontWeight: 500,
              marginTop: 2
            }}>{analysis.calories.text}</div>
          )}
        </div>
        {/* 蛋白質 */}
        <div>
          <span style={{ fontWeight: 600 }}>蛋白質：</span>
          <span>
            {analysis.protein.icon} {analysis.protein.value}g ({analysis.percent.protein.toFixed(1)}%)
          </span>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 3 }}>
            (建議{targets.proteinRange?.[0]}~{targets.proteinRange?.[1]}%)
          </span>
          {suggestions.protein && <div style={{
            color: getSuggestionColor(analysis.protein.status),
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2
          }}>{suggestions.protein}</div>}
        </div>
        {/* 脂肪 */}
        <div>
          <span style={{ fontWeight: 600 }}>脂肪：</span>
          <span>
            {analysis.fat.icon} {analysis.fat.value}g ({analysis.percent.fat.toFixed(1)}%)
          </span>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 3 }}>
            (建議{targets.fatRange?.[0]}~{targets.fatRange?.[1]}%)
          </span>
          {suggestions.fat && <div style={{
            color: getSuggestionColor(analysis.fat.status),
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2
          }}>{suggestions.fat}</div>}
        </div>
        {/* 碳水 */}
        <div>
          <span style={{ fontWeight: 600 }}>碳水：</span>
          <span>
            {analysis.carbs.icon} {analysis.carbs.value}g ({analysis.percent.carbs.toFixed(1)}%)
          </span>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 3 }}>
            (建議{targets.carbsRange?.[0]}~{targets.carbsRange?.[1]}%)
          </span>
          {suggestions.carbs && <div style={{
            color: getSuggestionColor(analysis.carbs.status),
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2
          }}>{suggestions.carbs}</div>}
        </div>
        {/* 膳食纖維 */}
        <div>
          <span style={{ fontWeight: 600 }}>膳食纖維：</span>
          <span>
            {analysis.fiber.icon} {analysis.fiber.value}g
          </span>
          <span style={{ fontSize: 13, color: "#888", marginLeft: 3 }}>
            (建議{targets.fiberRange?.[0]}~{targets.fiberRange?.[1]}g)
          </span>
          {suggestions.fiber && <div style={{
            color: getSuggestionColor(analysis.fiber.status),
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2
          }}>{suggestions.fiber}</div>}
        </div>
      </div>
    </div>
  );
}

function analyzeDailyNutrition(totalStats, dailyTargets) {
  const results = analyzeMealNutrition(totalStats, dailyTargets); // 沿用原邏輯
  const imbalance = [];
  for (const field of ["protein", "fat", "carbs", "fiber"]) {
    if (results[field].status !== "合理") {
      imbalance.push({
        field,
        status: results[field].status,
        suggestion: getSuggestion(field, results[field].status)
      });
    }
  }
  return {
    totalStatus: imbalance.length === 0 ? "營養平衡良好" : "營養攝取需調整",
    issues: imbalance
  };
}

// ======= 新增提醒產生函數 =======
function generateAlerts(allData, dates) {
  const alerts = [];
  // 取最新的 7 天資料（日期新到舊）
  const recent = dates.slice(-7).map(d => allData[d] || {});
  const getSum = (arr, key) => arr.reduce((sum, d) => sum + (Number(d.summary?.[key] || 0)), 0);
  // 取最近 3 天
  const last3 = recent.slice(-3);
  // 取最近 7 天
  const last7 = recent.slice(-7);

  // 蛋白質
  if (last3.every(d => Number(d.summary?.totalProtein) < 90))
    alerts.push("蛋白質攝取不足，影響肌肉維持與修復");
  if (last3.every(d => Number(d.summary?.totalProtein) > 150))
    alerts.push("蛋白質攝取過高，注意腎臟負擔");

  // 脂肪
  if (last3.every(d => Number(d.summary?.totalFat) < 30))
    alerts.push("脂肪攝取過低，恐影響荷爾蒙與脂溶性維生素吸收");
  if (last3.every(d => Number(d.summary?.totalFat) > 70))
    alerts.push("脂肪攝取偏高，建議選擇好油脂");

  // 碳水
  if (last3.every(d => Number(d.summary?.totalCarbs) < 100))
    alerts.push("碳水攝取過低，可能影響代謝與運動表現");
  if (last3.every(d => Number(d.summary?.totalCarbs) > 180))
    alerts.push("碳水攝取偏高，注意熱量與體脂控制");

  // 纖維
  if (last3.every(d => Number(d.summary?.totalFiber) < 20))
    alerts.push("膳食纖維攝取不足，恐影響腸道健康與飽足感");
  if (last3.every(d => Number(d.summary?.totalFiber) > 40))
    alerts.push("膳食纖維過高可能導致腹脹或消化不適");

  // 熱量
  if (last3.every(d => Number(d.summary?.totalCalorie) < 1200))
    alerts.push("熱量攝取過低，可能影響代謝與免疫力");
  if (last3.every(d => Number(d.summary?.totalCalorie) > 1700))
    alerts.push("熱量攝取偏高，留意是否超過赤字目標");

  // 體重變化
  // 一週內體重增加或減少超過 ±1.5 kg
  const last7Weight = last7.map(d => Number(d.morningWeight || d.summary?.morningWeight || 0)).filter(x => x);
  if (last7Weight.length >= 2) {
    const delta = last7Weight[last7Weight.length - 1] - last7Weight[0];
    if (delta > 1.5)
      alerts.push("體重一週內上升超過1.5kg，請注意熱量攝取與運動量。");
    if (delta < -1.5)
      alerts.push("體重一週內下降超過1.5kg，請注意營養均衡與熱量供給。");
  }
  // 連續3天體重上升
  if (last3.length === 3) {
    const [w1, w2, w3] = last3.map(d => Number(d.morningWeight || d.summary?.morningWeight || 0));
    if (w1 && w2 && w3 && w1 < w2 && w2 < w3)
      alerts.push("可能進食超標或水腫，建議回顧飲食紀錄");
  }
  // 體重 5 天皆無明顯下降
  const last5 = recent.slice(-5);
  if (last5.length === 5) {
    const weights = last5.map(d => Number(d.morningWeight || d.summary?.morningWeight || 0)).filter(x => x);
    if (weights.length === 5 && Math.abs(weights[0] - weights[4]) < 0.1)
      alerts.push("減脂停滯，建議檢查熱量赤字與運動狀況");
  }

  // 運動提醒
  // 一週運動少於2天
  const workoutDays = last7.filter(d => (Number(d.cardioTime) || (d.exercises && d.exercises.length > 0))).length;
  if (workoutDays < 2)
    alerts.push("本週運動天數過少，建議增加身體活動");
  // 有氧連7天為0
  if (last7.every(d => !Number(d.cardioTime)))
    alerts.push("有氧運動中斷，建議每週進行 2～3 次");
  // 重訓連7天為0
  if (last7.every(d => !(d.exercises && d.exercises.length > 0)))
    alerts.push("未安排重量訓練，建議維持肌力訓練");
  // 單日運動消耗超過700大卡且連續3天
  if (last3.every(d => Number(d.summary?.totalExerciseCalories) > 700))
    alerts.push("連日高強度運動，建議適度休息避免疲勞累積");

  // 習慣與健康提醒
  // 連續3天睡眠時間晚於02:00
  if (last3.every(d => {
    if (!d.sleepTime) return false;
    const t = new Date(d.sleepTime).getHours();
    return t >= 2 || t < 5; // 假設凌晨 2~5點為晚睡
  })) alerts.push("近期作息不規律，晚睡可能影響代謝與食慾激素分泌");
  // 連續3天睡眠時間少於6小時
  if (last3.every(d => {
    if (!d.wakeTime || !d.sleepTime) return false;
    const sleep = new Date(d.sleepTime);
    const wake = new Date(d.wakeTime);
    let diff = (wake - sleep) / 3600000;
    if (diff < 0) diff += 24;
    return diff < 6;
  })) alerts.push("睡眠不足會影響恢復與脂肪代謝");

  // 進食時間異常、宵夜
 // 連續3天只吃1餐
  if (last3.every(d => d.meals && d.meals.length === 1))
    alerts.push("進食過少或過久未進食恐影響代謝與肌肉量");
  // 早餐跳過超過3次/週
  if (last7.filter(d => d.meals && !d.meals.some(m => m.mealType === "早餐")).length > 3)
    alerts.push("常跳過早餐會導致血糖不穩與暴食風險");

  return alerts;
}

const mealTypes = ['早餐', '午餐', '晚餐', '點心'];

const NUTRITION_TARGETS = {
  calories: 1500,
  protein: 130,
  fat: 48,
  carbs: 130,
  fiber: 30,
};

const MACRO_PERCENT_TARGETS = {
  protein: 33.1,
  fat: 28.7,
  carbs: 38.2,
};

function Section({title, open, onClick, children}) {
    return (
      <div style={{marginBottom: 18}}>
        <div
          onClick={onClick}
          style={{
            fontWeight: 600,
            fontSize: 18,
            cursor: 'pointer',
            background: '#e3f2fd',
            padding: '4px 14px',
            borderRadius: 8,
            userSelect: 'none',
            marginBottom: open ? 8 : 0,
          }}
        >
          <span>{open ? '▼' : '►'}</span> {title}
        </div>
        {open && <div style={{paddingLeft: 12}}>{children}</div>}
      </div>
    );
  }
  
function Bar({ value, max, color, label }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ width: '100%', margin: '4px 0 10px 0' }}>
      <div style={{
        background: '#eee',
        height: 18,
        borderRadius: 7,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${percent}%`,
          background: color,
          height: '100%',
          transition: 'width .4s',
        }} />
        {label && (
          <span style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            fontSize: 13,
            fontWeight: 600,
            color: percent > 50 ? '#fff' : '#333',
            lineHeight: '18px'
          }}>{label}</span>
        )}
      </div>
    </div>
  );
}

function fillDash(val) {
  return val === undefined || val === null || val === '' ? '—' : val;
}

function getLastNDays(end, n) {
  const arr = [];
  let dt = new Date(end);
  for (let i = 0; i < n; i++) {
    arr.unshift(dt.toISOString().slice(0, 10));
    dt.setDate(dt.getDate() - 1);
  }
  return arr;
}

function averageNutrients(data, dates) {
  let total = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }, count = 0;
  dates.forEach(d => {
    if (data[d]?.summary) {
      total.calories += Number(data[d].summary.totalCalorie) || 0;
      total.protein += Number(data[d].summary.totalProtein) || 0;
      total.fat += Number(data[d].summary.totalFat) || 0;
      total.carbs += Number(data[d].summary.totalCarbs) || 0;
      total.fiber += Number(data[d].summary.totalFiber) || 0;
      count++;
    }
  });
  if (count === 0) return undefined;
  return {
    calories: (total.calories / count).toFixed(1),
    protein: (total.protein / count).toFixed(1),
    fat: (total.fat / count).toFixed(1),
    carbs: (total.carbs / count).toFixed(1),
    fiber: (total.fiber / count).toFixed(1),
    days: count
  };
}

function App() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState(1); // 1=輸入, 2=分析, 3=匯出/備份/還原
  const [date, setDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [dayData, setDayData] = useState({
    morningWeight: '',
    eveningWeight: '',
    bmr: '',
    wakeTime: '',
    sleepTime: '',
    period: '無',
    exerciseCalories: '',
    cardioTime: '',
    cardioCalories: '',
    water: '',
    meals: [],
    exercises: [],
    note: '',
    summary: null
  });
  const [user, setUser] = useState(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState('');
 useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert('登入失敗：' + e.message);
    }
  };

  const handleLogout = () => signOut(auth);

  
  // 深色/淺色模式切換
  const [mode, setMode] = useState('light');
  const theme = mode === 'dark'
    ? { background: '#222', color: '#eee', border: '#444' }
    : { background: '#fafafc', color: '#222', border: '#bfc0c0' };

  // refs for meal/exercise name inputs (自動聚焦)
  const mealRefs = useRef([]);
  useEffect(() => { mealRefs.current = mealRefs.current.slice(0, dayData.meals.length); }, [dayData.meals.length]);
  const exerciseRefs = useRef([]);
  useEffect(() => { exerciseRefs.current = exerciseRefs.current.slice(0, dayData.exercises.length); }, [dayData.exercises.length]);

  // 響應式樣式
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media (max-width: 600px) {
        .responsive-blocks { flex-direction: column !important; }
        .responsive-grid { grid-template-columns: 1fr !important; }
        .responsive-table { font-size: 13px !important; }
        .responsive-table > div, .responsive-table > label { width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const [sectionOpen, setSectionOpen] = useState({
    basic: true,
    meals: true,
    exercises: false,
    cardio: false,
    water: false,
  });

  // 讀取
  useEffect(() => {
    const saved = localStorage.getItem('dailyData');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[date]) setDayData({ ...defaultDayData(), ...parsed[date] });
      else resetDayData();
    } else resetDayData();
    // eslint-disable-next-line
  }, [date]);

  // Auto save on every dayData change (ignore first load)
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    saveToStorage({ ...dayData });
    // eslint-disable-next-line
  }, [dayData]);

  function defaultDayData() {
    return {
      morningWeight: '',
      eveningWeight: '',
      bmr: '',
      wakeTime: '',
      sleepTime: '',
      period: '無',
      exerciseCalories: '',
      cardioTime: '',
      cardioCalories: '',
      water: '',
      meals: [],
      exercises: [],
      note: '',
      summary: null
    }
  }

  function saveToStorage(newData) {
    const saved = localStorage.getItem('dailyData');
    const parsed = saved ? JSON.parse(saved) : {};
    parsed[date] = newData;
    localStorage.setItem('dailyData', JSON.stringify(parsed));
  }
  function saveBasicInfo() {
    saveToStorage({ ...dayData });
    alert('已儲存基本資料！');
  }
  function saveMeals(newMeals) {
    setDayData(prev => ({ ...prev, meals: newMeals }));
  }
  function saveExercises(newExercises) {
    setDayData(prev => ({ ...prev, exercises: newExercises }));
  }
  function saveMealsManual() {
    saveToStorage({ ...dayData });
    handleSummarySave();
    alert('已儲存餐點資料，已自動統整！');
  }
  function resetDayData() {
    setDayData(defaultDayData());
  }

   // ========== Firestore 雲端功能 ==========
  // 1. 儲存到 Firestore
async function saveToCloud() {
  try {
    await setDoc(doc(db, "dailyData", date), dayData);
    setCloudSyncStatus('同步成功');
    const now = new Date().toLocaleString();
    setLastSyncTime(now);
    alert("雲端同步成功！"); // 成功後跳出提示
  } catch (e) {
    setCloudSyncStatus('同步失敗');
    alert("雲端同步失敗！");
  }
}


  // 2. 從 Firestore 讀取
async function loadFromCloud() {
  try {
    const snap = await getDoc(doc(db, "dailyData", date));
    if (snap.exists()) {
      setDayData({ ...defaultDayData(), ...snap.data() });
      setCloudSyncStatus('雲端還原成功');
      const now = new Date().toLocaleString();
      setLastSyncTime(now);
      alert("雲端還原成功！");
    } else {
      setCloudSyncStatus('雲端沒有此日期資料');
      alert("雲端沒有此日期資料！");
    }
  } catch (e) {
    setCloudSyncStatus('讀取失敗');
    alert("讀取失敗！");
  }
}


// 1. 計算全日總攝取
const totalStats = dayData.meals.reduce((sum, food) => ({
  calories: sum.calories + Number(food.calories || 0),
  protein: sum.protein + Number(food.protein || 0),
  fat: sum.fat + Number(food.fat || 0),
  carbs: sum.carbs + Number(food.carbs || 0),
  fiber: sum.fiber + Number(food.fiber || 0),
}), { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });

// 2. 準備全日建議（請根據你自己的建議值調整）
const dailyTargets = {
  calories: NUTRITION_TARGETS.calories || 0,
  proteinRange: [20, 30],  // 建議全日蛋白質佔總熱量比例 %
  fatRange: [20, 30],
  carbsRange: [35, 50],
  fiberRange: [25, 35],    // 建議全日纖維 g
};

// 3. 取得分析結果
const dailyAnalysis = analyzeDailyNutrition(totalStats, dailyTargets);

  // 全日加總
  const totalCalorie = dayData.meals.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const totalProtein = dayData.meals.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const totalFat = dayData.meals.reduce((sum, item) => sum + Number(item.fat || 0), 0);
  const totalCarbs = dayData.meals.reduce((sum, item) => sum + Number(item.carbs || 0), 0);
  const totalFiber = dayData.meals.reduce((sum, item) => sum + Number(item.fiber || 0), 0);

  // 多組重訓消耗熱量
  const weightCalories = dayData.exercises.reduce(
    (sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + Number(set.calories || 0), 0)
    , 0
  );
  const cardioCalories = Number(dayData.cardioCalories || 0);
  const totalExerciseCalories = cardioCalories + weightCalories;
  const deficit = Number(dayData.bmr || 0) + totalExerciseCalories - totalCalorie;

  // 營養素比例
  const proteinPercent = totalCalorie ? ((totalProtein * 4) / totalCalorie) * 100 : 0;
  const fatPercent = totalCalorie ? ((totalFat * 9) / totalCalorie) * 100 : 0;
  const carbsPercent = totalCalorie ? ((totalCarbs * 4) / totalCalorie) * 100 : 0;

  // 營養素剩餘
  const remaining = {
    calories: NUTRITION_TARGETS.calories - totalCalorie,
    protein: NUTRITION_TARGETS.protein - totalProtein,
    fat: NUTRITION_TARGETS.fat - totalFat,
    carbs: NUTRITION_TARGETS.carbs - totalCarbs,
    fiber: NUTRITION_TARGETS.fiber - totalFiber,
  };

  // 餐期分類
  function getMealStats(meals, type) {
    const filtered = meals.filter(item => item.mealType === type);
    return {
      calories: filtered.reduce((sum, i) => sum + Number(i.calories || 0), 0),
      protein: filtered.reduce((sum, i) => sum + Number(i.protein || 0), 0),
      fat: filtered.reduce((sum, i) => sum + Number(i.fat || 0), 0),
      carbs: filtered.reduce((sum, i) => sum + Number(i.carbs || 0), 0),
      fiber: filtered.reduce((sum, i) => sum + Number(i.fiber || 0), 0),
    };
  }
  function getMealDetails(meals, type) {
    return meals
      .filter(i => i.mealType === type)
      .map(i =>
        `${i.name || ''} 重量${i.weight || ''}克 熱量${i.calories || 0}/蛋白質${i.protein || 0}/脂肪${i.fat || 0}/碳水化合物${i.carbs || 0}/膳食纖維${i.fiber || 0}`
      )
      .join('\n');
  }
       
  // 統整儲存
  function handleSummarySave() {
    const summary = {
      date,
      morningWeight: fillDash(dayData.morningWeight),
      eveningWeight: fillDash(dayData.eveningWeight),
      bmr: fillDash(dayData.bmr),
      wakeTime: fillDash(dayData.wakeTime),
      sleepTime: fillDash(dayData.sleepTime),
      period: fillDash(dayData.period),
      note: fillDash(dayData.note),
      breakfast_details: fillDash(getMealDetails(dayData.meals, '早餐')),
      breakfast_calories: fillDash(getMealStats(dayData.meals, '早餐').calories),
      breakfast_protein: fillDash(getMealStats(dayData.meals, '早餐').protein),
      breakfast_fat: fillDash(getMealStats(dayData.meals, '早餐').fat),
      breakfast_carbs: fillDash(getMealStats(dayData.meals, '早餐').carbs),
      breakfast_fiber: fillDash(getMealStats(dayData.meals, '早餐').fiber),
      lunch_details: fillDash(getMealDetails(dayData.meals, '午餐')),
      lunch_calories: fillDash(getMealStats(dayData.meals, '午餐').calories),
      lunch_protein: fillDash(getMealStats(dayData.meals, '午餐').protein),
      lunch_fat: fillDash(getMealStats(dayData.meals, '午餐').fat),
      lunch_carbs: fillDash(getMealStats(dayData.meals, '午餐').carbs),
      lunch_fiber: fillDash(getMealStats(dayData.meals, '午餐').fiber),
      dinner_details: fillDash(getMealDetails(dayData.meals, '晚餐')),
      dinner_calories: fillDash(getMealStats(dayData.meals, '晚餐').calories),
      dinner_protein: fillDash(getMealStats(dayData.meals, '晚餐').protein),
      dinner_fat: fillDash(getMealStats(dayData.meals, '晚餐').fat),
      dinner_carbs: fillDash(getMealStats(dayData.meals, '晚餐').carbs),
      dinner_fiber: fillDash(getMealStats(dayData.meals, '晚餐').fiber),
      snack_details: fillDash(getMealDetails(dayData.meals, '點心')),
      snack_calories: fillDash(getMealStats(dayData.meals, '點心').calories),
      snack_protein: fillDash(getMealStats(dayData.meals, '點心').protein),
      snack_fat: fillDash(getMealStats(dayData.meals, '點心').fat),
      snack_carbs: fillDash(getMealStats(dayData.meals, '點心').carbs),
      snack_fiber: fillDash(getMealStats(dayData.meals, '點心').fiber),
      totalCalorie: fillDash(totalCalorie),
      totalProtein: fillDash(totalProtein),
      totalFat: fillDash(totalFat),
      totalCarbs: fillDash(totalCarbs),
      totalFiber: fillDash(totalFiber),
      totalExerciseCalories: fillDash(totalExerciseCalories),
      deficit: fillDash(deficit),
      water: fillDash(dayData.water),
      proteinPercent: fillDash(proteinPercent ? proteinPercent.toFixed(1) : '—'),
      fatPercent: fillDash(fatPercent ? fatPercent.toFixed(1) : '—'),
      carbsPercent: fillDash(carbsPercent ? carbsPercent.toFixed(1) : '—'),
    };
    setDayData(prev => {
      const newData = { ...prev, summary }
      saveToStorage(newData)
      return newData
    });
    alert('已統整並儲存！'); // 這行加進來
}
  
  function clearField(field) {
    setDayData(prev => ({ ...prev, [field]: '' }));
  }

  // 匯出Excel（橫排為日期，直排為指標）
  function exportExcel() {
    // 欄位英文對應中文
    const fieldMap = {
      morningWeight: '早上體重',
      eveningWeight: '晚上體重',
      bmr: '基礎代謝',
      wakeTime: '起床時間',
      sleepTime: '睡覺時間',
      period: '生理期',
      note: '備註',
      breakfast_details: '早餐明細',
      breakfast_calories: '早餐熱量',
      breakfast_protein: '早餐蛋白質',
      breakfast_fat: '早餐脂肪',
      breakfast_carbs: '早餐碳水',
      breakfast_fiber: '早餐纖維',
      lunch_details: '午餐明細',
      lunch_calories: '午餐熱量',
      lunch_protein: '午餐蛋白質',
      lunch_fat: '午餐脂肪',
      lunch_carbs: '午餐碳水',
      lunch_fiber: '午餐纖維',
      dinner_details: '晚餐明細',
      dinner_calories: '晚餐熱量',
      dinner_protein: '晚餐蛋白質',
      dinner_fat: '晚餐脂肪',
      dinner_carbs: '晚餐碳水',
      dinner_fiber: '晚餐纖維',
      snack_details: '點心明細',
      snack_calories: '點心熱量',
      snack_protein: '點心蛋白質',
      snack_fat: '點心脂肪',
      snack_carbs: '點心碳水',
      snack_fiber: '點心纖維',
      totalCalorie: '總熱量',
      totalProtein: '總蛋白質',
      totalFat: '總脂肪',
      totalCarbs: '總碳水',
      totalFiber: '總纖維',
      totalExerciseCalories: '總運動熱量',
      deficit: '熱量赤字',
      water: '喝水量',
      proteinPercent: '蛋白質比例',
      fatPercent: '脂肪比例',
      carbsPercent: '碳水比例',
    };


    // 取出資料
    const allData = (() => {
      try { return JSON.parse(localStorage.getItem('dailyData') || '{}'); } catch { return {}; }
    })();

    // 取得欲匯出的日期範圍
    const dates = Object.keys(allData)
      .filter(d => d >= startDate && d <= endDate)
      .sort();

    if (dates.length === 0) {
      alert("所選日期內沒有資料！");
      return;
    }

    // 取得全部 summary 欄位
    const fields = Object.keys(allData[dates[0]].summary || {});

    // 組成二維陣列資料
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "飲食紀錄");
    XLSX.writeFile(wb, `dailyData-${dates[0]}-${dates.at(-1)}.xlsx`);
  } // <--- 這個大括號結束 exportExcel！！！

  function exportJSON() {
    const allData = JSON.parse(localStorage.getItem('dailyData') || '{}');
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dailyData-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        localStorage.setItem('dailyData', JSON.stringify(data));
        alert('已成功還原資料，請重新整理頁面！');
      } catch {
        alert('上傳 JSON 格式錯誤！');
      }
    };
    reader.readAsText(file);
  }

  
  // 平均分析
  const allData = (() => {
  try { return JSON.parse(localStorage.getItem('dailyData') || '{}'); } catch { return {}; }
})();
const last7days = getLastNDays(date, 7);
const last30days = getLastNDays(date, 30);
const avg7 = averageNutrients(allData, last7days);
const avg30 = averageNutrients(allData, last30days);

// ===== 新增提醒 useMemo =====
const alerts = useMemo(() => {
  if (!allData || !Object.keys(allData).length) return [];
  const _dates = Object.keys(allData).sort();
  return generateAlerts(allData, _dates);
}, [allData]);
// ===========================

// 步驟3：準備資料
const dates = Object.keys(allData).sort();
// 取得生理期區間
const periodRanges = getPeriodRanges(dates, allData, "月經中");
const weights = dates.map(d => Number(allData[d]?.morningWeight || ''));
const proteins = dates.map(d => Number(allData[d]?.summary?.totalProtein || ''));
const calories = dates.map(d => Number(allData[d]?.summary?.totalCalorie || ''));
const deficits = dates.map(d => Number(allData[d]?.summary?.deficit || ''));

function getPeriodRanges(dates, allData, phase = "月經中") {
  const ranges = [];
  let range = null;
  dates.forEach((date) => {
    if (allData[date]?.period === phase) {
      if (!range) range = { start: date, end: date };
      else range.end = date;
    } else if (range) {
      ranges.push({ ...range });
      range = null;
    }
  });
  if (range) ranges.push({ ...range });
  return ranges;
}

// 步驟4：設定 chart.js 的資料格式（放這裡！）
const lineData = {
  labels: dates,
  datasets: [
    {
      label: '體重 (kg)',
      data: weights,
      borderColor: 'rgba(255,99,132,1)',
      backgroundColor: 'rgba(255,99,132,0.12)',
      yAxisID: 'y',
      tension: 0.3,
    },
    {
      label: '攝取 (kcal)',
      data: calories,
      borderColor: 'rgba(255,206,86,1)',
      backgroundColor: 'rgba(255,206,86,0.12)',
      yAxisID: 'y1',
      tension: 0.3,
    },
    {
      label: '消耗 (kcal)',
      data: dates.map(d =>
        Number(allData[d]?.bmr || 0) + Number(allData[d]?.summary?.totalExerciseCalories || 0)
      ),
      borderColor: 'rgba(76,175,80,1)',
      backgroundColor: 'rgba(76,175,80,0.12)',
      yAxisID: 'y2',
      tension: 0.3,
    },
    {
      label: '赤字 (kcal)',
      data: deficits,
      borderColor: 'rgba(54,162,235,1)',
      backgroundColor: 'rgba(54,162,235,0.10)',
      yAxisID: 'y3',
      tension: 0.3,
    },
  ],
};


const lineOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'top' },
    title: { display: true, text: '攝取、消耗、赤字、體重變化曲線' },
    tooltip: { mode: 'index', intersect: false },
    annotation: {
      annotations: periodRanges.map(r => ({
        type: 'box',
        xMin: r.start,
        xMax: r.end,
        backgroundColor: 'rgba(255,40,80,0.18)',
        borderColor: 'rgba(255,40,80,0.9)',
        borderWidth: 2,
        yScaleID: 'y',
        z: -1,
        label: {
          display: true,
          content: '🩸 ',
          color: '#fff',
          backgroundColor: 'rgba(255,40,80,0.59)',
          font: { weight: 'bold', size: 14 },
          position: "start", // 或 "center"
          yAdjust: -10 // 上移一點
        }
      }))
    }
  },
  scales: {
    y: { // 體重
      type: 'linear',
      position: 'left',
      title: { display: true, text: '體重 (kg)' },
    },
    y1: { // 攝取
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      title: { display: true, text: '攝取 (kcal)' },
    },
    y2: { // 消耗
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      title: { display: true, text: '消耗 (kcal)' },
      offset: true,
    },
    y3: { // 赤字
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      title: { display: true, text: '赤字 (kcal)' },
      offset: true,
      min: -2000, // 可視需求調整
      max: 2000,
    },
  },
};

// UI
return (
  <div
    className="main-container"
    style={{
      maxWidth: 430,
      margin: '20px auto',
      fontFamily: 'Arial, sans-serif',
      background: theme.background,
      color: theme.color,
      minHeight: '100vh',
      border: `1px solid ${theme.border}`,
      borderRadius: 16,
      boxShadow: '0 2px 16px #eee'
    }}
  >
    {/* 分頁按鈕區 */}
    <div
      style={{
        display: 'flex',
        gap: 12,
        background: '#e3f2fd',
        padding: '10px 8px',
        borderRadius: 40,
        justifyContent: 'center',
        marginBottom: 20,
      }}
    >
      {[
        { label: '資料輸入', icon: '📝' },
        { label: '分析頁面', icon: '📊' },
        { label: '資料統整', icon: '💾' }
      ].map((item, idx) => {
        const selected = tab === idx + 1;
        return (
          <button
            key={item.label}
            onClick={() => setTab(idx + 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 22px',
              borderRadius: 999,
              border: 'none',
              background: selected ? '#42a5f5' : '#e3f2fd',
              color: selected ? '#fff' : '#1976d2',
              fontWeight: selected ? 700 : 500,
              fontSize: 16,
              boxShadow: selected ? '0 2px 8px #b3d7ff' : undefined,
              cursor: 'pointer',
              transition: 'all .2s',
              outline: 'none'
            }}
          >
            <span style={{ fontSize: 20, marginRight: 4 }}>{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </div>

    {/* 登入資訊 */}
    {user ? (
      <div style={{ margin: '10px 0' }}>
        <span>歡迎, {user.displayName || user.email}！</span>
        <button onClick={handleLogout} style={{ marginLeft: 8 }}>登出</button>
      </div>
    ) : (
      <button onClick={handleLogin} style={{ margin: '10px 0' }}>Google 登入</button>
    )}
    {/* ======================= 分頁內容 ======================= */}
    {tab === 1 && (
      <div>
        <h2>{date} 每日資料輸入</h2>
        <hr />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 10 }}>
          {/* 前一天 */}
          <button
            onClick={() => {
              const prev = new Date(date);
              prev.setDate(prev.getDate() - 1);
              setDate(prev.toISOString().slice(0, 10));
            }}
            style={{ padding: '4px 10px', fontSize: 18, cursor: 'pointer' }}
            title="前一天"
          >
            ＜
          </button>

          {/* 日期選擇器 */}
          <label style={{ margin: 0 }}>
            選擇日期：
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>

          {/* 後一天 */}
          <button
            onClick={() => {
              const next = new Date(date);
              next.setDate(next.getDate() + 1);
              setDate(next.toISOString().slice(0, 10));
            }}
            style={{ padding: '4px 10px', fontSize: 18, cursor: 'pointer' }}
            title="後一天"
          >
            ＞
          </button>
          {/* 回到今天 */}
          <button
            onClick={() => {
              const today = new Date();
              setDate(today.toISOString().slice(0, 10));
            }}
            style={{
              marginLeft: 12,
              padding: '4px 14px',
              fontSize: 16,
              background: '#e3f2fd',
              border: '1px solid #90caf9',
              borderRadius: 5,
              cursor: 'pointer',
              color: '#1976d2'
            }}
            title="回到今天"
          >
            今天
          </button>
        </div>

        {/* ========= Section: 基本資料 ========= */}
        <Section
          title="基本資料"
          open={sectionOpen.basic}
          onClick={() => setSectionOpen(s => ({ ...s, basic: !s.basic }))}
        >
            <div className="responsive-blocks" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: 8 }}>
              {/* 以下是你原本的基本資料 input */}
              <label>
                早上體重（公斤）：
                <input type="number" value={dayData.morningWeight} step="0.1"
                  onChange={e => setDayData({ ...dayData, morningWeight: e.target.value })} style={{ width: 80, marginLeft: 4 }} />
              </label>
              <label>
                晚上體重（公斤）：
                <input type="number" value={dayData.eveningWeight} step="0.1"
                  onChange={e => setDayData({ ...dayData, eveningWeight: e.target.value })} style={{ width: 80, marginLeft: 4 }} />
              </label>
              <label>
                BMR（大卡）：
                <input type="number" value={dayData.bmr}
                  onChange={e => setDayData({ ...dayData, bmr: e.target.value })} style={{ width: 80, marginLeft: 4 }} />
              </label>
              <label>
                起床時間：
                <input type="datetime-local" value={dayData.wakeTime}
                  onChange={e => setDayData({ ...dayData, wakeTime: e.target.value })} style={{ width: 180, marginLeft: 4 }} />
              </label>
              <label>
                睡覺時間：
                <input type="datetime-local" value={dayData.sleepTime}
                  onChange={e => setDayData({ ...dayData, sleepTime: e.target.value })} style={{ width: 180, marginLeft: 4 }} />
              </label>
              <label>
                生理期狀態：
                <select value={dayData.period}
                  onChange={e => setDayData({ ...dayData, period: e.target.value })} style={{ marginLeft: 4 }}>
                  <option value="無">無</option>
                  <option value="月經前">月經前</option>
                  <option value="月經中">月經中</option>
                  <option value="月經後">月經後</option>
                </select>
              </label>
              <label>
                備註（如外食/聚餐/經期/胃痛等）：
                <input type="text" value={dayData.note}
                  onChange={e => setDayData({ ...dayData, note: e.target.value })} style={{ width: 180, marginLeft: 4 }} />
              </label>
            </div>
            <button onClick={saveBasicInfo} style={{ marginBottom: 10, background: '#4caf50', color: 'white' }}>儲存基本資料</button>
          </Section>

          {/* ========= Section: 餐點輸入 ========= */}
          <Section
            title="餐點輸入"
            open={sectionOpen.meals}
            onClick={() => setSectionOpen(s => ({ ...s, meals: !s.meals }))}
          >
            {/* 建議分配表 */}
<div style={{
  margin: '18px 0 22px 0',
  padding: 14,
  background: 'linear-gradient(90deg,#e3f2fd 70%, #f5f5fa)',
  borderRadius: 14,
  boxShadow: '0 1px 7px #e3eafc',
  maxWidth: 520,
  marginLeft: 'auto',
  marginRight: 'auto'
}}>
  <div style={{fontWeight: 700, fontSize: 18, textAlign:'center', marginBottom:10, color:'#1976d2',letterSpacing:1}}>每日營養素建議分配</div>
  <table style={{fontSize:15, margin:'0 auto', borderCollapse:'collapse', width:'100%'}}>
    <thead>
      <tr style={{background:'#eaf2fb'}}>
        <th style={{padding:'6px 0', fontWeight:600}}>餐別</th>
        <th>熱量</th>
        <th>蛋白質</th>
        <th>脂肪</th>
        <th>碳水</th>
        <th>纖維</th>
      </tr>
    </thead>
    <tbody>
      <tr style={{background:'#f6fbff'}}><td>早餐</td><td>25%（375kcal）</td><td>25–30g</td><td>10–15g</td><td>35–40g</td><td>6–10g</td></tr>
      <tr style={{background:'#fff'}}><td>午餐</td><td>35%（525kcal）</td><td>35–45g</td><td>15–20g</td><td>45–50g</td><td>10–12g</td></tr>
      <tr style={{background:'#f6fbff'}}><td>晚餐</td><td>35%（525kcal）</td><td>35–45g</td><td>15–20g</td><td>45–50g</td><td>10–12g</td></tr>
      <tr style={{background:'#fff'}}><td>加餐</td><td>5%（75kcal）</td><td>自由調整</td><td>自由調整</td><td>自由調整</td><td>彈性補充</td></tr>
    </tbody>
  </table>
</div>
<div style={{
  margin: '18px 0',
  padding: 20,
  borderRadius: 14,
  border: '2px solid #ffb300',
  background: '#fffde7',
  boxShadow: "0 1px 6px 0 #e0e0e0",
  maxWidth: 700,
}}>
  <WaterIntakeReminder todayWaterIntake={Number(dayData.water) || 0} />
  <div style={{ margin: '10px 0' }}><hr style={{ border: 0, borderTop: '1px dashed #ffb300', margin: 0 }} /></div>
  <CalorieDeficitReminder 
    BMR={Number(dayData.bmr) || 0}
    activityCalories={totalExerciseCalories}
    todayCaloriesIntake={totalCalorie}
  />
  <div style={{ margin: '10px 0' }}><hr style={{ border: 0, borderTop: '1px dashed #ffb300', margin: 0 }} /></div>
  <DailyNutritionSummary
    dailyAnalysis={dailyAnalysis}
    dayData={dayData}
    NUTRITION_TARGETS={NUTRITION_TARGETS}
    mealTypes={mealTypes}
  />
</div>
  
          {/* 各餐輸入區（食物明細） */}
          {mealTypes.map((type) => (
            <div key={type} style={{
              marginBottom: 28,
              background: '#f8fafd',
              borderRadius: 10,
              boxShadow: '0 1px 6px #ececec',
              border: '1px solid #e3eaf1',
              padding: '14px 12px 6px 12px'
            }}>
              <MealNutritionAnalysis
                mealType={type}
                stats={getMealStats(dayData.meals, type)}
    />
    <div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 9
}}>
  <h4 style={{
    margin: 0,
    fontWeight: 700,
    fontSize: 17,
    color:'#1565c0',
    letterSpacing:1
  }}>{type}</h4>
  <div style={{ color: "#6c757d", fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', marginLeft: 8 }}>
    本餐總計：{getMealStats(dayData.meals, type).calories} kcal，
    蛋白質 {getMealStats(dayData.meals, type).protein}g，
    脂肪 {getMealStats(dayData.meals, type).fat}g，
    碳水 {getMealStats(dayData.meals, type).carbs}g，
    膳食纖維 {getMealStats(dayData.meals, type).fiber}g
  </div>
</div>
    {dayData.meals.filter(food => food.mealType === type).map((food, i) => {
  const mealIdx = dayData.meals.findIndex(
    (m, idx) => m === food && m.mealType === type
  );
  // 欄位定義陣列
  const fields = [
    { label: '名稱', key: 'name', type: 'text' },
    { label: '重量(g)', key: 'weight', type: 'number' },
    { label: '熱量(kcal)', key: 'calories', type: 'number' },
    { label: '蛋白質(g)', key: 'protein', type: 'number' },
    { label: '脂肪(g)', key: 'fat', type: 'number' },
    { label: '碳水(g)', key: 'carbs', type: 'number' },
    { label: '纖維(g)', key: 'fiber', type: 'number' },
  ];
  return (
    <div
      key={i}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr) 60px',
        gap: 8,
        alignItems: 'end',
        marginBottom: 8,
        background: '#fff',
        borderRadius: 6,
        padding: '10px 0',
        minWidth: 0, // NEW: 防止超出
      }}
    >
      {fields.map(field => (
        <div key={field.key}>
          <label
            htmlFor={`${type}-${i}-${field.key}`}
            style={{
              display: 'block',
              fontWeight: 500,
              fontSize: 13,
              marginBottom: 2,
              color: '#1976d2',
              letterSpacing: '0.5px'
            }}
          >
            {field.label}
          </label>
          <input
            id={`${type}-${i}-${field.key}`}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid #b3c7dd',
              padding: '6px 8px',
              fontSize: 15
            }}
            type={field.type}
            value={food[field.key]}
            onChange={e => {
              const newMeals = [...dayData.meals];
              newMeals[mealIdx][field.key] = e.target.value;
              saveMeals(newMeals);
            }}
            ref={field.key === 'name' ? el => mealRefs.current[mealIdx] = el : undefined}
          />
        </div>
      ))}
      <div style={{display:'flex', alignItems:'center', height:'100%'}}>
        <button
          onClick={() => {
            if (window.confirm('確定要刪除這筆餐點嗎？')) {
              const newMeals = dayData.meals.filter((_, idx) => idx !== mealIdx);
              saveMeals(newMeals);
            }
          }}
          style={{
            color: '#fff',
            background:'#e53935',
            border:'none',
            borderRadius:5,
            fontSize:'0.95rem',
            padding:'6px 12px',
            cursor:'pointer',
            transition:'background .2s'
          }}
          onMouseOver={e=>e.currentTarget.style.background='#b71c1c'}
          onMouseOut={e=>e.currentTarget.style.background='#e53935'}
        >刪除</button>
      </div>
    </div>
  );
})}
    <button
      onClick={() => {
        saveMeals([...dayData.meals, {
          mealType: type, name: '', weight: '', calories: '', protein: '', fat: '', carbs: '', fiber: ''
        }]);
        setTimeout(() => {
          const idx = dayData.meals.length;
          mealRefs.current[idx]?.focus();
        }, 100);
      }}
      style={{
        margin:'8px 0 4px 0',
        padding:'5px 14px',
        border:'1px solid #2196f3',
        background:'#fff',
        color:'#1976d2',
        borderRadius:6,
        fontWeight:600,
        cursor:'pointer'
      }}
    >＋新增食物</button>
  </div>
))}
          <button
            onClick={saveMealsManual}
            style={{
              display: 'block',
              margin: '24px auto 6px auto',
              background: '#1976d2',
              color: '#fff',
              fontWeight: 700,
              padding: '12px 38px',
              fontSize: 17,
              border: 'none',
              borderRadius: 32,
              boxShadow: '0 2px 8px #b3d7ff',
              letterSpacing: 1,
              cursor: 'pointer',
              transition: 'background .2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#115293'}
            onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
          >儲存餐點資料</button>
    </Section>

          {/* ========= Section: 重量訓練 ========= */}
          <Section
            title="重量訓練紀錄"
            open={sectionOpen.exercises}
            onClick={() => setSectionOpen(s => ({ ...s, exercises: !s.exercises }))}
          >
            {dayData.exercises.map((ex, i) => (
              <div key={i} style={{
                border: '1px solid #bbb', borderRadius: 5, marginBottom: 12, padding: 8, background: '#f8f9fb'
              }}>
                {/* ...（原本重量訓練內容）... */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <span>運動名稱：</span>
                  <input
                    style={{ width: 120, marginRight: 10 }}
                    ref={el => exerciseRefs.current[i] = el}
                    value={ex.name || ''}
                    placeholder="如：硬舉"
                    onChange={e => {
                      const newExercises = [...dayData.exercises];
                      newExercises[i].name = e.target.value;
                      saveExercises(newExercises);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (window.confirm('確定要刪除此運動及其所有組數嗎？')) {
                        const newExercises = [...dayData.exercises];
                        newExercises.splice(i, 1);
                        saveExercises(newExercises);
                      }
                    }}
                    style={{
                      marginLeft: 10,
                      color: 'red',
                      border: '1px solid red',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: '0.85rem',
                      background: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    − 刪除此運動
                  </button>
                </div>
                {/* 多組紀錄 */}
                {(ex.sets || []).map((set, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, marginLeft: 15 }}>
                    <span>第{j + 1}組：</span>
                    <span>次數</span>
                    <input
                      type="number"
                      style={{ width: 50, marginRight: 7, marginLeft: 3 }}
                      value={set.reps || ''}
                      placeholder="次數"
                      onChange={e => {
                        const newExercises = [...dayData.exercises];
                        newExercises[i].sets[j].reps = e.target.value;
                        saveExercises(newExercises);
                      }}
                    />
                    <span>重量(kg)</span>
                    <input
                      type="number"
                      style={{ width: 60, marginRight: 7, marginLeft: 3 }}
                      value={set.weight || ''}
                      placeholder="重量"
                      onChange={e => {
                        const newExercises = [...dayData.exercises];
                        newExercises[i].sets[j].weight = e.target.value;
                        saveExercises(newExercises);
                      }}
                    />
                    <span style={{ marginLeft: 5 }}>消耗熱量</span>
                    <input
                      type="number"
                      style={{ width: 60, marginRight: 7, marginLeft: 3 }}
                      value={set.calories || ''}
                      placeholder="kcal"
                      onChange={e => {
                        const newExercises = [...dayData.exercises];
                        newExercises[i].sets[j].calories = e.target.value;
                        saveExercises(newExercises);
                      }}
                    />
                    <button
                      onClick={() => {
                        const newExercises = [...dayData.exercises];
                        newExercises[i].sets.splice(j, 1);
                        saveExercises(newExercises);
                      }}
                      style={{ color: 'red', marginLeft: 4, fontSize: '0.9rem' }}
                    >刪除此組</button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newExercises = [...dayData.exercises];
                    if (!newExercises[i].sets) newExercises[i].sets = [];
                    newExercises[i].sets.push({ reps: '', weight: '', calories: '' });
                    saveExercises(newExercises);
                  }}
                  style={{ marginLeft: 15, marginTop: 2, marginBottom: 7 }}
                >＋新增組</button>
              </div>
            ))}
            <button
              onClick={() => {
                saveExercises([...dayData.exercises, { name: '', sets: [{ reps: '', weight: '', calories: '' }] }]);
                setTimeout(() => {
                  exerciseRefs.current[dayData.exercises.length]?.focus();
                }, 100);
              }}
              style={{ marginBottom: 12 }}
            >＋新增運動</button>
            <button
              style={{ marginBottom: 18, background: '#ffd700', color: '#333', fontWeight: 'bold', border: '1px solid #aaa', borderRadius: 4, padding: '6px 14px', fontSize: '1rem' }}
              onClick={() => {
                function getExerciseSummary(exercises) {
                  return exercises.map(ex => {
                    if (!ex.name) return '';
                    const sets = (ex.sets || []).map(
                      (set, idx) =>
                        `第${idx + 1}組：${set.reps || ''}下，${set.weight || ''}kg`
                    ).join('\n');
                    return `${ex.name}\n${sets}`;
                  }).filter(Boolean).join('\n\n');
                }
                const summary = getExerciseSummary(dayData.exercises);
                navigator.clipboard.writeText(summary);
                alert('已複製運動紀錄！\n\n你可直接貼給AI計算消耗熱量。');
              }}
            >
              複製運動紀錄（方便AI計算消耗熱量）
            </button>
          </Section>

          {/* ========= Section: 有氧 ========= */}
          <Section
            title="有氧跑步機"
            open={sectionOpen.cardio}
            onClick={() => setSectionOpen(s => ({ ...s, cardio: !s.cardio }))}
          >
            <div>
              <label>
                時間（分鐘）：
                <input type="number" value={dayData.cardioTime || ''}
                  onChange={e => setDayData({ ...dayData, cardioTime: e.target.value })}
                  style={{ marginLeft: 8, width: 80 }} />
              </label>
              <label style={{ marginLeft: 10 }}>
                消耗熱量（大卡）：
                <input type="number" value={dayData.cardioCalories || ''}
                  onChange={e => setDayData({ ...dayData, cardioCalories: e.target.value })}
                  style={{ marginLeft: 8, width: 80 }} />
              </label>
            </div>
          </Section>

          {/* ========= Section: 喝水量 ========= */}
          <Section
            title="今日喝水量"
            open={sectionOpen.water}
            onClick={() => setSectionOpen(s => ({ ...s, water: !s.water }))}
          >
            <div style={{ marginBottom: 8, marginTop: 8 }}>
              <label>
                今日喝水量（ml）：
                <input type="number" value={dayData.water}
                  onChange={e => setDayData({ ...dayData, water: e.target.value })}
                  style={{ marginLeft: 8, width: 100 }} />
              </label>
            </div>
          </Section>
          {/* 統整、雲端區域 */}
          <div style={{ margin: '16px 0' }}>
            <button onClick={handleSummarySave} className="my-green-btn">統整儲存</button>
            <button onClick={saveToCloud} className="my-blue-btn">同步到雲端</button>
            <button onClick={loadFromCloud} className="my-orange-btn">從雲端還原</button>
            <span style={{ marginLeft: 24 }}>雲端狀態：{cloudSyncStatus}</span>
            <span style={{ marginLeft: 12 }}>上次同步：{lastSyncTime || '—'}</span>
          </div>
        </div>
      )}

    {tab === 2 && (
      <div>
        {/* ======= 健康提醒區塊 ======= */}
        {alerts.length > 0 ? (
          <div style={{
            background: '#ffebee',
            color: '#b71c1c',
            borderRadius: 8,
            padding: 12,
            margin: '12px 0',
            fontWeight: 600,
            fontSize: 16
          }}>
            <span style={{ fontSize: 20, marginRight: 10 }}>⚠️</span>
            <span>注意健康提醒：</span>
            <ul style={{ margin: 0, paddingLeft: 24 }}>
              {alerts.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{
            background: '#e8f5e9',
            color: '#388e3c',
            borderRadius: 8,
            padding: 12,
            margin: '12px 0',
            fontWeight: 600,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 20, marginRight: 10 }}>🌟</span>
            <span>飲食均衡，運動習慣良好，健康狀態佳！</span>
          </div>
        )}
        {/* ======= 分析內容請保留你原本的分析內容 ======= */}
        {/* ...資訊摘要、剩餘分析、Bar、圖表等區塊完全不變... */}
        {/* ... */}
        {/* 資訊摘要 */}
        <div
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            padding: '18px 10px 8px 10px',
            margin: '24px 0 10px 0',
            background: theme.background,
            color: theme.color,
            maxWidth: 700
          }}
        >
          <div style={{
            display: 'flex',
            fontWeight: 600,
            color: mode === 'dark' ? '#cce' : '#27374d',
            fontSize:15,
            borderBottom:`1px solid ${theme.border}`,
            paddingBottom:3,
            justifyContent: 'flex-start'
          }}>
            <div style={{width: '15%', textAlign:'center'}}></div>
            <div style={{width: '17%', textAlign:'center'}}>熱量</div>
            <div style={{width: '17%', textAlign:'center'}}>蛋白質</div>
            <div style={{width: '17%', textAlign:'center'}}>脂肪</div>
            <div style={{width: '17%', textAlign:'center'}}>碳水</div>
            <div style={{width: '17%', textAlign:'center'}}>膳食纖維</div>
          </div>
          {/* 標準 */}
          <div style={{display:'flex',alignItems:'center',fontSize:15,marginTop:6}}>
            <div style={{width:'15%',minWidth:70, textAlign:'right',paddingRight:5, fontWeight:600, color:'#666'}}>每日標準</div>
            <div style={{width: '17%', textAlign:'center'}}>{NUTRITION_TARGETS.calories} kcal</div>
            <div style={{width: '17%', textAlign:'center'}}>{NUTRITION_TARGETS.protein} g</div>
            <div style={{width: '17%', textAlign:'center'}}>{NUTRITION_TARGETS.fat} g</div>
            <div style={{width: '17%', textAlign:'center'}}>{NUTRITION_TARGETS.carbs} g</div>
            <div style={{width: '17%', textAlign:'center'}}>{NUTRITION_TARGETS.fiber} g</div>
          </div>
        {/* 已食用 */}
        <div style={{display:'flex',alignItems:'center',fontSize:15,marginTop:2}}>
          <div style={{width:'15%',minWidth:70, textAlign:'right',paddingRight:5, fontWeight:600, color:'#333'}}>已食用</div>
          <div style={{width: '17%', textAlign:'center'}}>{totalCalorie} kcal</div>
          <div style={{width: '17%', textAlign:'center'}}>{totalProtein} g</div>
          <div style={{width: '17%', textAlign:'center'}}>{totalFat} g</div>
          <div style={{width: '17%', textAlign:'center'}}>{totalCarbs} g</div>
          <div style={{width: '17%', textAlign:'center'}}>{totalFiber} g</div>
        </div>
        {/* 可食用 */}
        <div style={{display:'flex',alignItems:'center',fontSize:16,marginTop:2,fontWeight:700}}>
          <div style={{width:'15%',minWidth:70, textAlign:'right',paddingRight:5, color:'#228B22'}}>可食用</div>
          {['calories', 'protein', 'fat', 'carbs', 'fiber'].map((key, idx) => (
            <div key={key} style={{
              width: '17%',
              textAlign:'center',
              color: remaining[key] < 0 ? 'red' : '#228B22'
            }}>
              {remaining[key]} {key === 'calories' ? 'kcal' : 'g'}
            </div>
          ))}
        </div>
        {/* 已食用彩色條 */}
        <div style={{display:'flex',alignItems:'center',marginTop:2,marginBottom:2}}>
          <div style={{width:'15%'}}></div>
          <div style={{width:'17%'}}><Bar value={totalCalorie} max={NUTRITION_TARGETS.calories} color="#ff9800" label="" /></div>
          <div style={{width:'17%'}}><Bar value={totalProtein} max={NUTRITION_TARGETS.protein} color="#1976d2" label="" /></div>
          <div style={{width:'17%'}}><Bar value={totalFat} max={NUTRITION_TARGETS.fat} color="#ff7043" label="" /></div>
          <div style={{width:'17%'}}><Bar value={totalCarbs} max={NUTRITION_TARGETS.carbs} color="#43a047" label="" /></div>
          <div style={{width:'17%'}}><Bar value={totalFiber} max={NUTRITION_TARGETS.fiber} color="#9c27b0" label="" /></div>
        </div>      

      {/* 分餐總計區塊 */}
      <div style={{marginTop:18, marginBottom:10, fontSize:15, lineHeight:1.7}}>
        {mealTypes.map(type => {
          const stats = getMealStats(dayData.meals, type);
          return (
            <div key={type}>
              {type}總計：{stats.calories} kcal，蛋白質 {stats.protein}g，脂肪 {stats.fat}g，碳水 {stats.carbs}g，膳食纖維 {stats.fiber}g
            </div>
          )
        })}
          <div style={{fontWeight:'bold', marginTop:6}}>
            本日總計：{totalCalorie} kcal，蛋白質 {totalProtein}g，脂肪 {totalFat}g，碳水 {totalCarbs}g，膳食纖維 {totalFiber}g
          </div>
        </div>
        <div style={{borderBottom:`1px solid ${theme.border}`, margin:'10px 0 0 0'}}></div>
        <div style={{ marginTop: 20 }}>
          <p>
            今日運動消耗熱量（大卡）：{totalExerciseCalories.toFixed(0)}
            <span style={{color:'#888',fontSize:13,marginLeft:8}}>
              (重訓：{weightCalories.toFixed(0)}，有氧：{cardioCalories.toFixed(0)})
            </span>
          </p>
          <p>今日熱量赤字（BMR+運動消耗 - 攝取）：{deficit.toFixed(1)} 大卡</p>
        </div>
        <p>蛋白質佔總熱量比例：{proteinPercent ? proteinPercent.toFixed(1) : '—'}%</p>
        <p>脂肪佔總熱量比例：{fatPercent ? fatPercent.toFixed(1) : '—'}%</p>
        <p>碳水佔總熱量比例：{carbsPercent ? carbsPercent.toFixed(1) : '—'}%</p>
        <p>今日喝水量：{dayData.water || 0} ml</p>
        <div style={{marginTop:16, fontSize:15, color:'#2c406e'}}>
          <b>一週平均</b>（{avg7?.days || 0}天）：熱量 {avg7?.calories || '—'} kcal，蛋白質 {avg7?.protein || '—'}g，脂肪 {avg7?.fat || '—'}g，碳水 {avg7?.carbs || '—'}g，膳食纖維 {avg7?.fiber || '—'}g<br/>
          <b>一月平均</b>（{avg30?.days || 0}天）：熱量 {avg30?.calories || '—'} kcal，蛋白質 {avg30?.protein || '—'}g，脂肪 {avg30?.fat || '—'}g，碳水 {avg30?.carbs || '—'}g，膳食纖維 {avg30?.fiber || '—'}g
        </div>
        <hr />
      </div>

      {/* 👇 把圖表插在這裡 */}
<div style={{ maxWidth: 900, height: 350, margin: "30px auto", background: "#fff", borderRadius: 8, boxShadow: '0 2px 8px #eee', padding: 18 }}>
  <h4>歷史記錄折線圖</h4>
  <Line
  key={tab} // 讓 tab 切換時強制重繪
  data={lineData}
  options={{
    ...lineOptions,
    devicePixelRatio: window.devicePixelRatio || 2,
    responsive: true,
    maintainAspectRatio: false,
  }}
  width={900}
  height={350}
/>
</div>
      {/* 👆 圖表插入區塊 */}
    </div>
    )}
      {/* 分頁內容 */}
    {tab === 3 && (
      <div>
        {/* 匯出/備份/還原 */}
        <h3>資料匯出/備份/還原</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap:'wrap' }}>
            <label>
              開始日期：
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ marginLeft: 8 }} />
            </label>
            <label>
              結束日期：
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ marginLeft: 8 }} />
            </label>
            <button
              onClick={exportExcel}
              style={{
                padding: '4px 12px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              匯出Excel（橫排日期/直排欄位）
            </button>
            <button
              onClick={exportJSON}
              style={{
                padding: '4px 12px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              匯出JSON備份
            </button>
            <input
              type="file"
              accept="application/json"
              style={{display:'none'}}
              id="import-json"
              onChange={importJSON}
            />
            <label htmlFor="import-json">
              <button
                style={{
                  padding: '4px 12px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  backgroundColor: '#ffae3b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >上傳還原JSON</button>
            </label>
          </div>
          
        </div>
      )}  {/* 👈 這個大括號絕對不能少！ */}
{/* ======================= 分頁內容結束 ======================= */}
    <button
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      style={{
        float: 'right',
        margin: 10,
        padding: '4px 16px',
        borderRadius: 4,
        border: 'none',
        background: '#888',
        color: '#fff',
        cursor: 'pointer'
      }}
    >
      {mode === 'dark' ? '切換為淺色' : '切換為深色'}
    </button>
  </div>
);
}

export default App;