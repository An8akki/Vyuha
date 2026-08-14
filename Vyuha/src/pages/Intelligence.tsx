import React, { useEffect, useState } from 'react';
import './Intelligence.css';
import {
  AlertTriangle, TrendingUp, Filter, BarChart2,
  Activity, Info, Hospital, GitBranch
} from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import { getIntelligence } from '../api/client';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '10px 14px',
        boxShadow: 'var(--shadow-md)', fontFamily: 'Roboto'
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ fontSize: '0.9rem', fontWeight: 700, color: p.color }}>
            {p.value}% {p.dataKey === 'pressure' ? 'AMR Pressure' : ''}
          </div>
        ))}
        {payload[0]?.payload?.forecast && (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>Prototype Forecast</div>
        )}
      </div>
    );
  }
  return null;
};

const Intelligence: React.FC = () => {
  const { dashboard } = usePortalData();
  const [selectedWard, setSelectedWard] = useState('ICU');
  const [selectedOrganism, setSelectedOrganism] = useState('E. coli');
  const [dateRange, setDateRange] = useState('August 2026');
  const [antibiogramData, setAntibiogramData] = useState<{
    organism: string; ward: string; lastUpdated: string;
    data: Array<{ antibiotic: string; susceptible: number; resistant: number; trend: string }>;
  }>({ organism: '', ward: '', lastUpdated: '', data: [] });
  const [amrTrends, setAmrTrends] = useState<Array<{ day: string; pressure: number; forecast?: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wardOverview = dashboard?.wards || [];

  const loadIntelligence = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getIntelligence(selectedWard, selectedOrganism);
      setAntibiogramData({ organism: selectedOrganism, ward: selectedWard, lastUpdated: dateRange, data: data.antibiogram });
      setAmrTrends(data.trend);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load intelligence.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadIntelligence(); }, [selectedWard, selectedOrganism, dateRange]);

  const emergingSignals = antibiogramData.data.filter(row => row.resistant >= 40).slice(0, 3).map(row => ({
    title: `Observed ${row.antibiotic} resistance`,
    detail: `${row.resistant}% resistant among matching source records`,
    severity: row.resistant >= 60 ? 'high' : 'medium',
    ward: selectedWard,
  }));
  const currentPressure = amrTrends.length ? amrTrends[amrTrends.length - 1].pressure : undefined;

  return (
    <div className="intelligence-page">
      {/* Filters */}
      <div className="card intel-filters">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Filter size={14} color="var(--text-secondary)" />
          <span style={{ fontFamily: 'Roboto', fontWeight: 500, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Filters</span>
        </div>
        <div className="intel-filter-row">
          <div className="form-group">
            <label className="form-label">Ward</label>
            <select className="form-select" value={selectedWard} onChange={e => setSelectedWard(e.target.value)}>
              <option>ICU</option>
              <option>Emergency</option>
              <option>Ward A</option>
              <option>Ward B</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Organism</label>
            <select className="form-select" value={selectedOrganism} onChange={e => setSelectedOrganism(e.target.value)}>
              <option>E. coli</option>
              <option>Klebsiella pneumoniae</option>
              <option>Staphylococcus aureus</option>
              <option>Pseudomonas aeruginosa</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date Range</label>
            <select className="form-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option>August 2026</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>Last 12 months</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => void loadIntelligence()} disabled={loading}>
            {loading ? 'Applying…' : 'Apply Filters'}
          </button>
        </div>
        {error && <div style={{ color: 'var(--risk-high)', fontSize: '0.78rem', marginTop: 12 }}>{error}</div>}
      </div>

      <div className="intel-main-grid">
        {/* Left: Large sections */}
        <div className="intel-left">
          {/* Local Antibiogram */}
          <div className="card card-3d">
            <div className="card-header">
              <div>
                <h3 className="card-title">Local Antibiogram</h3>
                <p className="card-subtitle">{selectedOrganism} · {selectedWard} · {dateRange}</p>
              </div>
              <div className="intel-badge">
                <BarChart2 size={13} />
                {antibiogramData.data.length} Antibiotics
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Antibiotic</th>
                    <th>Susceptibility</th>
                    <th>Resistance</th>
                    <th>Trend</th>
                    <th>Susceptibility Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {antibiogramData.data.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{row.antibiotic}</td>
                      <td>
                        <span className={`abio-suscept ${row.susceptible >= 70 ? 'good' : row.susceptible >= 40 ? 'medium' : 'poor'}`}>
                          {row.susceptible}%
                        </span>
                      </td>
                      <td>
                        <span className={`abio-suscept ${row.resistant >= 60 ? 'poor' : row.resistant >= 30 ? 'medium' : 'good'}`}>
                          {row.resistant}%
                        </span>
                      </td>
                      <td>
                        <span className={`trend-tag ${row.trend}`}>
                          {row.trend === 'stable' ? '→ Stable' : '↓ Declining'}
                        </span>
                      </td>
                      <td style={{ width: 180 }}>
                        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${row.susceptible}%`,
                            background: row.susceptible >= 70 ? '#16B77A' : row.susceptible >= 40 ? '#F5A623' : '#F04455',
                            borderRadius: 4,
                            transition: 'width 1.5s ease-out'
                          }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AMR Pressure Trend Chart */}
          <div className="card card-3d">
            <div className="card-header">
              <div>
                <h3 className="card-title">AMR Pressure Trend</h3>
                <p className="card-subtitle">{selectedWard} · observed resistant-culture prevalence by source date</p>
              </div>
              {currentPressure != null && <span className="intel-badge blue">Latest observed: {currentPressure}%</span>}
            </div>
            <div style={{ padding: '24px', paddingTop: '12px' }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={amrTrends}>
                  <defs>
                    <linearGradient id="pressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A5FE8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0A5FE8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF5" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontFamily: 'Roboto', fontSize: 11, fill: '#72809A' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    domain={[30, 80]}
                    tick={{ fontFamily: 'Roboto', fontSize: 11, fill: '#72809A' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={70} stroke="#F04455" strokeDasharray="5 3" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="pressure"
                    stroke="#0A5FE8"
                    strokeWidth={2.5}
                    fill="url(#pressGrad)"
                    isAnimationActive={true}
                    animationDuration={1500}
                    animationEasing="ease-out"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={props.key}
                          cx={cx} cy={cy} r={4}
                          fill={payload.forecast ? '#F5A623' : '#0A5FE8'}
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="forecast-disclaimer">
                <Info size={12} />
                Values are calculated only from matching de-identified culture and susceptibility records.
              </div>
            </div>
          </div>
        </div>

        {/* Right: Ward + Signals + Network */}
        <div className="intel-right">
          {/* Ward Risk */}
          <div className="card card-3d">
            <div className="card-header"><h3 className="card-title">Ward Risk Overview</h3></div>
            <div className="card-body">
              {wardOverview.map((w, i) => (
                <div key={i} className="ward-intel-row">
                  <div className="ward-intel-left">
                    <div className="ward-intel-name">{w.ward}</div>
                    <div className="ward-intel-stats">{w.patientsAssessed} assessed · {w.highRisk} high risk</div>
                  </div>
                  <div className="ward-intel-bar-col">
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
                      <div style={{
                        height: '100%',
                        width: `${w.avgRisk}%`,
                        background: w.risk === 'high' ? 'var(--risk-high)' : w.risk === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)',
                        borderRadius: 4,
                        transition: 'width 1.5s ease-out'
                      }} />
                    </div>
                    <span className="ward-intel-pct">{w.avgRisk}%</span>
                  </div>
                  <span className={`risk-badge ${w.risk}`}>{w.risk.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Emerging Signals */}
          <div className="card card-3d">
            <div className="card-header">
              <h3 className="card-title">Emerging Signals</h3>
              <span className="intel-badge red">{emergingSignals.filter(s => s.severity === 'high').length} Critical</span>
            </div>
            <div className="card-body" style={{ padding: '8px 0' }}>
              {emergingSignals.map((signal, i) => (
                <div key={i} className={`signal-row ${signal.severity}`}>
                  <div className={`signal-icon ${signal.severity}`}>
                    {signal.severity === 'high' ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
                  </div>
                  <div className="signal-content">
                    <div className="signal-title">{signal.title}</div>
                    <div className="signal-detail">{signal.detail}</div>
                    <div className="signal-ward">{signal.ward}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Intelligence — Roadmap */}
          <div className="card network-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={16} color="var(--primary)" />
                <h3 className="card-title">Network Intelligence</h3>
              </div>
              <span className="roadmap-badge">Prototype / Future Architecture</span>
            </div>
            <div className="card-body">
              <div className="network-diagram" style={{ position: 'relative', height: 160, width: '100%', marginBottom: 16 }}>
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path d="M 40 40 Q 150 100 150 130" fill="none" stroke="var(--primary)" strokeWidth="2" className="network-svg-line" />
                  <path d="M 150 40 Q 150 100 150 130" fill="none" stroke="var(--primary)" strokeWidth="2" className="network-svg-line" />
                  <path d="M 260 40 Q 150 100 150 130" fill="none" stroke="var(--primary)" strokeWidth="2" className="network-svg-line" />
                </svg>
                
                {['Hospital A', 'Hospital B', 'Hospital C'].map((h, i) => (
                  <div key={i} className="network-node" style={{ position: 'absolute', top: 20, left: i === 0 ? 20 : i === 1 ? '50%' : 'calc(100% - 20px)', transform: 'translateX(-50%)', flexDirection: 'column' }}>
                    <div className="nn-icon" style={{ boxShadow: '0 0 10px rgba(72, 199, 186, 0.4)' }}><Hospital size={16} /></div>
                    <div className="nn-label" style={{ fontSize: '0.65rem' }}>{h}</div>
                  </div>
                ))}
                
                <div className="network-center" style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '8px 16px' }}>
                  <div className="nc-icon"><GitBranch size={16} color="white" /></div>
                  <div className="nc-label" style={{ fontSize: '0.75rem' }}>Federated Engine</div>
                </div>
              </div>
              <div className="network-disclaimer">
                <Info size={12} />
                Raw patient data remains within participating hospitals. Only approved model updates are exchanged.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Intelligence;
