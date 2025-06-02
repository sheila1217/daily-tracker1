function CalorieDeficitReminder({ BMR, activityCalories, todayCaloriesIntake }) {
  const calorieDeficit = (BMR + activityCalories) - todayCaloriesIntake;
  let message = '';
  let color = '';
  let icon = '';

  if (calorieDeficit < 0) {
    icon = "🚨";
    message = "熱量攝取超標，容易增重";
    color = "#d32f2f";
  } else if (calorieDeficit < 200) {
    icon = "⚠️";
    message = "熱量赤字過小，減脂可能緩慢";
    color = "#fbc02d";
  } else if (calorieDeficit < 800) {
    icon = "✅";
    message = "赤字理想";
    color = "#388e3c";
  } else {
    icon = "🚨";
    message = "熱量赤字過大，注意營養均衡、避免掉肌";
    color = "#d32f2f";
  }

  return (
    <span style={{ color, fontWeight: 500 }}>
      {icon} 今日熱量赤字 <b>{calorieDeficit}</b> kcal　<span>{message}</span>
    </span>
  );
}
export default CalorieDeficitReminder;