import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart
} from 'recharts';

export interface MonthlyData {
  month: string;
  repairs: number;
  fuelBefore: number; // km/liter sebelum tuning
  fuelAfter: number; // km/liter setelah tuning
  efficiencyGain: number; // persentase peningkatan efisiensi (%)
  totalSavings: number; // ribuan Rupiah
  hpBefore: number; // Tenaga Standar Pabrik (Horsepower / DK)
  hpAfter: number; // Tenaga Sesudah Tuning (Horsepower / DK)
  hpGain: number; // Persentase peningkatan tenaga (%)
  torqueGain: number; // Kenaikan torsi akselerasi (Nm)
}

const BASE_DATA_ALL = [
  { month: 'Jan', repairs: 98, fuelBefore: 40.2, fuelAfter: 48.6, hpBefore: 11.2, hpAfter: 13.4, totalSavings: 24500, torqueGain: 1.8 },
  { month: 'Feb', repairs: 112, fuelBefore: 40.5, fuelAfter: 49.1, hpBefore: 11.4, hpAfter: 13.8, totalSavings: 28900, torqueGain: 2.1 },
  { month: 'Mar', repairs: 125, fuelBefore: 39.8, fuelAfter: 48.2, hpBefore: 11.1, hpAfter: 13.5, totalSavings: 31400, torqueGain: 2.0 },
  { month: 'Apr', repairs: 118, fuelBefore: 40.1, fuelAfter: 48.9, hpBefore: 11.3, hpAfter: 13.9, totalSavings: 29800, torqueGain: 2.2 },
  { month: 'Mei', repairs: 134, fuelBefore: 40.4, fuelAfter: 49.8, hpBefore: 11.5, hpAfter: 14.3, totalSavings: 35200, torqueGain: 2.4 },
  { month: 'Jun', repairs: 142, fuelBefore: 40.0, fuelAfter: 49.5, hpBefore: 11.2, hpAfter: 14.1, totalSavings: 37600, torqueGain: 2.3 },
  { month: 'Jul', repairs: 156, fuelBefore: 39.6, fuelAfter: 49.2, hpBefore: 11.0, hpAfter: 14.2, totalSavings: 41200, torqueGain: 2.5 },
  { month: 'Agu', repairs: 148, fuelBefore: 40.3, fuelAfter: 50.1, hpBefore: 11.4, hpAfter: 14.6, totalSavings: 39500, torqueGain: 2.6 },
  { month: 'Sep', repairs: 165, fuelBefore: 40.2, fuelAfter: 50.8, hpBefore: 11.3, hpAfter: 14.9, totalSavings: 44800, torqueGain: 2.8 },
  { month: 'Okt', repairs: 158, fuelBefore: 39.9, fuelAfter: 50.2, hpBefore: 11.1, hpAfter: 14.7, totalSavings: 42100, torqueGain: 2.7 },
  { month: 'Nov', repairs: 172, fuelBefore: 40.1, fuelAfter: 51.0, hpBefore: 11.3, hpAfter: 15.2, totalSavings: 46900, torqueGain: 3.0 },
  { month: 'Des', repairs: 184, fuelBefore: 39.7, fuelAfter: 51.4, hpBefore: 11.2, hpAfter: 15.5, totalSavings: 51200, torqueGain: 3.2 },
];

