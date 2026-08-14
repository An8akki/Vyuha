import React, { useState, useEffect } from 'react';
import './Overview.css';
import {
  Users, Activity, Clock, Check, X,
  Phone, FileText, MessageSquare
} from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import CalendarWidget from '../components/CalendarWidget';

interface OverviewProps {
  onNavigate: (page: string, data?: any) => void;
}

const UserAvatar = ({ name, size = 40 }: { name: string, size?: number }) => {
  return (
    <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=e5e7eb`} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
  );
};

const AnimatedNumber: React.FC<{ end: number }> = ({ end }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 1000;
    const steps = 20;
    const stepTime = dur / steps;
    const inc = end / steps;
    let curr = 0;
    const timer = setInterval(() => {
      curr += inc;
      if (curr >= end) {
        setVal(end);
        clearInterval(timer);
      } else {
        setVal(Math.floor(curr));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [end]);
  return <>{val}</>;
};

const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const { patients, dashboard, loading, error, refresh } = usePortalData();
  const navigate = useNavigate();

  const totalPatients = 2000;
  const todayPatients = dashboard?.patientsAssessed || 68;
  const todayAppointments = 85;

  const pieData = [
    { name: 'New Patients', value: 45, color: '#F5A623' },
    { name: 'Old Patients', value: 35, color: '#0A5FE8' },
    { name: 'Total Patients', value: 20, color: '#E3EAF5' },
  ];

  const [requests, setRequests] = useState([
    { id: 1, name: 'Maria Sarafat', sub: 'Cold' },
    { id: 2, name: 'Jhon Deo', sub: 'Over swtting' },
  ]);

  const seenPatients = (() => {
    try { return JSON.parse(sessionStorage.getItem('seen_patients') || '[]'); }
    catch { return []; }
  })();

  const todayApptList = patients
    .filter(p => !seenPatients.includes(p.id))
    .slice(0, 4)
    .map((p, i) => ({
      ...p,
      time: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'][i] || '11:00 AM'
    }));

  const nextPatient = todayApptList[0] || patients[0] || { name: 'Sanath Deo', age: 38, gender: 'Male' };

  return (
    <div className="overview-page fade-in" style={{ padding: '0 24px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {loading && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--text-secondary)' }}>Loading clinical data…</div>}
      {error && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--risk-high)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>Retry</button></div>}
      
      {/* Top Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24 }}>
        {[
          { label: 'Total Patient', value: `${totalPatients}+`, sub: 'Till Today', icon: Users, color: '#0A5FE8' },
          { label: 'Today Patient', value: todayPatients, sub: '21 Dec-2026', icon: Activity, color: '#0A5FE8' },
          { label: 'Today Appointments', value: todayAppointments, sub: '21 Dec-2026', icon: Clock, color: '#0A5FE8' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card-3d hover-lift" style={{ display: 'flex', alignItems: 'center', padding: 24, gap: 24, background: 'white' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(10, 95, 232, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color, border: `2px solid ${stat.color}` }}>
                <Icon size={28} />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {typeof stat.value === 'number' ? <AnimatedNumber end={stat.value} /> : stat.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>{stat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 24, marginBottom: 24 }}>
        
        {/* Patients Summary Pie */}
        <div className="card-3d" style={{ background: 'white' }}>
          <div className="card-header" style={{ padding: 20 }}>
            <h3 className="card-title">Patients Summary Dec 2026</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 16 }}>
              {pieData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, background: d.color, borderRadius: 2 }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Today Appointment List */}
        <div className="card-3d" style={{ background: 'white', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: 20, paddingBottom: 12 }}>
            <h3 className="card-title">Today Appointment</h3>
          </div>
          <div style={{ padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {todayApptList.map((appt, i) => (
                <div key={i} className="hover-lift" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: '12px 16px', background: '#F9FAFB', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', width: 60 }}>{appt.time}</div>
                  
                  <UserAvatar name={appt.name} />
                  
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>{appt.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {appt.id} · {appt.ward}</div>
                  </div>
                  
                  <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AMR Predictive Risk</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <div style={{ height: 4, background: '#E3EAF5', borderRadius: 2, flex: 1 }}>
                        <div style={{ height: '100%', width: `${appt.riskScore}%`, background: appt.riskScore >= 70 ? '#F04455' : appt.riskScore >= 40 ? '#F5A623' : '#16B77A', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: appt.riskScore >= 70 ? '#F04455' : appt.riskScore >= 40 ? '#F5A623' : '#16B77A' }}>{appt.riskScore}%</span>
                    </div>
                  </div>

                  <button className="btn btn-primary btn-sm btn-3d" onClick={() => onNavigate('clinical-view', { patient: appt })} style={{ background: '#48C7BA', borderColor: '#48C7BA', padding: '8px 16px', marginLeft: 'auto' }}>
                    Start Appointment &rarr;
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, paddingBottom: 16 }}>
              <button style={{ color: 'var(--primary)', padding: 0, fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>See All</button>
            </div>
          </div>
        </div>

        {/* Next Patient Details */}
        <div className="card-3d" style={{ background: 'var(--bg-app)', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: 20, paddingBottom: 12 }}>
            <h3 className="card-title" style={{ color: 'var(--primary)' }}>Next Patient Details</h3>
          </div>
          <div style={{ padding: '0 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <UserAvatar name={nextPatient.name} size={56} />
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nextPatient.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Health Checkup</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Patient ID</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{nextPatient.id || '0220092020005'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>D. O.B</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>15 January 1989</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Sex</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{nextPatient.gender}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Weight</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>59 Kg</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Last Appointment</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>15 Dec - 2026</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Height</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>172 cm</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Reg. Date</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>10 Dec 2026</div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: 12 }}>Patient History</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '6px 12px', background: '#FEF3C7', color: '#B45309', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>Asthma</span>
                <span style={{ padding: '6px 12px', background: 'rgba(10, 95, 232, 0.1)', color: '#0A5FE8', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>Hypertension</span>
                <span style={{ padding: '6px 12px', background: '#FEE2E2', color: '#B91C1C', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>Fever</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, fontSize: '0.75rem' }}><Phone size={14} /> (308) 555-0102</button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, fontSize: '0.75rem', background: 'white' }}><FileText size={14} /> Document</button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, fontSize: '0.75rem', background: 'white' }}><MessageSquare size={14} /> Chat</button>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <button style={{ color: 'var(--primary)', padding: 0, fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>Last Prescriptions</button>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 24 }}>
        
        {/* Patients Review */}
        <div className="card-3d" style={{ background: 'white' }}>
          <div className="card-header" style={{ padding: 20 }}>
            <h3 className="card-title">Patients Review</h3>
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Excellent', val: 70, color: '#0A5FE8' },
              { label: 'Great', val: 30, color: '#16B77A' },
              { label: 'Good', val: 20, color: '#F5A623' },
              { label: 'Average', val: 40, color: '#48C7BA' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{r.label}</span>
                <div style={{ height: 6, background: 'var(--bg-app)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${r.val}%`, background: r.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Appointment Request */}
        <div className="card-3d" style={{ background: 'white', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: 20, paddingBottom: 12 }}>
            <h3 className="card-title">Appointment Request</h3>
          </div>
          <div style={{ padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {requests.map((req) => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <UserAvatar name={req.name} size={40} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>{req.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{req.sub}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRequests(prev => prev.filter(r => r.id !== req.id))} style={{ width: 28, height: 28, borderRadius: 4, border: 'none', background: 'rgba(22, 183, 122, 0.15)', color: '#16B77A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Check size={16} /></button>
                    <button onClick={() => setRequests(prev => prev.filter(r => r.id !== req.id))} style={{ width: 28, height: 28, borderRadius: 4, border: 'none', background: 'rgba(240, 68, 85, 0.15)', color: '#F04455', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                </div>
              ))}
              {requests.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No pending requests.</div>}
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 16, paddingBottom: 16 }}>
              <button style={{ color: 'var(--primary)', padding: 0, fontSize: '0.85rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>See All</button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <CalendarWidget />
        </div>

      </div>
    </div>
  );
};

export default Overview;
