import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Shield, ClipboardList, Info,
  Pill, Activity, ArrowRight, Clock, ChevronLeft,
  ThumbsUp, ThumbsDown, Calendar as CalendarIcon, User, Plus
} from 'lucide-react';
import { submitClinicianAction, type Patient } from '../api/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface ClinicalViewProps {
  onNavigate?: (page: string) => void;
}

const RiskGauge: React.FC<{ score: number; level: string }> = ({ score, level }) => {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);
  const color = level === 'high' ? '#0A5FE8' : level === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)';

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#E3EAF5" strokeWidth="12" />
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <text x="100" y="95" textAnchor="middle" fontSize="48" fontWeight="800" fill="var(--text-primary)" fontFamily="Roboto">{score}<tspan fontSize="24">%</tspan></text>
        <text x="100" y="125" textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="Roboto" letterSpacing="1">
          {level.toUpperCase()} RISK
        </text>
      </svg>
    </div>
  );
};

const ClinicalView: React.FC<ClinicalViewProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const patient = location.state?.patient || {
    id: 'P12345',
    name: 'Pranav Sharma',
    age: 62,
    gender: 'Male',
    ward: 'ICU',
    riskScore: 78,
    riskLevel: 'high',
    admissionDate: '12 May 2026',
    vitals: { temperature: '38.5', heartRate: '110', bloodPressure: '90/60', spo2: '92%' },
    riskFactors: [
      { label: 'Recent Antibiotic Exposure', impact: 21, bar: 80 },
      { label: 'Prior Hospitalization', impact: 17, bar: 65 },
      { label: 'CRP Elevation', impact: 11, bar: 45 },
      { label: 'ICU Stay History', impact: 8, bar: 30 },
      { label: 'High WBC Count', impact: 6, bar: 20 },
    ]
  };
  
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleActionSubmit = async (type: 'follow' | 'override') => {
    if (type === 'override' && !overrideReason) {
      setActionError('Please specify a reason for overriding the AI suggestion.');
      return;
    }
    try {
      await submitClinicianAction(
        patient.id,
        type === 'follow' ? 'accept' : 'override',
        type === 'override' ? `Reason: ${overrideReason} - ${overrideNotes}` : `Followed AI suggestion - ${overrideNotes}`
      );
      
      const seen = JSON.parse(sessionStorage.getItem('seen_patients') || '[]');
      if (!seen.includes(patient.id)) seen.push(patient.id);
      sessionStorage.setItem('seen_patients', JSON.stringify(seen));

      setOverrideConfirmed(true);
      if (type === 'follow') setAccepted(true);
      setTimeout(() => {
        setShowOverride(false);
        navigate('/doctor-dashboard');
      }, 1500);
    } catch (e) {
      setActionError('Failed to log decision. Please try again.');
    }
  };

  return (
    <div className="fade-in" style={{ padding: '0px 24px 24px', maxWidth: 1440, margin: '0 auto' }}>
      
      {/* Back Navigation */}
      <button 
        onClick={() => navigate('/doctor-dashboard')} 
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontWeight: 500, fontSize: '0.9rem', padding: 0 }}
      >
        <ChevronLeft size={18} /> Back to Dashboard
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        
        {/* Left Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Top Header Card */}
          <div className="card-3d" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 32, background: 'linear-gradient(135deg, #ffffff 0%, #e0f2fe 100%)', position: 'relative', overflow: 'hidden' }}>
            
            {/* Microbe Watermark */}
            <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.15, zIndex: 0, width: 300, height: 300, background: 'url(/microbes_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '50%', filter: 'hue-rotate(180deg)' }} />

            <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0A5FE8', letterSpacing: 1.5, textTransform: 'uppercase' }}>CURRENT PATIENT</div>
              <div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{patient.id}</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: 8, fontWeight: 500 }}>
                  {patient.name} · {patient.age}/{patient.gender} · {patient.ward}
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: 4 }}><CalendarIcon size={14}/></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admitted On</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{patient.admissionDate || '12 May 2026'}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>08:45 AM</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: 4 }}><Info size={14}/></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ward</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{patient.ward}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginBottom: 4 }}><User size={14}/></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Consultant</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Dr. Rohan Mehta</div>
                </div>
              </div>
            </div>

            <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0A5FE8', letterSpacing: 1.5, textAlign: 'center', marginBottom: 8, paddingRight: 40, display: 'flex', alignItems: 'center', gap: 4 }}>
                AMR RISK SCORE <Info size={14} color="#0A5FE8" />
              </div>
              <div style={{ paddingRight: 20 }}>
                <RiskGauge score={patient.riskScore} level={patient.riskLevel} />
              </div>
            </div>
          </div>

          {/* Middle Split Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
            
            {/* Top Contributing Factors */}
            <div className="card-3d" style={{ display: 'flex', flexDirection: 'column', background: 'white' }}>
               <div className="card-header" style={{ padding: '24px 24px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <h3 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Top Contributing Factors</h3>
                  <Info size={14} color="var(--text-muted)" />
               </div>
               <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: '0 24px 24px' }}>
                  {patient.riskFactors?.length > 0 ? patient.riskFactors.map((f: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(10, 95, 232, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A5FE8', flexShrink: 0 }}>
                        {i === 0 ? <User size={14} /> : i === 1 ? <Activity size={14} /> : <Activity size={14} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{f.label}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>+{f.impact}%</span>
                        </div>
                        <div style={{ height: 6, background: '#E3EAF5', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${f.bar}%`, background: '#0A5FE8', borderRadius: 10 }} />
                        </div>
                      </div>
                    </div>
                  )) : null}
                  <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 16 }}>
                    <button className="hover-lift" onClick={() => alert('Explanation view coming soon.')} style={{ color: '#0A5FE8', background: 'transparent', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', border: '1px solid #0A5FE8', borderRadius: 4, fontWeight: 600 }}>
                      View explanation <ArrowRight size={14} />
                    </button>
                  </div>
               </div>
            </div>

            {/* Recommended Empiric Coverage */}
            <div className="card-3d" style={{ background: 'white' }}>
               <div className="card-header" style={{ padding: '24px 24px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h3 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Empiric Coverage</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Based on risk & local antibiogram</p>
               </div>
               <div className="card-body" style={{ padding: 24, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {[
                   { id: '1', drug: 'Piperacillin/Tazobactam', type: 'Recommended', bg: 'rgba(10, 95, 232, 0.1)', color: '#0A5FE8' },
                   { id: '2', drug: 'Meropenem', type: 'Alternative', bg: 'rgba(245, 166, 35, 0.1)', color: '#F5A623' },
                   { id: '3', drug: 'Linezolid', type: 'Consider', bg: '#F3F4F6', color: '#6B7280' },
                 ].map((d, i) => (
                   <div key={i} className="hover-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#F9FAFB', borderRadius: 8, cursor: 'default' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                       <div style={{ width: 24, height: 24, borderRadius: '4px', background: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                         {d.id}
                       </div>
                       <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.drug}</span>
                     </div>
                     <div style={{ padding: '6px 16px', background: d.bg, color: d.color, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                       {d.type}
                     </div>
                   </div>
                 ))}
                 <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: 16 }}>
                    <button className="hover-lift" onClick={() => alert('Full recommendation coming soon.')} style={{ color: '#0A5FE8', background: 'transparent', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', border: '1px solid #0A5FE8', borderRadius: 4, fontWeight: 600 }}>
                      View full recommendation <ArrowRight size={14} />
                    </button>
                  </div>
               </div>
            </div>

          </div>

          {/* Local Antibiogram Snapshot */}
          <div className="card-3d" style={{ background: 'white' }}>
            <div className="card-header" style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <h3 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Local Antibiogram Snapshot</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Klebsiella pneumoniae - ICU</p>
               </div>
               <button className="hover-lift" onClick={() => alert('Full antibiogram coming soon.')} style={{ color: '#0A5FE8', background: 'transparent', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #0A5FE8', borderRadius: 4, fontWeight: 600 }}>
                  View full antibiogram <ArrowRight size={14} />
                </button>
            </div>
            <div className="card-body" style={{ padding: '0 24px 32px' }}>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>% Susceptible</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
                {[
                  { drug: 'Meropenem', val: 89, color: '#0A5FE8' },
                  { drug: 'Piperacillin/Tazobactam', val: 72, color: '#0A5FE8' },
                  { drug: 'Cefepime', val: 45, color: '#F5A623' },
                  { drug: 'Ciprofloxacin', val: 28, color: '#F04455' },
                  { drug: 'Amikacin', val: 65, color: '#0A5FE8' },
                ].map((abx, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12 }}>{abx.drug}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ height: 4, background: '#E3EAF5', borderRadius: 2, flex: 1, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${abx.val}%`, background: abx.color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{abx.val}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Risk Timeline */}
          <div className="card-3d" style={{ background: 'white' }}>
             <div className="card-header" style={{ padding: '24px 24px 16px' }}>
                <h3 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Risk Timeline</h3>
             </div>
             <div className="card-body" style={{ padding: '0 24px 24px' }}>
               <div style={{ position: 'relative' }}>
                 <div style={{ position: 'absolute', top: 20, bottom: 40, left: 16, width: 2, background: '#E3EAF5', zIndex: 0 }} />
                 {[
                   { time: '08:45 AM', title: 'Admission', sub: 'Initial risk calculated', val: '42%', color: '#0A5FE8', icon: <User size={14}/> },
                   { time: '09:15 AM', title: 'CRP Result Available', sub: 'Risk updated', val: '56%', color: '#16B77A', icon: <Activity size={14}/> },
                   { time: '09:45 AM', title: 'Prior Antibiotics Found', sub: 'Risk updated', val: '71%', color: '#F5A623', icon: <Pill size={14}/> },
                   { time: '10:05 AM', title: 'High Risk Alert', sub: 'Risk updated', val: '78%', color: '#F04455', icon: <AlertTriangle size={14}/> },
                 ].map((event, i) => (
                   <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 24, position: 'relative', zIndex: 1 }}>
                     <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'white', border: `2px solid ${event.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: event.color, flexShrink: 0 }}>
                       {event.icon}
                     </div>
                     <div style={{ flex: 1, paddingTop: 4 }}>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{event.time}</div>
                       <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{event.title}</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{event.sub}</div>
                     </div>
                     <div style={{ paddingTop: 10 }}>
                       <div style={{ padding: '4px 8px', background: `${event.color}15`, color: event.color, borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                         {event.val}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
               <div style={{ textAlign: 'center', marginTop: 16 }}>
                 <button className="hover-lift" onClick={() => alert('Full timeline coming soon.')} style={{ color: '#0A5FE8', background: 'transparent', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', border: '1px solid #0A5FE8', borderRadius: 4, fontWeight: 600 }}>
                    View full timeline <ArrowRight size={14} />
                 </button>
               </div>
             </div>
          </div>

          {/* Recommended Actions */}
          <div className="card-3d" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
             <div className="card-header" style={{ padding: '24px 24px 16px' }}>
                <h3 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Actions</h3>
             </div>
             <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '0 24px 24px' }}>
               {[
                 { label: 'Infection Control Review', icon: <ClipboardList size={16} /> },
                 { label: 'Review Empiric Antibiotics', icon: <Shield size={16} /> },
                 { label: 'Consider Isolation Protocol', icon: <AlertTriangle size={16} /> }
               ].map((action, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} className="hover-lift">
                   <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                     <div style={{ color: 'var(--text-secondary)' }}>{action.icon}</div>
                     <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{action.label}</span>
                   </div>
                   <ArrowRight size={16} color="var(--text-muted)" />
                 </div>
               ))}

               <div style={{ marginTop: 'auto', paddingTop: 24 }}>
                 <button className="btn btn-primary btn-3d" style={{ width: '100%', justifyContent: 'center', padding: '14px', display: 'flex', alignItems: 'center', gap: 8, background: '#0A5FE8', fontSize: '0.9rem' }} onClick={() => setShowOverride(true)}>
                   <Plus size={18} /> Create Clinical Note
                 </button>
               </div>
             </div>
          </div>

        </div>

      </div>

      {/* Override / Follow Modal (Hidden by default, used for logging decision) */}
      {showOverride && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10, 25, 48, 0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card-3d fade-in" style={{ width: 500, padding: 32, background: 'white', position: 'relative' }}>
            
            {!overrideConfirmed ? (
              <>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                  Log Clinical Decision
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                  Based on your clinical judgement, do you agree with the AI's recommendation to start empiric therapy for AMR pathogens?
                </p>

                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <button 
                    className="hover-3d"
                    onClick={() => handleActionSubmit('follow')}
                    style={{ flex: 1, padding: '16px', background: 'rgba(22, 183, 122, 0.1)', border: '1px solid rgba(22, 183, 122, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16B77A' }}>
                      <ThumbsUp size={20} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Follow Suggestion</span>
                  </button>

                  <div 
                    style={{ flex: 1, padding: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--risk-medium)' }}>
                      <ThumbsDown size={18} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Override</span>
                    </div>
                    
                    <select 
                      value={overrideReason} 
                      onChange={e => { setOverrideReason(e.target.value); setActionError(''); }}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
                    >
                      <option value="">Select Reason...</option>
                      <option value="wait_culture">Waiting for culture results</option>
                      <option value="clinical_improve">Patient is improving clinically</option>
                      <option value="alternative_diag">Alternative diagnosis found</option>
                      <option value="toxicity">Concern for drug toxicity</option>
                    </select>

                    <textarea
                      placeholder="Add a custom clinical note..."
                      value={overrideNotes}
                      onChange={e => setOverrideNotes(e.target.value)}
                      style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical' }}
                    />

                    <button 
                      className="btn btn-primary btn-3d" 
                      style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} 
                      onClick={() => handleActionSubmit('override')}
                    >
                      Log Override
                    </button>
                  </div>
                </div>

                {actionError && <div style={{ color: 'var(--risk-high)', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center', fontWeight: 500 }}>{actionError}</div>}

                <div style={{ textAlign: 'center' }}>
                  <button className="btn btn-ghost" onClick={() => setShowOverride(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: accepted ? 'rgba(22, 183, 122, 0.1)' : 'rgba(245, 166, 35, 0.1)', color: accepted ? '#16B77A' : '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Shield size={32} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Decision Logged Securely</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Your clinical judgement has been recorded and will help improve the Vyuha model.
                </p>
              </div>
            )}
            
          </div>
        </div>
      )}

    </div>
  );
};

export default ClinicalView;
