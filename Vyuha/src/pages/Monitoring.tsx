import React, { useState } from 'react';
import './Monitoring.css';
import {
  ArrowUpRight, ArrowDownRight, Minus, Eye, CheckCircle,
  AlertTriangle, TrendingUp, Activity, Clock
} from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import type { Patient } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

const RiskTrend: React.FC<{ trend: number }> = ({ trend }) => {
  if (trend > 0) return <span className="trend up"><ArrowUpRight size={13} />+{trend}%</span>;
  if (trend < 0) return <span className="trend down"><ArrowDownRight size={13} />{trend}%</span>;
  return <span className="trend flat"><Minus size={13} />Stable</span>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '10px 14px',
        boxShadow: 'var(--shadow-md)', fontFamily: 'Roboto'
      }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{payload[0].value}%</div>
        {payload[0].value >= 70 && <div style={{ fontSize: '0.72rem', color: 'var(--risk-high)', marginTop: 2, fontWeight: 600 }}>HIGH RISK</div>}
      </div>
    );
  }
  return null;
};

const PatientDetail: React.FC<{ patient: Patient; onBack: () => void }> = ({ patient, onBack }) => (
  <div className="patient-detail fade-in">
    <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>
      ← Back to Monitoring
    </button>

    {/* Header */}
    <div className="pd-header">
      <div className="pd-header-left">
        <div className="pd-avatar">{patient.name.split(' ').map(n => n[0]).join('')}</div>
        <div>
          <div className="pd-name">{patient.name}</div>
          <div className="pd-meta">{patient.id} · {patient.age}/{patient.gender.charAt(0)} · {patient.ward} · {patient.consultant}</div>
        </div>
      </div>
      <div className={`pd-risk-display risk-${patient.riskLevel}`}>
        <div className="pd-risk-value">{patient.riskScore}%</div>
        <div className="pd-risk-label">{patient.riskLevel.toUpperCase()} RISK</div>
      </div>
    </div>

    <div className="pd-grid">
      {/* Risk Timeline */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Risk Timeline Today</h3>
            <p className="card-subtitle">How risk evolved through the admission</p>
          </div>
          <RiskTrend trend={patient.riskTrend} />
        </div>
        <div className="card-body">
          <div className="monitoring-timeline">
            {patient.monitoringTimeline.map((entry, i) => (
              <div key={i} className="mt-entry">
                <div className="mt-node-col">
                  <div className={`mt-node ${entry.risk >= 70 ? 'high' : entry.risk >= 50 ? 'medium' : 'low'}`}>
                    {entry.risk >= 70 ? <AlertTriangle size={12} /> : <Activity size={12} />}
                  </div>
                  {i < patient.monitoringTimeline.length - 1 && <div className="mt-connector" />}
                </div>
                <div className="mt-content">
                  <div className="mt-time"><Clock size={11} /> {entry.time}</div>
                  <div className="mt-event">{entry.event}</div>
                  <div className="mt-detail">{entry.detail}</div>
                </div>
                <div className={`mt-risk ${entry.risk >= 70 ? 'high' : entry.risk >= 50 ? 'medium' : 'low'}`}>
                  {entry.risk}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Chart */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">AMR Risk Over Time</h3>
        </div>
        <div style={{ padding: '24px', paddingTop: '16px' }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={patient.monitoringTimeline.map(entry => ({ time: entry.time, risk: entry.risk }))}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A5FE8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0A5FE8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF5" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontFamily: 'Roboto', fontSize: 11, fill: '#72809A' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={[30, 90]}
                tick={{ fontFamily: 'Roboto', fontSize: 11, fill: '#72809A' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke="#F04455" strokeDasharray="5 3" strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey="risk"
                stroke="#0A5FE8"
                strokeWidth={2.5}
                fill="url(#riskGrad)"
                dot={{ fill: '#0A5FE8', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* What Changed */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">What Changed?</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'Roboto' }}>Risk factors added</span>
        </div>
        <div className="card-body">
          {patient.monitoringTimeline.map((change, i) => (
            <div key={i} className="change-row">
              <div className="change-dot lab" />
              <div className="change-content">
                <div className="change-label">{change.event}</div>
                <div className="change-time">{change.time}</div>
              </div>
              <div className="change-impact">{change.risk}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Culture Outcome (if available) */}
      {patient.cultureOutcome && (
        <div className="card outcome-card">
          <div className="card-header">
            <h3 className="card-title">Outcome Feedback</h3>
            <span className="outcome-available-badge">Culture Result Available</span>
          </div>
          <div className="card-body">
            <div className="outcome-grid">
              <div className="outcome-col">
                <div className="outcome-label">AI Prediction</div>
                <div className={`outcome-value risk-${patient.riskLevel}`}>
                  {patient.cultureOutcome.predicted}% — {patient.cultureOutcome.predictedLevel}
                </div>
              </div>
              <div className="outcome-vs">→</div>
              <div className="outcome-col">
                <div className="outcome-label">Actual Result</div>
                <div className="outcome-value resistance">
                  {patient.cultureOutcome.actual}
                </div>
                <div className="outcome-organism">{patient.cultureOutcome.organism}</div>
                <div className="outcome-resistance">{patient.cultureOutcome.resistance}</div>
              </div>
            </div>

            <div className={`outcome-alignment ${patient.cultureOutcome.aligned ? 'aligned' : 'not-aligned'}`}>
              <CheckCircle size={16} />
              {patient.cultureOutcome.aligned ? 'Prediction aligned with confirmed outcome' : 'Prediction did not align with outcome'}
            </div>

            <div className="outcome-meta">
              <span>Prediction: 10:05 AM · 14 Aug 2026</span>
              <span>Culture: Simulated Result</span>
              <span>Model: AMR-GUARD v1.0</span>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

const Monitoring: React.FC<{ onNavigate: (page: string, data?: any) => void }> = ({ onNavigate }) => {
  const { patients, loading, error, refresh } = usePortalData();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  if (selectedPatient) {
    return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} />;
  }

  return (
    <div className="monitoring-page fade-in">
      {loading && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--text-secondary)' }}>Loading monitored patients…</div>}
      {error && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--risk-high)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>Retry</button></div>}
      <div className="monitoring-header">
        <div>
          <h2 className="monitoring-title">Active AMR Monitoring</h2>
          <p className="monitoring-sub">Real-time risk tracking for admitted patients</p>
        </div>
        <div className="monitoring-stats">
          <div className="ms-item">
            <span className="ms-value">{patients.length}</span>
            <span className="ms-label">Monitored</span>
          </div>
          <div className="ms-item high">
            <span className="ms-value">{patients.filter(p => p.riskLevel === 'high').length}</span>
            <span className="ms-label">High Risk</span>
          </div>
          <div className="ms-item">
            <span className="ms-value">{patients.filter(p => p.riskTrend > 0).length}</span>
            <span className="ms-label">Trending Up</span>
          </div>
        </div>
      </div>

      <div className="card monitoring-table-card">
        <div className="card-header">
          <h3 className="card-title">Monitored Patients</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'Roboto' }}>
            Last updated: 10:05 AM
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Ward</th>
                <th>Initial Risk</th>
                <th>Current Risk</th>
                <th>Trend</th>
                <th>Last Updated</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const initial = p.monitoringTimeline[0]?.risk || p.riskScore - 20;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="patient-avatar-sm">{p.name.split(' ').map(n => n[0]).join('')}</div>
                        <div>
                          <div className="patient-name-sm">{p.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'Roboto' }}>{p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="ward-tag">{p.ward}</span></td>
                    <td>
                      <span style={{ fontFamily: 'Roboto', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {initial}%
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'Roboto', fontWeight: 700, fontSize: '1rem', color: p.riskLevel === 'high' ? 'var(--risk-high)' : p.riskLevel === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)' }}>
                        {p.riskScore}%
                      </span>
                    </td>
                    <td>
                      <RiskTrend trend={p.riskTrend} />
                    </td>
                    <td style={{ fontFamily: 'Roboto', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {p.monitoringTimeline[p.monitoringTimeline.length - 1]?.time || 'N/A'}
                    </td>
                    <td><span className={`risk-badge ${p.riskLevel}`}>{p.status}</span></td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedPatient(p)}
                      >
                        <Eye size={13} /> Monitor
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
