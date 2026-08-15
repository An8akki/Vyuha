import React, { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import AppLayout from './components/AppLayout';
import Overview from './pages/Overview';
import PatientRecords from './pages/PatientRecords';
import Monitoring from './pages/Monitoring';
import Intelligence from './pages/Intelligence';
import Appointments from './pages/Appointments';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import LoginPage, { type PortalUser, type UserRole } from './components/LoginPage';
import { login, setAccessToken } from './api/client';
import ClinicalView from './pages/ClinicalView';
import { PortalDataProvider } from './context/PortalDataContext';
import SimulationEngine from './pages/SimulationEngine';
import StaffDashboard from './pages/StaffDashboard';

function AppContent() {
  const navigate = useNavigate();
  const storedSession = (() => {
    try { return JSON.parse(sessionStorage.getItem('amrGuardSession') || 'null') as { user: PortalUser; accessToken: string } | null; }
    catch { return null; }
  })();
  const [user, setUser] = useState<PortalUser | null>(storedSession?.user || null);
  const [accessToken, setAccessTokenState] = useState(storedSession?.accessToken || '');
  const [initialRole, setInitialRole] = useState<UserRole | undefined>();

  const handleLogin = async (role: UserRole, email: string, password: string) => {
    const session = await login(role, email, password);
    setAccessToken(session.accessToken);
    setAccessTokenState(session.accessToken);
    setUser(session.user);
    sessionStorage.setItem('amrGuardSession', JSON.stringify(session));
    if (role === 'staff') {
      navigate('/staff-dashboard');
    } else {
      navigate('/doctor-dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken(null);
    setAccessTokenState('');
    sessionStorage.removeItem('amrGuardSession');
    setInitialRole(undefined);
    navigate('/');
  };

  useEffect(() => {
    const handleUnauthorized = () => handleLogout();
    window.addEventListener('amr:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('amr:unauthorized', handleUnauthorized);
  }, []);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage initialRole={initialRole} onBack={() => navigate('/')} onLogin={handleLogin} />} />
        <Route path="/simulation" element={<SimulationEngine />} />
        <Route path="*" element={<LandingPage onLaunch={(role) => { setInitialRole(role); navigate('/login'); }} />} />
      </Routes>
    );
  }

  return (
    <PortalDataProvider token={accessToken}>
      <AppLayout onLogout={handleLogout} user={user}>
        <Routes>
          <Route path="/doctor-dashboard" element={<Overview onNavigate={(p: string, d?: any) => { navigate(`/${p}`, { state: d }); }} />} />
          <Route path="/clinical-view" element={<ClinicalView onNavigate={(p: string) => { navigate(`/${p}`); }} />} />
          <Route path="/clinical-intelligence" element={<Intelligence />} />
          <Route path="/patient-records" element={<Navigate to="/patients" replace />} />
          <Route path="/patients" element={<PatientRecords onNavigate={(p: string, d?: any) => { navigate(`/${p}`, { state: d }); }} />} />
          <Route path="/appointments" element={<Appointments onNavigate={(p: string, d?: any) => { navigate(`/${p}`, { state: d }); }} />} />
          <Route path="/monitoring" element={<Monitoring onNavigate={(p: string, d?: any) => { navigate(`/${p}`, { state: d }); }} />} />
          <Route path="/simulation" element={<SimulationEngine />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/staff-dashboard" element={<StaffDashboard />} />
          
          <Route path="*" element={<Navigate to={user.role === 'staff' ? "/staff-dashboard" : "/doctor-dashboard"} replace />} />
        </Routes>
      </AppLayout>
    </PortalDataProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

// Simple Settings Page
const SettingsPage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div>
      <h2 style={{ fontFamily: 'Roboto', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>Settings</h2>
      <p style={{ fontFamily: 'Roboto', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Prototype configuration and preferences</p>
    </div>

    {[
      {
        title: 'Clinical Platform', items: [
          { label: 'Institution', value: 'Demo Hospital' },
          { label: 'Department', value: 'Infectious Diseases / ICU' },
          { label: 'AI Model Version', value: 'AMR-GUARD v1.0 (Prototype)' },
          { label: 'Risk Threshold (High)', value: '70%' },
          { label: 'Risk Threshold (Medium)', value: '40%' },
        ]
      },
      {
        title: 'Display Preferences', items: [
          { label: 'Theme', value: 'Light (Clinical)' },
          { label: 'Font', value: 'Roboto (Clinical Typography)' },
          { label: 'Language', value: 'English' },
          { label: 'Date Format', value: 'DD MMM YYYY' },
          { label: 'Time Format', value: '12-hour' },
        ]
      },
      {
        title: 'Notifications', items: [
          { label: 'High-Risk Alerts', value: 'Enabled' },
          { label: 'Stewardship Reminders', value: 'Enabled' },
          { label: 'Culture Result Notifications', value: 'Enabled' },
          { label: 'Alert Sound', value: 'Off' },
        ]
      },
    ].map((section, i) => (
      <div key={i} className="card">
        <div className="card-header">
          <h3 className="card-title">{section.title}</h3>
        </div>
        <div className="card-body">
          {section.items.map((item, j) => (
            <div key={j} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: j < section.items.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <span style={{ fontFamily: 'Roboto', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {item.label}
              </span>
              <span style={{ fontFamily: 'Roboto', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ))}

    <div style={{ textAlign: 'center', padding: '24px' }}>
      <p style={{ fontFamily: 'Roboto', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        AMR-GUARD Prototype — De-identified source data. Not for clinical use.
      </p>
    </div>
  </div>
);

export default App;
