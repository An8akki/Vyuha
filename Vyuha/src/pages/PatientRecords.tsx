import React, { useState } from 'react';
import './PatientRecords.css';
import {
  Search, FileText, ChevronRight, CheckCircle, AlertTriangle, Activity, HeartPulse, UserPlus, X,
  Shield, Hospital, Beaker, Pill, Clock, TrendingUp, Calendar, ClipboardList
} from 'lucide-react';
import { usePortalData } from '../context/PortalDataContext';
import type { Patient } from '../api/client';

// ── Generate a full simulated patient from minimal input ────────────────
const generateMockPatient = (name: string, age: string, gender: string, phone: string, refPatient?: Patient): Patient => {
  const id = `EHR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const score = 45 + Math.floor(Math.random() * 40);
  const level = (score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low') as 'high' | 'medium' | 'low';
  const wards = ['ICU-A', 'Ward A', 'Ward B', 'General Ward'];
  const organisms = ['E. coli (ESBL)', 'K. pneumoniae (KPC)', 'S. aureus (MRSA)', 'P. aeruginosa'];
  const resistances = [['AMK','GEN','CIP'], ['CIP','TZP','MEM'], ['OXA','VAN','TEC'], ['MEM','CAZ','CIP']];
  const orgIdx = Math.floor(Math.random() * organisms.length);
  const today = new Date().toISOString().slice(0, 10);
  return {
    id, abhaId: `ABHA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    name, age: age ? parseInt(age) : 45, gender,
    ward: wards[Math.floor(Math.random() * wards.length)],
    consultant: refPatient?.consultant || 'Dr. Smith',
    admissionDate: today, admissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    riskScore: score, riskLevel: level, riskTrend: Math.floor(Math.random() * 10) - 5,
    status: level.charAt(0).toUpperCase() + level.slice(1),
    vitals: {
      temperature: `${(36.5 + Math.random() * 2).toFixed(1)}°C`,
      heartRate: `${80 + Math.floor(Math.random() * 40)} bpm`,
      bloodPressure: `${110 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)}`,
      spo2: `${94 + Math.floor(Math.random() * 6)}%`,
    },
    biomarkers: {
      wbc: `${(8 + Math.random() * 10).toFixed(1)} ×10³/µL`,
      crp: `${(10 + Math.random() * 60).toFixed(1)} mg/L`,
      procalcitonin: `${(0.1 + Math.random() * 2).toFixed(2)} ng/mL`,
    },
    riskFactors: [
      { label: 'Recent antibiotic exposure', impact: 15, bar: 80 },
      { label: 'Hospital-acquired risk', impact: 10, bar: 60 },
      { label: 'Age-related susceptibility', impact: 8, bar: 50 },
    ],
    amrHistory: [{ date: today, hospital: 'Demo Hospital', event: 'New Patient Entry', detail: `Admitted via ED. Contact: ${phone || 'N/A'}`, type: 'admission', hasResistance: false }],
    antibioticTimeline: [{ month: today.slice(0, 7), drug: 'Empiric Broad-spectrum', duration: 'Ongoing', hospital: 'Demo Hospital' }],
    cultures: [{ date: today, site: 'Blood Culture', organism: organisms[orgIdx], hospital: 'Demo Hospital', sensitivities: resistances[orgIdx].map(d => ({ drug: d, result: 'R' })) }],
    monitoringTimeline: [
      { time: '08:00', event: 'Admission', risk: score - 5, detail: 'Initial assessment completed' },
      { time: '12:00', event: 'AMR Screen', risk: score, detail: 'Vyuha model evaluated patient' },
    ],
    cultureOutcome: null,
    hospitalEncounters: [{ date: today, hospital: 'Demo Hospital', admission: 'Acute', duration: 'Ongoing', antibiotics: 'Empiric' }],
    previousAssessments: [{ date: today, hospital: 'Demo Hospital', risk: score, level, model: 'XGBoost v2' }],
    sourceClinicalData: {},
  };
};

const tabs = ['Overview', 'Cultures & Resistance', 'Antibiotic Exposure', 'Hospital Encounters', 'Assessments'];