export default function MonthlyPerformanceChart() {
  // Toggle: 'fuel' (Fuel Efficiency) vs 'hp' (Horsepower Gain)
  const [metricMode, setMetricMode] = useState<'fuel' | 'hp'>('fuel');
  const [timeRange, setTimeRange] = useState<'6m' | '12m'>('12m');
  const [category, setCategory] = useState<'all' | 'matic' | 'bebek' | 'sport'>('all');
  const [tuningType, setTuningType] = useState<'harian' | 'kirian' | 'boreup'>('kirian');

  // Animation key counter to trigger entrance animations on mount and toggle switch
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    // Increment on mount to trigger upward bar animation
    setAnimKey(prev => prev + 1);

    const handleTrigger = () => {
      setAnimKey(prev => prev + 1);
    };
    window.addEventListener('tvs-trigger-chart-anim', handleTrigger);
    return () => {
      window.removeEventListener('tvs-trigger-chart-anim', handleTrigger);
    };
  }, []);

  const switchMetricMode = (newMode: 'fuel' | 'hp') => {
    setMetricMode(newMode);
    setAnimKey(prev => prev + 1);
  };

  // Custom Animated Bar Shape for guaranteed upward entrance animation
  const AnimatedBarShape = (shapeProps: any) => {
    const { x, y, width, height, fill, index, ...rest } = shapeProps;
    if (width == null || height == null || width <= 0 || height <= 0) return null;

    const barIndex = index ?? 0;
    const staggerDelay = Math.max(0, (barIndex % 12)) * 40; // 0ms, 40ms, 80ms...
    const originX = (x || 0) + (width || 0) / 2;
    const originY = (y || 0) + (height || 0);

    return (
      <g className="recharts-bar-animated-item">
        <rect
          {...rest}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={4}
          ry={4}
          fill={fill}
          className="custom-animated-bar-rect"
          style={{
            transformOrigin: `${originX}px ${originY}px`,
            animation: `rechartsBarUpwardAnim 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${staggerDelay}ms both`,
            cursor: 'pointer'
          }}
        />
      </g>
    );
  };

  // Multiplier berdasarkan tipe motor dan paket tuning simulasi
  const categoryMultiplier = useMemo(() => {
    switch (category) {
      case 'matic': return { repairMod: 1.15, kmBase: 42, kmMod: 1.05, hpBase: 11.5, hpMod: 1.0 };
      case 'bebek': return { repairMod: 0.95, kmBase: 52, kmMod: 1.1, hpBase: 9.2, hpMod: 0.85 };
      case 'sport': return { repairMod: 0.8, kmBase: 33, kmMod: 0.95, hpBase: 18.5, hpMod: 1.6 };
      default: return { repairMod: 1.0, kmBase: 40, kmMod: 1.0, hpBase: 11.8, hpMod: 1.0 };
    }
  }, [category]);

  const tuningMultiplier = useMemo(() => {
    switch (tuningType) {
      case 'harian': return { gainMod: 1.12, hpMod: 1.10, savingsMod: 0.9, torqueMod: 0.7 };
      case 'kirian': return { gainMod: 1.22, hpMod: 1.24, savingsMod: 1.15, torqueMod: 1.15 };
      case 'boreup': return { gainMod: 1.18, hpMod: 1.38, savingsMod: 1.05, torqueMod: 1.5 };
      default: return { gainMod: 1.15, hpMod: 1.20, savingsMod: 1.0, torqueMod: 1.0 };
    }
  }, [tuningType]);

  const chartData = useMemo(() => {
    const rawData = timeRange === '6m' ? BASE_DATA_ALL.slice(-6) : BASE_DATA_ALL;
    return rawData.map(d => {
      const repairs = Math.round(d.repairs * categoryMultiplier.repairMod);
      
      // Fuel metrics
      const fuelBefore = Number((categoryMultiplier.kmBase + (d.fuelBefore - 40)).toFixed(1));
      const fuelAfter = Number((fuelBefore * tuningMultiplier.gainMod).toFixed(1));
      const efficiencyGain = Number((((fuelAfter - fuelBefore) / fuelBefore) * 100).toFixed(1));
      const totalSavings = Math.round(d.totalSavings * tuningMultiplier.savingsMod * categoryMultiplier.repairMod);

      // Horsepower metrics
      const hpBefore = Number((categoryMultiplier.hpBase * (d.hpBefore / 11.2)).toFixed(1));
      const hpAfter = Number((hpBefore * tuningMultiplier.hpMod).toFixed(1));
      const hpGain = Number((((hpAfter - hpBefore) / hpBefore) * 100).toFixed(1));
      const torqueGain = Number((d.torqueGain * tuningMultiplier.torqueMod).toFixed(1));

      return {
        month: d.month,
        repairs,
        fuelBefore,
        fuelAfter,
        efficiencyGain,
        totalSavings,
        hpBefore,
        hpAfter,
        hpGain,
        torqueGain
      };
    });
  }, [timeRange, categoryMultiplier, tuningMultiplier]);

  const avgRepairs = useMemo(() => {
    const sum = chartData.reduce((acc, curr) => acc + curr.repairs, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  // Fuel specific averages
  const avgEfficiencyGain = useMemo(() => {
    const sum = chartData.reduce((acc, curr) => acc + curr.efficiencyGain, 0);
    return (sum / chartData.length).toFixed(1);
  }, [chartData]);

  const totalMonthlySavings = useMemo(() => {
    const lastMonth = chartData[chartData.length - 1];
    return (lastMonth.totalSavings / 1000).toFixed(1);
  }, [chartData]);

  // Horsepower specific averages
  const avgHpGain = useMemo(() => {
    const sum = chartData.reduce((acc, curr) => acc + curr.hpGain, 0);
    return (sum / chartData.length).toFixed(1);
  }, [chartData]);

  const avgHpAbsolute = useMemo(() => {
    const sum = chartData.reduce((acc, curr) => acc + (curr.hpAfter - curr.hpBefore), 0);
    return (sum / chartData.length).toFixed(1);
  }, [chartData]);

  const avgTorqueGain = useMemo(() => {
    const sum = chartData.reduce((acc, curr) => acc + curr.torqueGain, 0);
    return (sum / chartData.length).toFixed(1);
  }, [chartData]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d161a 0%, #122129 100%)',
      border: '1px solid rgba(0, 240, 255, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      color: '#f8fafc',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header Panel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>{metricMode === 'fuel' ? '⛽' : '🐎'}</span>
            <h3 style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 900,
              color: metricMode === 'fuel' ? 'var(--neon-cyan, #00f0ff)' : '#fbbf24',
              letterSpacing: '0.5px'
            }}>
              Monthly Performance & Simulasi {metricMode === 'fuel' ? 'Efisiensi BBM' : 'Lonjakan Tenaga (HP)'}
            </h3>
          </div>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '11px',
            color: '#94a3b8'
          }}>
            {metricMode === 'fuel'
              ? 'Pantauan volume servis bulanan vs rasio efisiensi konsumsi bahan bakar (km/L) sebelum & sesudah tuning'
              : 'Pantauan volume servis bulanan vs simulasi dyno lonjakan tenaga kuda (HP) & torsi akselerasi mesin'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            padding: '4px 8px',
            borderRadius: '4px',
            background: metricMode === 'fuel' ? 'rgba(0, 240, 255, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            color: metricMode === 'fuel' ? 'var(--neon-cyan, #00f0ff)' : '#fbbf24',
            border: metricMode === 'fuel' ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            ● Kategori Aktif: {metricMode === 'fuel' ? 'Fuel Efficiency' : 'Horsepower Gain'}
          </span>
        </div>
      </div>

      {/* DEDICATED HORIZONTAL BUTTON TOGGLE GROUP */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(5, 10, 14, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              PILIH KATEGORI METRIK GRAFIK (TOGGLE GROUP):
            </span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            Beralih kategori data Recharts secara interaktif
          </span>
        </div>

        {/* The Horizontal Button Toggle Group Bar */}
        <div
          role="group"
          aria-label="Horizontal button toggle group for Recharts data category"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '8px',
            width: '100%'
          }}
        >
          {/* Fuel Efficiency Button */}
          <button
            type="button"
            role="button"
            aria-pressed={metricMode === 'fuel'}
            onClick={() => switchMetricMode('fuel')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: metricMode === 'fuel'
                ? '2px solid #00f0ff'
                : '1px solid rgba(255, 255, 255, 0.12)',
              background: metricMode === 'fuel'
                ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.22) 0%, rgba(2, 132, 199, 0.3) 100%)'
                : 'rgba(15, 23, 42, 0.6)',
              color: metricMode === 'fuel' ? '#ffffff' : '#94a3b8',
              boxShadow: metricMode === 'fuel'
                ? '0 0 16px rgba(0, 240, 255, 0.35), inset 0 0 12px rgba(0, 240, 255, 0.1)'
                : 'none',
              transition: 'all 0.25s ease',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '22px',
                filter: metricMode === 'fuel' ? 'drop-shadow(0 0 6px #00f0ff)' : 'none'
              }}>⛽</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 900,
                  color: metricMode === 'fuel' ? '#00f0ff' : '#e2e8f0',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>Fuel Efficiency</span>
                  {metricMode === 'fuel' && (
                    <span style={{ fontSize: '9px', background: '#00f0ff', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 900 }}>
                      AKTIF
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: metricMode === 'fuel' ? '#7dd3fc' : '#64748b', marginTop: '2px' }}>
                  Konsumsi BBM (km/L) & Penghematan Biaya
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: '999px',
              background: metricMode === 'fuel' ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)',
              color: metricMode === 'fuel' ? '#021017' : '#94a3b8',
              whiteSpace: 'nowrap'
            }}>
              +{avgEfficiencyGain}% km/L
            </span>
          </button>

          {/* Horsepower Gain Button */}
          <button
            type="button"
            role="button"
            aria-pressed={metricMode === 'hp'}
            onClick={() => switchMetricMode('hp')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: metricMode === 'hp'
                ? '2px solid #f59e0b'
                : '1px solid rgba(255, 255, 255, 0.12)',
              background: metricMode === 'hp'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(234, 88, 12, 0.3) 100%)'
                : 'rgba(15, 23, 42, 0.6)',
              color: metricMode === 'hp' ? '#ffffff' : '#94a3b8',
              boxShadow: metricMode === 'hp'
                ? '0 0 16px rgba(245, 158, 11, 0.35), inset 0 0 12px rgba(245, 158, 11, 0.1)'
                : 'none',
              transition: 'all 0.25s ease',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '22px',
                filter: metricMode === 'hp' ? 'drop-shadow(0 0 6px #f59e0b)' : 'none'
              }}>🐎</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 900,
                  color: metricMode === 'hp' ? '#fbbf24' : '#e2e8f0',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>Horsepower Gain</span>
                  {metricMode === 'hp' && (
                    <span style={{ fontSize: '9px', background: '#f59e0b', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 900 }}>
                      AKTIF
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: metricMode === 'hp' ? '#fde68a' : '#64748b', marginTop: '2px' }}>
                  Tenaga Mesin Dyno (HP) & Lonjakan Torsi
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: '999px',
              background: metricMode === 'hp' ? '#f59e0b' : 'rgba(255, 255, 255, 0.08)',
              color: metricMode === 'hp' ? '#170c02' : '#94a3b8',
              whiteSpace: 'nowrap'
            }}>
              +{avgHpGain}% HP
            </span>
          </button>
        </div>
      </div>

      {/* Secondary Controls: Time Range, Motor Category, Tuning Package */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '8px 10px',
        background: '#091014',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Filter:</span>

        {/* Time range */}
        <div style={{ display: 'flex', background: '#05090c', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={() => { setTimeRange('6m'); setAnimKey(prev => prev + 1); }}
            style={{
              background: timeRange === '6m' ? (metricMode === 'fuel' ? '#00f0ff' : '#f59e0b') : 'transparent',
              color: timeRange === '6m' ? '#000' : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 9px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            6 Bulan
          </button>
          <button
            type="button"
            onClick={() => { setTimeRange('12m'); setAnimKey(prev => prev + 1); }}
            style={{
              background: timeRange === '12m' ? (metricMode === 'fuel' ? '#00f0ff' : '#f59e0b') : 'transparent',
              color: timeRange === '12m' ? '#000' : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 9px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            12 Bulan (1 Tahun)
          </button>
        </div>

        {/* Category selector */}
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value as any); setAnimKey(prev => prev + 1); }}
          style={{
            background: '#05090c',
            color: '#38bdf8',
            border: '1px solid rgba(0,240,255,0.4)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="all">Semua Tipe Motor</option>
          <option value="matic">Matik (Beat, Vario, Scoopy, NMAX)</option>
          <option value="bebek">Bebek (Supra, Revo, Jupiter Z)</option>
          <option value="sport">Sport (CBR150, R15, Vixion, Ninja)</option>
        </select>

        {/* Tuning package */}
        <select
          value={tuningType}
          onChange={(e) => { setTuningType(e.target.value as any); setAnimKey(prev => prev + 1); }}
          style={{
            background: '#05090c',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: '6px',
            padding: '5px 8px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="kirian">⚙️ Oprek Kirian CVT & Jalur Busi</option>
          <option value="harian">🔧 Servis Ringan & Reset Injeksi</option>
          <option value="boreup">🚀 Bore Up Kompresi Pas & Jetting</option>
        </select>
      </div>

      {/* KPI Highlight Cards (Adapts dynamically to Mode) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        marginBottom: '16px'
      }}>
        {/* Card 1: Repairs */}
        <div style={{
          background: metricMode === 'fuel' ? 'rgba(0, 240, 255, 0.05)' : 'rgba(245, 158, 11, 0.05)',
          border: metricMode === 'fuel' ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '10px 12px'
        }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Rata-rata Motor Diservis</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: metricMode === 'fuel' ? 'var(--neon-cyan, #00f0ff)' : '#fbbf24' }}>
              {avgRepairs}
            </span>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>unit/bulan</span>
          </div>
          <div style={{ fontSize: '9px', color: '#4ade80', marginTop: '2px' }}>▲ Meningkat 18.5% YOY</div>
        </div>

        {/* Card 2: Efficiency or Horsepower */}
        {metricMode === 'fuel' ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.05)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: '8px',
            padding: '10px 12px'
          }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Peningkatan Efisiensi BBM</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#4ade80' }}>+{avgEfficiencyGain}%</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>lebih irit</span>
            </div>
            <div style={{ fontSize: '9px', color: '#4ade80', marginTop: '2px' }}>Rata-rata tambah 8–11 km/L</div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '10px 12px'
          }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Lonjakan Tenaga Mesin (HP)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24' }}>+{avgHpGain}%</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>(+{avgHpAbsolute} HP)</span>
            </div>
            <div style={{ fontSize: '9px', color: '#fbbf24', marginTop: '2px' }}>Hasil pengujian dyno simulasi</div>
          </div>
        )}

        {/* Card 3: Savings or Torque Gain */}
        {metricMode === 'fuel' ? (
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '10px 12px'
          }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Estimasi Hemat Bensin Konsumen</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#fbbf24' }}>Rp {totalMonthlySavings} Juta</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>/bulan</span>
            </div>
            <div style={{ fontSize: '9px', color: '#fbbf24', marginTop: '2px' }}>Berdasarkan harga bensin harian</div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '10px 12px'
          }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Kenaikan Torsi Akselerasi</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8' }}>+{avgTorqueGain} Nm</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>pada RPM Menengah</span>
            </div>
            <div style={{ fontSize: '9px', color: '#38bdf8', marginTop: '2px' }}>Akselerasi stop & go lebih lincah</div>
          </div>
        )}

        {/* Card 4: Satisfaction */}
        <div style={{
          background: 'rgba(168, 85, 247, 0.05)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '8px',
          padding: '10px 12px'
        }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>
            {metricMode === 'fuel' ? 'Tingkat Kepuasan Tuning' : 'Kepuasan Dyno & Oprek'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#c084fc' }}>
              {metricMode === 'fuel' ? '98.9%' : '99.3%'}
            </span>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Review Positif</span>
          </div>
          <div style={{ fontSize: '9px', color: '#c084fc', marginTop: '2px' }}>
            {metricMode === 'fuel' ? 'Tarikan responsif & anti gredek' : 'Nafas panjang tanpa jebol'}
          </div>
        </div>
      </div>

      {/* Main Recharts Visualizer: Dual Axis ComposedChart */}
      <div style={{
        background: '#091014',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '8px',
        padding: '14px 10px 8px 10px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          padding: '0 8px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0' }}>
            {metricMode === 'fuel'
              ? 'Tren Perbaikan Motor (Bar) vs Konsumsi BBM Sebelum & Sesudah Tuning (Garis km/L)'
              : 'Tren Perbaikan Motor (Bar) vs Tenaga Mesin Sebelum & Sesudah Tuning (Garis HP / DK)'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            Sumber Data: Riwayat Konsultasi Dokter Motor & Nota Kuitansi Servis
          </div>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              key={`composed-${metricMode}-${animKey}`}
              data={chartData}
              margin={{ top: 10, right: 15, left: -5, bottom: 0 }}
            >
              <defs>
                <linearGradient id="barRepairGradientFuel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="barRepairGradientHp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#b45309" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis
                yAxisId="left"
                stroke={metricMode === 'fuel' ? '#00f0ff' : '#f59e0b'}
                tick={{ fontSize: 10, fill: metricMode === 'fuel' ? '#38bdf8' : '#fbbf24' }}
                label={{
                  value: 'Motor Diservis',
                  angle: -90,
                  position: 'insideLeft',
                  fill: metricMode === 'fuel' ? '#38bdf8' : '#fbbf24',
                  fontSize: 10
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={metricMode === 'fuel' ? '#22c55e' : '#f59e0b'}
                tick={{ fontSize: 10, fill: metricMode === 'fuel' ? '#4ade80' : '#fbbf24' }}
                domain={['dataMin - 3', 'dataMax + 3']}
                label={{
                  value: metricMode === 'fuel' ? 'km / Liter' : 'Horsepower (HP)',
                  angle: 90,
                  position: 'insideRight',
                  fill: metricMode === 'fuel' ? '#4ade80' : '#fbbf24',
                  fontSize: 10
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: metricMode === 'fuel' ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
                }}
                formatter={(value: any, name: any) => {
                  if (name === 'Motor Diservis') return [`${value} Unit`, name];
                  if (name === 'Sesudah Tuning (km/L)') return [`${value} km/L`, name];
                  if (name === 'Standar Sebelum Tuning') return [`${value} km/L`, name];
                  if (name === 'Tenaga Sesudah Tuning (HP)') return [`${value} HP (DK)`, name];
                  if (name === 'Tenaga Standar Pabrik') return [`${value} HP (DK)`, name];
                  return [value, name];
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px' }}
              />
              <Bar
                key={`bar-repairs-${metricMode}-${animKey}`}
                yAxisId="left"
                dataKey="repairs"
                name="Motor Diservis"
                fill={metricMode === 'fuel' ? 'url(#barRepairGradientFuel)' : 'url(#barRepairGradientHp)'}
                radius={[4, 4, 0, 0]}
                barSize={20}
                isAnimationActive={true}
                animationBegin={50}
                animationDuration={1100}
                animationEasing="ease-out"
              />
              {metricMode === 'fuel' ? (
                <>
                  <Line
                    key={`line-fuel-after-${animKey}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey="fuelAfter"
                    name="Sesudah Tuning (km/L)"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#22c55e' }}
                    activeDot={{ r: 5, fill: '#4ade80', stroke: '#fff' }}
                    isAnimationActive={true}
                    animationBegin={120}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Line
                    key={`line-fuel-before-${animKey}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey="fuelBefore"
                    name="Standar Sebelum Tuning"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2, fill: '#f97316' }}
                    isAnimationActive={true}
                    animationBegin={120}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </>
              ) : (
                <>
                  <Line
                    key={`line-hp-after-${animKey}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey="hpAfter"
                    name="Tenaga Sesudah Tuning (HP)"
                    stroke="#fbbf24"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#fbbf24' }}
                    activeDot={{ r: 5, fill: '#fef08a', stroke: '#fff' }}
                    isAnimationActive={true}
                    animationBegin={120}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Line
                    key={`line-hp-before-${animKey}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey="hpBefore"
                    name="Tenaga Standar Pabrik"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2, fill: '#94a3b8' }}
                    isAnimationActive={true}
                    animationBegin={120}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Chart: Gain Curve (%) */}
      <div style={{
        background: '#091014',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '8px',
        padding: '14px 10px 8px 10px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          padding: '0 8px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: metricMode === 'fuel' ? '#4ade80' : '#fbbf24' }}>
            {metricMode === 'fuel'
              ? '📈 Tren Persentase Efisiensi & Hemat Bahan Bakar Tiap Bulan (%)'
              : '📈 Tren Persentase Lonjakan Tenaga Dyno (Horsepower Gain %)'}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
            {metricMode === 'fuel'
              ? 'Formula: ((km/L Sesudah - km/L Sebelum) / km/L Sebelum) × 100%'
              : 'Formula: ((HP Sesudah - HP Sebelum) / HP Sebelum) × 100%'}
          </div>
        </div>

        <div style={{ width: '100%', height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              key={`area-chart-${metricMode}-${animKey}`}
              data={chartData}
              margin={{ top: 5, right: 15, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGainGradientFuel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="areaGainGradientHp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis
                stroke={metricMode === 'fuel' ? '#22c55e' : '#f59e0b'}
                tick={{ fontSize: 10, fill: metricMode === 'fuel' ? '#4ade80' : '#fbbf24' }}
                unit="%"
                domain={metricMode === 'fuel' ? [15, 35] : [10, 45]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: metricMode === 'fuel' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px'
                }}
                formatter={(val: any) => [
                  `+${val}% ${metricMode === 'fuel' ? 'Efisiensi' : 'Horsepower Gain'}`,
                  'Peningkatan'
                ]}
              />
              <Area
                key={`area-gain-${metricMode}-${animKey}`}
                type="monotone"
                dataKey={metricMode === 'fuel' ? 'efficiencyGain' : 'hpGain'}
                name={metricMode === 'fuel' ? 'Efisiensi BBM' : 'Lonjakan Tenaga'}
                stroke={metricMode === 'fuel' ? '#22c55e' : '#f59e0b'}
                strokeWidth={2}
                fill={metricMode === 'fuel' ? 'url(#areaGainGradientFuel)' : 'url(#areaGainGradientHp)'}
                isAnimationActive={true}
                animationBegin={80}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Actionable Mechanic Tips Footer */}
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          background: metricMode === 'fuel' ? 'rgba(0, 240, 255, 0.05)' : 'rgba(245, 158, 11, 0.05)',
          borderLeft: metricMode === 'fuel' ? '3px solid var(--neon-cyan, #00f0ff)' : '3px solid #f59e0b',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
            💡 <b style={{ color: metricMode === 'fuel' ? 'var(--neon-cyan, #00f0ff)' : '#fbbf24' }}>
              {metricMode === 'fuel' ? 'Tips Irit Bensin:' : 'Tips Lonjakan Tenaga:'}
            </b>{' '}
            {metricMode === 'fuel'
              ? 'Pembersihan throttle body rutin tiap 6.000 km dan roller CVT bobot seimbang mampu menjaga rasio konsumsi di atas 48 km/L tanpa mengorbankan top speed.'
              : 'Kombinasi noken as (kem) durasi 255°, porting polish intake, dan busi racing mendongkrak tenaga hingga +2.8 HP tanpa mengorbankan ketahanan harian.'}
          </div>
          <a
            href="https://s.shopee.co.id/2BF5CwWmtP"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#fff',
              background: '#f97316',
              padding: '4px 8px',
              borderRadius: '4px',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(249, 115, 22, 0.4)'
            }}
          >
            🛒 Beli Paket {metricMode === 'fuel' ? 'Tune Up Hemat' : 'Racing & Noken As'} di Shopee
          </a>
        </div>
      </div>

      {/* Scoped CSS for Recharts Bar upward animations & hover glow */}
      <style>{`
        #tpanel-performance .recharts-bar-rectangle {
          transition: filter 0.25s ease, opacity 0.25s ease;
        }
        #tpanel-performance .recharts-bar-rectangle:hover {
          filter: brightness(1.25) drop-shadow(0 0 10px ${metricMode === 'fuel' ? 'rgba(0, 240, 255, 0.8)' : 'rgba(251, 191, 36, 0.8)'});
          cursor: pointer;
        }
        #tpanel-performance .recharts-bar-rectangles {
          transform-origin: bottom center;
        }
        #tpanel-performance button[role="button"]:hover {
          transform: translateY(-1px);
        }
        #tpanel-performance button[role="button"]:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
