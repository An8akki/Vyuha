import React from 'react';
import './Overview.css';
import { Calendar, ChevronRight, ArrowRight } from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import { useNavigate } from 'react-router-dom';

interface AppointmentsProps {
  onNavigate: (page: string, data?: any) => void;
}

const Appointments: React.FC<AppointmentsProps> = ({ onNavigate }) => {
  const { patients, loading, error, refresh } = usePortalData();
  const navigate = useNavigate();

  return (
    <div className="overview-page fade-in">
      {loading && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--text-secondary)' }}>Loading appointment schedule…</div>}
      {error && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--risk-high)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>Retry</button></div>}
      
      <div className="card overview-patients-card card-3d" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div className="card-header" style={{ padding: 24, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Calendar size={20} color="var(--primary)" />
              <h3 className="card-title" style={{ fontSize: '1.2rem' }}>Today's Appointments</h3>
            </div>
            <p className="card-subtitle">Select an appointment to review clinical history & AMR predictions</p>
          </div>
          <button className="btn btn-ghost btn-sm hover-3d">
            View Full Schedule <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '0 24px 24px', flex: 1 }}>
          <div className="appointment-list">
            {patients.slice(0, 15).map((p, idx) => {
              // Mocking appointment times
              const hour = 9 + Math.floor(idx / 2);
              const min = idx % 2 === 0 ? '00' : '30';
              const time = `${hour > 12 ? hour - 12 : hour}:${min} ${hour >= 12 ? 'PM' : 'AM'}`;
              
              return (
                <div key={p.id} className="appointment-row hover-lift-sm hover-3d" onClick={() => navigate('/clinical-view', { state: { patient: p } })} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div className="apt-time" style={{ fontWeight: 600, color: 'var(--text-primary)', width: 80 }}>{time}</div>
                  
                  <div className="apt-patient" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="patient-avatar-sm" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, background: `hsl(${idx * 40}, 70%, 90%)`, color: `hsl(${idx * 40}, 70%, 30%)` }}>
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="patient-name-sm" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{p.name}</div>
                      <div className="apt-id" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ID: {p.id} · {p.ward}</div>
                    </div>
                  </div>
                  
                  <div className="apt-risk" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 200 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>AMR Predictive Risk</div>
                    <div className="risk-cell" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      <div className="mini-risk-bar-bg" title={`${p.riskScore}%`} style={{ flex: 1, height: 6, background: 'var(--bg-app)', borderRadius: 10, overflow: 'hidden' }}>
                        <div className={`mini-risk-bar ${p.riskLevel}`} style={{ height: '100%', width: `${p.riskScore}%`, background: p.riskLevel === 'high' ? 'var(--risk-high)' : p.riskLevel === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)', borderRadius: 10 }} />
                      </div>
                      <span className={`risk-pct ${p.riskLevel}`} style={{ fontWeight: 700, fontSize: '0.9rem', color: p.riskLevel === 'high' ? 'var(--risk-high)' : p.riskLevel === 'medium' ? 'var(--risk-medium)' : 'var(--text-secondary)' }}>{p.riskScore}%</span>
                    </div>
                  </div>
                  
                  <div className="apt-action" style={{ width: 180, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm apt-btn btn-3d">
                      Start Appointment <ArrowRight size={14} style={{ marginLeft: 4 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Appointments;