const PatientRecords: React.FC<{ initialPatient?: Patient; onNavigate: (page: string, data?: any) => void }> = ({
  initialPatient,
  onNavigate
}) => {
  const { patients, loading, error, refresh, addPatient } = usePortalData();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: '', phone: '', age: '', gender: 'Male' });
  const [saved, setSaved] = useState(false);

  const handleSearch = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) { setSearchResults([]); return; }
    setSearchResults(patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.abhaId.toLowerCase().includes(q)
    ));
  };

  return (
    <div className="patient-records-page">
      {loading && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--text-secondary)' }}>Loading patient records…</div>}
      {error && <div className="card" style={{ padding: 14, marginBottom: 18, color: 'var(--risk-high)', display: 'flex', justifyContent: 'space-between' }}><span>{error}</span><button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>Retry</button></div>}
      {/* Patient Search */}
      {!selectedPatient && (
        <div className="pr-search-section fade-in">
          {/* Compact hero */}
          <div className="pr-search-hero">
            <div className="pr-search-icon">
              <ClipboardList size={28} color="var(--primary)" />
            </div>
            <h2 className="pr-search-title">Clinical Records</h2>
            <p className="pr-search-sub">
              Longitudinal AMR history across hospital encounters. Search or create a new entry.
            </p>
            <div className="pr-search-row">
              <div style={{ position: 'relative', flex: 1, maxWidth: 540 }}>
                <Search className="search-icon" size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 40, fontSize: '1rem', padding: '14px 14px 14px 44px' }}
                  placeholder="Search de-identified label or anonymous patient ID..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults([]); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                {searchResults.length > 0 && (
                  <div className="search-dropdown" style={{ marginTop: 4 }}>
                    {searchResults.map((p) => (
                      <div key={p.id} className="search-result-item" onClick={() => { setSelectedPatient(p); setSearchResults([]); }}>
                        <div className="sr-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
                        <div style={{ flex: 1 }}>
                          <div className="sr-name">{p.name}</div>
                          <div className="sr-meta">{p.id} · {p.abhaId} · {p.age}/{p.gender.charAt(0)} · {p.ward}</div>
                        </div>
                        <span className={`risk-badge ${p.riskLevel}`}>{p.riskScore}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleSearch}>
                <Search size={16} /> Search Patient
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => setShowNewPatientModal(true)}>
                <UserPlus size={16} /> New Entry
              </button>
            </div>

            {/* Quick select */}
            <div className="pr-quick-label">Or select a recent patient:</div>
            <div className="pr-quick-grid" style={{ maxWidth: 880 }}>
              {patients.slice(0, 8).map((p) => (
                <div key={p.id} className="pr-quick-card card-3d" onClick={() => setSelectedPatient(p)}>
                  <span className={`risk-badge ${p.riskLevel}`} style={{ position: 'absolute', top: 12, right: 12 }}>{p.riskScore}%</span>
                  <div className="pr-quick-avatar">{p.name.split(' ').map(n => n[0]).join('')}</div>
                  <div className="pr-quick-info">
                    <div className="pr-quick-name">{p.name}</div>
                    <div className="pr-quick-meta">{p.id}</div>
                    <div className="pr-quick-meta">{p.ward}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPatient && (
        <div className="pr-patient-view fade-in">
          {/* Persistent Patient Header */}
          <div className="pr-patient-header">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>
              ← Back to Search
            </button>
            <div className="pr-header-main">
              <div className="pr-header-left">
                <div className="pr-header-avatar">
                  {selectedPatient.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="pr-header-name">{selectedPatient.name}</div>
                  <div className="pr-header-meta">
                    {selectedPatient.id} · {selectedPatient.abhaId} · {selectedPatient.age} / {selectedPatient.gender} · {selectedPatient.ward}
                  </div>
                </div>
              </div>
              <div className="pr-header-chips">
                <div className="pr-chip">
                  <Hospital size={12} />
                  {selectedPatient.hospitalEncounters.length || (selectedPatient.amrHistory.length - 1)} Hospitals
                </div>
                <div className={`pr-chip ${selectedPatient.cultures.length > 0 ? 'alert' : ''}`}>
                  <Beaker size={12} />
                  {selectedPatient.cultures.filter(c => c.sensitivities.some(s => s.result === 'R')).length} Resistant Organism{selectedPatient.cultures.length !== 1 ? 's' : ''}
                </div>
                <div className="pr-chip">
                  <Pill size={12} />
                  {Math.max(0, selectedPatient.antibioticTimeline.length - 1)} Antibiotic Courses
                </div>
                <div className={`pr-chip ${selectedPatient.riskLevel}`}>
                  <Shield size={12} />
                  Current Risk: {selectedPatient.riskScore}%
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs pr-tabs">
              {tabs.map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="pr-tab-content">
            {activeTab === 'Overview' && <TabOverview patient={selectedPatient} onNavigate={onNavigate} />}
            {activeTab === 'Cultures & Resistance' && <TabCultures patient={selectedPatient} />}
            {activeTab === 'Antibiotic Exposure' && <TabAntibiotics patient={selectedPatient} />}
            {activeTab === 'Hospital Encounters' && <TabEncounters patient={selectedPatient} />}
            {activeTab === 'Assessments' && <TabAssessments patient={selectedPatient} onNavigate={onNavigate} />}
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showNewPatientModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card fade-in" style={{ width: 400, padding: 24, position: 'relative' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowNewPatientModal(false)}><X size={20} color="var(--text-secondary)" /></button>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20 }}>New Patient Entry</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Full Name</label>
                <input className="form-input" style={{ width: '100%' }} value={newPatientForm.name} onChange={e => setNewPatientForm({...newPatientForm, name: e.target.value})} placeholder="e.g. John Doe" />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Age</label>
                  <input className="form-input" style={{ width: '100%' }} type="number" value={newPatientForm.age} onChange={e => setNewPatientForm({...newPatientForm, age: e.target.value})} placeholder="e.g. 45" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Gender</label>
                  <select className="form-input" style={{ width: '100%' }} value={newPatientForm.gender} onChange={e => setNewPatientForm({...newPatientForm, gender: e.target.value})}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Phone / Contact</label>
                <input className="form-input" style={{ width: '100%' }} value={newPatientForm.phone} onChange={e => setNewPatientForm({...newPatientForm, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
              </div>
              
              <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={!newPatientForm.name} onClick={() => {
                const ref = patients[Math.floor(Math.random() * Math.max(1, patients.length))];
                const newP = generateMockPatient(newPatientForm.name, newPatientForm.age, newPatientForm.gender, newPatientForm.phone, ref);
                addPatient(newP);
                setSaved(true);
                setTimeout(() => {
                  setSaved(false);
                  setShowNewPatientModal(false);
                  setNewPatientForm({ name: '', phone: '', age: '', gender: 'Male' });
                  setSelectedPatient(newP);
                }, 1200);
              }}>
                {saved ? '✓ Saved!' : 'Save & View Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Tab: Overview (Signature Timeline) ----
const TabOverview: React.FC<{ patient: Patient; onNavigate: (page: string, data?: any) => void }> = ({ patient, onNavigate }) => (
  <div className="tab-overview-grid">
    {/* MAIN TIMELINE */}
    <div className="card timeline-card">
      <div className="card-header">
        <div>
          <h3 className="card-title">AMR History Timeline</h3>
          <p className="card-subtitle">Longitudinal resistance history across all hospital encounters</p>
        </div>
        <div className="cross-hospital-badge">
          <Hospital size={13} />
          Cross-Hospital Record
        </div>
      </div>
      <div className="card-body timeline-body">
        {patient.amrHistory.map((event, i) => (
          <div key={i} className="timeline-entry">
            {/* Left: date */}
            <div className="timeline-date-col">
              <div className="tl-date">{event.date}</div>
              <div className="tl-hospital">{event.hospital}</div>
            </div>

            {/* Center: node + connector */}
            <div className="timeline-node-col">
              <div className={`tl-node ${event.type}`}>
                {event.type === 'resistance' ? <AlertTriangle size={14} /> :
                  event.type === 'assessment' ? <Shield size={14} /> :
                  event.type === 'antibiotic' ? <Pill size={14} /> :
                  <Hospital size={14} />}
              </div>
              {i < patient.amrHistory.length - 1 && <div className={`tl-connector ${i < patient.amrHistory.length - 2 ? '' : 'last'}`} />}
            </div>

            {/* Right: content */}
            <div className={`timeline-content-col ${event.hasResistance ? 'resistance' : ''}`}>
              <div className="tl-event">{event.event}</div>
              <div className="tl-detail">{event.detail}</div>
              {event.type === 'resistance' && (
                <div className="tl-resistance-tags">
                  {('resistance' in event ? event.resistance : undefined)?.map((r, j) => (
                    <span key={j} className="resistance-tag">{r} Resistant</span>
                  ))}
                </div>
              )}
              {event.type === 'assessment' && (
                <div className="tl-assessment-badge">
                  <Shield size={12} /> AMR-GUARD Assessment · {patient.riskScore}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Right: Summary Cards */}
    <div className="timeline-right">
      {/* Risk Summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Current AMR Risk</h3>
        </div>
        <div className="card-body" style={{ textAlign: 'center', padding: '20px' }}>
          <div className={`risk-donut risk-donut-${patient.riskLevel}`}>
            <div className="risk-donut-value">{patient.riskScore}%</div>
            <div className={`risk-donut-label ${patient.riskLevel}`}>{patient.riskLevel.toUpperCase()} RISK</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 16 }}
            onClick={() => onNavigate('new-assessment', { patient, step: 4 })}>
            View Full Assessment
          </button>
        </div>
      </div>

      {/* Resistance Summary */}
      {patient.cultures.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Resistance Profile</h3>
            <AlertTriangle size={16} color="var(--risk-high)" />
          </div>
          <div className="card-body">
            {patient.cultures.map((c, i) => (
              <div key={i} className="resistance-profile-row">
                <div className="rp-organism">{c.organism}</div>
                <div className="rp-site">{c.site} · {c.hospital}</div>
                <div className="rp-sensitivities">
                  {c.sensitivities.map((s, j) => (
                    <span key={j} className={`rp-chip ${s.result === 'R' ? 'r' : 's'}`}>
                      {s.drug}: {s.result}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exposure Pressure */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Antibiotic Exposure Pressure</h3>
        </div>
        <div className="card-body">
          <div className={`exposure-pressure-badge ${patient.antibioticTimeline.length > 2 ? 'high' : patient.antibioticTimeline.length > 1 ? 'medium' : 'low'}`}>
            {patient.antibioticTimeline.length > 2 ? 'HIGH' : patient.antibioticTimeline.length > 1 ? 'MEDIUM' : 'LOW'}
          </div>
          <div className="exposure-note">
            {Math.max(0, patient.antibioticTimeline.length - 1)} antibiotic courses documented across {patient.hospitalEncounters.length || patient.amrHistory.length - 1} hospital encounters.
            <br />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supporting prototype indicator</span>
          </div>
        </div>
      </div>

      {/* Vitals Overview */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Latest Vitals</h3>
        </div>
        <div className="card-body" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-app)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Heart Rate</div>
              <div style={{ fontWeight: 600 }}>{patient.vitals.heartRate}</div>
            </div>
            <div style={{ background: 'var(--bg-app)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Blood Pressure</div>
              <div style={{ fontWeight: 600 }}>{patient.vitals.bloodPressure}</div>
            </div>
            <div style={{ background: 'var(--bg-app)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Temperature</div>
              <div style={{ fontWeight: 600 }}>{patient.vitals.temperature}</div>
            </div>
            <div style={{ background: 'var(--bg-app)', padding: 10, borderRadius: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>SpO2</div>
              <div style={{ fontWeight: 600 }}>{patient.vitals.spo2}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ---- Tab: Cultures & Resistance ----
const TabCultures: React.FC<{ patient: Patient }> = ({ patient }) => (
  <div className="fade-in">
    {patient.cultures.length === 0 ? (
      <div className="empty-state">
        <CheckCircle size={40} color="var(--risk-low)" />
        <h3>No Resistant Cultures Found</h3>
        <p>No confirmed resistant organisms in the patient record.</p>
      </div>
    ) : (
      <div className="cultures-list">
        {patient.cultures.map((c, i) => (
          <div key={i} className="card culture-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Beaker size={18} color="var(--risk-high)" />
                <div>
                  <h3 className="card-title">{c.organism}</h3>
                  <p className="card-subtitle">{c.site} · {c.hospital} · {c.date}</p>
                </div>
              </div>
              <span className="risk-badge high">Resistant Culture</span>
            </div>
            <div className="card-body">
              <div className="sensitivities-table">
                <table className="clinical-table">
                  <thead>
                    <tr>
                      <th>Antimicrobial</th>
                      <th>Result</th>
                      <th>Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.sensitivities.map((s, j) => (
                      <tr key={j}>
                        <td style={{ fontWeight: 500 }}>{s.drug}</td>
                        <td>
                          <span className={`sensitivity-result-badge ${s.result === 'R' ? 'resistant' : 'sensitive'}`}>
                            {s.result}
                          </span>
                        </td>
                        <td style={{ color: s.result === 'R' ? 'var(--risk-high)' : 'var(--risk-low)', fontWeight: 500 }}>
                          {s.result === 'R' ? 'Resistant' : 'Susceptible'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---- Tab: Antibiotic Exposure ----
const TabAntibiotics: React.FC<{ patient: Patient }> = ({ patient }) => {
  const months = ['Jan 2025', 'Feb', 'Mar', 'Apr', 'May', 'Jun 2025', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan 2026', 'Feb', 'Mar', 'Apr 2026', 'May', 'Jun', 'Jul', 'Aug 2026'];

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Antibiotic Exposure Timeline</h3>
          <div className={`exposure-pressure-badge ${patient.antibioticTimeline.length > 2 ? 'high' : 'medium'}`} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
            Exposure Pressure: {patient.antibioticTimeline.length > 2 ? 'HIGH' : 'MEDIUM'}
          </div>
        </div>
        <div className="card-body">
          {/* Visual Timeline */}
          <div className="antibiotic-timeline-visual">
            <div className="atv-track" />
            {patient.antibioticTimeline.map((ab, i) => (
              <div key={i} className={`atv-item ${ab.drug === 'Current Admission' ? 'current' : ''}`}
                style={{ left: `${(i / (patient.antibioticTimeline.length)) * 85}%` }}>
                <div className="atv-node" />
                <div className="atv-label">
                  <div className="atv-month">{ab.month}</div>
                  <div className="atv-drug">{ab.drug}</div>
                  <div className="atv-duration">{ab.duration}</div>
                  <div className="atv-hospital">{ab.hospital}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Antibiotic Course Detail</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Antibiotic</th>
                <th>Duration</th>
                <th>Hospital</th>
              </tr>
            </thead>
            <tbody>
              {patient.antibioticTimeline.map((ab, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{ab.month}</td>
                  <td>
                    <span className={`drug-tag ${ab.drug === 'Current Admission' ? 'current' : ''}`}>
                      {ab.drug}
                    </span>
                  </td>
                  <td>{ab.duration}</td>
                  <td>{ab.hospital}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---- Tab: Hospital Encounters ----
const TabEncounters: React.FC<{ patient: Patient }> = ({ patient }) => (
  <div className="fade-in">
    {patient.hospitalEncounters.length === 0 ? (
      <div className="empty-state">
        <Hospital size={40} color="var(--text-muted)" />
        <h3>No Previous Hospital Encounters</h3>
        <p>No prior hospital encounters found in the patient record.</p>
      </div>
    ) : (
      <div className="card">
        <div className="card-header"><h3 className="card-title">Hospital Encounters</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="clinical-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hospital</th>
                <th>Admission Reason</th>
                <th>Duration</th>
                <th>Antibiotics Given</th>
              </tr>
            </thead>
            <tbody>
              {patient.hospitalEncounters.map((enc, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{enc.date}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Hospital size={14} color="var(--primary)" />
                      {enc.hospital}
                    </div>
                  </td>
                  <td>{enc.admission}</td>
                  <td>{enc.duration}</td>
                  <td>
                    <span className="drug-tag">{enc.antibiotics}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

// ---- Tab: Assessments ----
const TabAssessments: React.FC<{ patient: Patient; onNavigate: (page: string, data?: any) => void }> = ({ patient, onNavigate }) => (
  <div className="fade-in">
    <div className="card">
      <div className="card-header"><h3 className="card-title">AMR Risk Assessments</h3></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="clinical-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hospital</th>
              <th>AMR Risk Score</th>
              <th>Risk Level</th>
              <th>Model</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {patient.previousAssessments.map((a, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{a.date}</td>
                <td>{a.hospital}</td>
                <td>
                  <span style={{ fontWeight: 700, color: a.level === 'high' ? 'var(--risk-high)' : a.level === 'medium' ? 'var(--risk-medium)' : 'var(--risk-low)', fontSize: '1rem' }}>
                    {a.risk}%
                  </span>
                </td>
                <td><span className={`risk-badge ${a.level}`}>{a.level.toUpperCase()}</span></td>
                <td>
                  <span style={{ fontFamily: 'Roboto', fontSize: '0.78rem', color: 'var(--primary)', background: 'var(--sky-blue)', padding: '2px 8px', borderRadius: '99px' }}>
                    {a.model}
                  </span>
                </td>
                <td>
                  {i === patient.previousAssessments.length - 1 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate('new-assessment', { patient, step: 4 })}
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default PatientRecords;
