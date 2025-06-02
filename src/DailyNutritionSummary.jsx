function DailyNutritionSummary({ dailyAnalysis, dayData, NUTRITION_TARGETS, mealTypes }) {
  // 定義正餐
  const mainMeals = ['早餐', '午餐', '晚餐'];
  // 已輸入的正餐
  const inputMainMeals = dayData.meals
    .map(m => m.mealType)
    .filter(type => mainMeals.includes(type));
  // 剩餘未輸入的正餐
  const remainMainMeals = mainMeals.filter(type => !inputMainMeals.includes(type));
  const remainMainMealCount = remainMainMeals.length;

  // 已攝取總和
  const totalCaloriesTaken = dayData.meals.reduce((sum, m) => sum + Number(m.calories || 0), 0);
  const totalProteinTaken  = dayData.meals.reduce((sum, m) => sum + Number(m.protein || 0), 0);
  const totalFatTaken      = dayData.meals.reduce((sum, m) => sum + Number(m.fat || 0), 0);
  const totalCarbsTaken    = dayData.meals.reduce((sum, m) => sum + Number(m.carbs || 0), 0);
  const totalFiberTaken    = dayData.meals.reduce((sum, m) => sum + Number(m.fiber || 0), 0);

  // 剩餘待分配
  const remainCalories = Math.max(0, NUTRITION_TARGETS.calories - totalCaloriesTaken);
  const remainProtein  = Math.max(0, NUTRITION_TARGETS.protein - totalProteinTaken);
  const remainFat      = Math.max(0, NUTRITION_TARGETS.fat - totalFatTaken);
  const remainCarbs    = Math.max(0, NUTRITION_TARGETS.carbs - totalCarbsTaken);
  const remainFiber    = Math.max(0, NUTRITION_TARGETS.fiber - totalFiberTaken);

  let dynamicAdvice = null;
  if (remainMainMealCount > 0) {
    dynamicAdvice = (
      <div style={{
        background: "#fff3e0",
        borderRadius: 10,
        padding: "10px 18px",
        margin: "6px 0 10px 0",
        fontWeight: 500,
        color: "#d84315"
      }}>
        <div style={{ fontSize: 17, marginBottom: 5 }}>
          剩餘 <b>{remainMainMealCount}</b> 餐平均建議補足（不含點心）：
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 36px',
          marginBottom: 5,
          fontSize: 17
        }}>
          <div>熱量：<b>{Math.round(remainCalories / remainMainMealCount)} kcal</b>（剩餘 {remainCalories} kcal）</div>
          <div>蛋白質：<b>{Math.round(remainProtein / remainMainMealCount)} g</b>（剩餘 {remainProtein} g）</div>
          <div>脂肪：<b>{Math.round(remainFat / remainMainMealCount)} g</b>（剩餘 {remainFat} g）</div>
          <div>碳水：<b>{Math.round(remainCarbs / remainMainMealCount)} g</b>（剩餘 {remainCarbs} g）</div>
          <div>膳食纖維：<b>{Math.round(remainFiber / remainMainMealCount)} g</b>（剩餘 {remainFiber} g）</div>
        </div>
        <div style={{ fontSize: 15, color: '#b71c1c', fontWeight: 600 }}>
          請在 {remainMainMeals.join('、')} 補足！
        </div>
      </div>
    )
  } else {
    dynamicAdvice = (
      <div style={{
        marginTop: 8,
        color: '#388e3c',
        fontWeight: 500,
        background: '#e8f5e9',
        borderRadius: 8,
        padding: '6px 0 6px 12px'
      }}>
        🎉 今日所有正餐已填寫完成！
      </div>
    )
  }

  // 只回傳內容，不包外框
  return dynamicAdvice;
}

export default DailyNutritionSummary;