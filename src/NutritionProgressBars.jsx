import React from 'react';

const COLORS = {
  calories: "#ff9800",
  protein: "#2196f3",
  fat: "#e91e63",
  carbs: "#4caf50",
  fiber: "#ab47bc"
};

const NAMES = {
  calories: "熱量",
  protein: "蛋白質",
  fat: "脂肪",
  carbs: "碳水",
  fiber: "纖維"
};

export default function NutritionProgressBars({ stats, targets }) {
  return (
    <div style={{padding: '16px 0', marginBottom: 8}}>
      {Object.keys(stats).map(key => {
        const percent = Math.max(0, Math.min(100, Math.round((stats[key] / (targets[key] || 1)) * 100)));
        return (
          <div key={key} style={{marginBottom: 10}}>
            <div style={{fontSize: 14, marginBottom: 2}}>
              <span style={{color: COLORS[key], fontWeight: 600, marginRight: 8}}>
                {NAMES[key]}
              </span>
              {stats[key]} / {targets[key]} {key === 'calories' ? 'kcal' : 'g'}
              <span style={{marginLeft:6, fontSize:12, fontWeight:500, color:'#888'}}>
                ({percent}%)
              </span>
            </div>
            <div style={{
              background: '#eee',
              borderRadius: 8,
              height: 14,
              overflow: 'hidden'
            }}>
              <div style={{
                width: percent + '%',
                background: COLORS[key],
                height: 14,
                borderRadius: 8,
                transition: 'width 0.4s'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}