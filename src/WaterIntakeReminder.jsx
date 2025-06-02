function WaterIntakeReminder({ todayWaterIntake }) {
  let message = '';
  let color = '';
  let icon = '';

  if (todayWaterIntake < 1500) {
    icon = "⚠️";
    message = "喝水量明顯不足";
    color = "#d32f2f";
  } else if (todayWaterIntake < 2000) {
    icon = "💧";
    message = "可再多補充水分";
    color = "#f9a825";
  } else if (todayWaterIntake < 2500) {
    icon = "✅";
    message = "已達基本標準";
    color = "#388e3c";
  } else if (todayWaterIntake < 3000) {
    icon = "💪";
    message = "已達進階目標";
    color = "#1976d2";
  } else if (todayWaterIntake >= 3200) {
    icon = "🚨";
    message = "請留意腎臟負擔";
    color = "#b71c1c";
  } else {
    icon = "💧";
    message = "喝水充足";
    color = "#388e3c";
  }

  return (
    <span style={{ color, fontWeight: 500 }}>
      {icon} 今日已喝水 <b>{todayWaterIntake}</b> ml　<span>{message}</span>
    </span>
  );
}
export default WaterIntakeReminder;