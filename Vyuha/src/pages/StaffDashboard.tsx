import React, { useState } from 'react';
import { CalendarPlus, User, Clock, CheckCircle, Users, Activity, FileText } from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import './Overview.css';

const StaffDashboard: React.FC = () => {
  const { addAppointment, appointments, patients } = usePortalData() as any;
  const [name, setName] = useState('');
  const [ward, setWard] = useState('General Ward');
  const [time, setTime] = useState('10:00');
  const [reason, setReason] = useState('Suspected Infection');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Create a mock appointment/patient record
    const newAppointment = {
      id: `P${Math.floor(100 + Math.random() * 900)}`,
      name,
      ward,
      time,
      reason,
      // Default risk values so it renders nicely in Doctor's view
      riskScore: Math.floor(20 + Math.random() * 60),
      riskLevel: 'medium',
      vitals: { temperature: '98.6', heartRate: '80', bloodPressure: '120/80', spo2: '98' }
    };

    addAppointment(newAppointment);
    setSubmitted(true);
    
    // Reset form after delay
    setTimeout(() => {
      setName('');
      setSubmitted(false);
    }, 2500);
  };

  const totalAppointments = appointments.length;
  const activePatients = patients.length;
  const highRiskCount = appointments.filter((a: any) => a.riskLevel === 'high').length;

  return (
    <div className="overview-page fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <div className="card card-3d" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(30, 58, 138, 0.1)', borderRadius: '12px' }}>
            <CalendarPlus size={24} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{totalAppointments}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Queued Appointments</div>
          </div>
        </div>
        
        <div className="card card-3d" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
            <Users size={24} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{activePatients}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total Active Patients</div>
          </div>
        </div>

        <div className="card card-3d" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
            <Activity size={24} color="var(--risk-high)" />
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{highRiskCount}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>High-Risk in Queue</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Queue */}
        <div className="card card-3d" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px' }}>
          <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={20} color="var(--primary)" />
              <h2 className="card-title" style={{ fontSize: '1.2rem' }}>Live Schedule Queue</h2>
            </div>
            <p className="card-subtitle">These patients are waiting to be seen by the doctor.</p>
          </div>
          <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
            {appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No appointments queued.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appointments.map((apt: any) => (
                  <div key={apt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-app)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{apt.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>({apt.id})</span></div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{apt.reason} · {apt.ward}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        {apt.time || "09:00 AM"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="card card-3d" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
          <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CalendarPlus size={20} color="var(--primary)" />
              <h2 className="card-title" style={{ fontSize: '1.2rem' }}>Schedule New Appointment</h2>
            </div>
          </div>
          
          <div className="card-body" style={{ padding: '24px' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--success)' }}>
                <CheckCircle size={48} style={{ margin: '0 auto 16px' }} />
                <h3>Appointment Scheduled!</h3>
                <p style={{ color: 'var(--text-secondary)' }}>It has been added to the doctor's live queue.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Patient Full Name</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 8 }}>
                    <User size={18} color="var(--text-muted)" />
                    <input required value={name} onChange={e => setName(e.target.value)} type="text" placeholder="e.g. Jane Doe" style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Time</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 8 }}>
                      <Clock size={18} color="var(--text-muted)" />
                      <input type="time" required value={time} onChange={e => setTime(e.target.value)} style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ward</label>
                    <select value={ward} onChange={e => setWard(e.target.value)} style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 8, fontSize: '1rem', outline: 'none' }}>
                      <option>General Ward</option>
                      <option>ICU</option>
                      <option>Emergency</option>
                      <option>Outpatient</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Reason for Visit</label>
                  <input type="text" required value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Suspected UTI, Fever" style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px 14px', borderRadius: 8, fontSize: '1rem', outline: 'none' }} />
                </div>

                <button type="submit" className="btn btn-primary btn-3d" style={{ marginTop: 8, padding: '12px', fontSize: '1.05rem' }}>
                  Schedule Patient
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
