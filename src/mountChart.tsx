import React from 'react';
import { createRoot } from 'react-dom/client';
import MonthlyPerformanceChart from './components/MonthlyPerformanceChart';

function mountMonthlyPerformanceChart() {
  const container = document.getElementById('monthly-performance-chart-root');
  if (container && !container.hasAttribute('data-react-mounted')) {
    container.setAttribute('data-react-mounted', 'true');
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <MonthlyPerformanceChart />
      </React.StrictMode>
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMonthlyPerformanceChart);
} else {
  mountMonthlyPerformanceChart();
}

// Support manual re-mount or event trigger when switching tabs
(window as any).mountMonthlyPerformanceChart = mountMonthlyPerformanceChart;
