import React, { useState } from 'react';
import './AppLayout.css';
import { 
  LayoutDashboard, Activity, FolderOpen, BarChart2,
  HelpCircle, Settings, LogOut, Search, Bell, Sun
} from 'lucide-react';
import type { PortalUser } from './LoginPage';
import { usePortalData } from '../context/PortalDataContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  user: PortalUser;
}

const doctorNavItems = [
  { id: 'doctor-dashboard', label: 'Clinical Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: Activity },
  { id: 'patients', label: 'Record', icon: FolderOpen },
  { id: 'clinical-intelligence', label: 'Intelligence', icon: BarChart2 },
];

const staffNavItems = [
  { id: 'staff-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patient Directory', icon: FolderOpen },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children, onLogout, user }) => {
  const { patients } = usePortalData();
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = location.pathname.slice(1) || 'doctor-dashboard';
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pageInfo: Record<string, { greeting?: string; title: string; subtitle?: string }> = {
    'doctor-dashboard': { greeting: `Good morning, Dr. ${user.name?.split(' ').pop() || user.shortName}`, title: 'Clinical Workload', subtitle: "Here's your clinical overview." },
    'staff-dashboard': { greeting: `Good morning, ${user.name || user.shortName}`, title: 'Staff Administration', subtitle: "Hospital management and appointment scheduling." },
    appointments: { title: 'Appointments', subtitle: 'Daily schedule' },
    patients: { title: 'Clinical Records', subtitle: 'Patient history and risk profiles' },
    'clinical-intelligence': { title: 'Hospital AMR Intelligence', subtitle: 'Ward-level resistance trends and insights' },
    'clinical-view': { title: 'Patient Clinical View', subtitle: 'AMR Risk & Decision Support' },
  };

  const current = pageInfo[activePage] || (user.role === 'staff' ? pageInfo['staff-dashboard'] : pageInfo['doctor-dashboard']);
  const navItems = user.role === 'staff' ? staffNavItems : doctorNavItems;
  const greeting = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      Good morning, {user.shortName} <Sun size={20} color="var(--primary)" />
    </span>
  );
  const notifications = patients.filter(patient => patient.riskLevel === 'high').slice(0, 3).map((patient, index) => ({
    id: index, type: 'high', message: `${patient.name} · ${patient.riskScore}% model-derived risk`, time: patient.admissionDate,
  }));

  return (
    <div className="app-shell">
      {/* Microbes Background - Transparent rotating overlay */}
      <div style={{ 
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
        overflow: 'hidden', pointerEvents: 'none', zIndex: 0 
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: '140vw', height: '140vw',
          backgroundImage: 'url(/microbes_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.06,
          animation: 'rotateMicrobes 120s linear infinite', transformOrigin: 'center center',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%'
        }} />
      </div>

      {/* Sidebar */}
      <aside className="sidebar" style={{ zIndex: 10, position: 'relative', overflow: 'hidden' }}>
        {/* Ecoli stays in sidebar (user preference) */}
        <div className="sidebar-brand" style={{ padding: '24px 20px 12px', display: 'flex', justifyContent: 'center', cursor: 'pointer', position: 'relative', zIndex: 1 }} onClick={onLogout} title="Return to Landing Page">
          <img src="/logo.png" alt="Vyuha Logo" style={{ width: 'auto', height: 48, objectFit: 'contain' }} />
        </div>

          <div className="sidebar-divider" />

        <div className={`sidebar-role-badge ${user.role}`} style={{ position: 'relative', zIndex: 1 }}>
          {user.role === 'staff' ? 'Staff Portal' : 'Doctor Portal'}
        </div>

        <nav className="sidebar-nav" style={{ position: 'relative', zIndex: 1 }}>
          <div className="sidebar-nav-label">Navigation</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(`/${item.id}`)}
              >
                <div className={`sidebar-nav-icon ${isActive ? 'active' : ''}`}>
                  <Icon size={18} />
                </div>
                <span className="sidebar-nav-label-text">{item.label}</span>
                {isActive && <div className="sidebar-active-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom" style={{ position: 'relative', zIndex: 1 }}>
          <div className="sidebar-divider" />
          <button className="sidebar-nav-item" onClick={() => {}}>
            <div className="sidebar-nav-icon"><HelpCircle size={18} /></div>
            <span className="sidebar-nav-label-text">Help</span>
          </button>
          <button className="sidebar-nav-item" onClick={() => navigate('/settings')}>
            <div className="sidebar-nav-icon"><Settings size={18} /></div>
            <span className="sidebar-nav-label-text">Settings</span>
          </button>
          <div className="sidebar-divider" />
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ padding: 0, overflow: 'hidden', background: 'transparent' }}>
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.name || 'Doctor')}&backgroundColor=e5e7eb`} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{user.title}</div>
            </div>
            <button className="sidebar-logout-btn" onClick={onLogout} title="Return to Landing">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="app-main" style={{ zIndex: 1, position: 'relative' }}>
        {/* Microbe centered on main dashboard content, zoomed to full page */}
        <div style={{
          position: 'fixed',
          top: '50%', left: '50%',
          width: '140vw', height: '140vw',
          backgroundImage: 'url(/microbes_bg.png)', backgroundSize: 'cover',
          opacity: 0.05,
          borderRadius: '50%',
          animation: 'rotateMicrobes 150s linear infinite',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Top Header */}
        <header className="app-topbar">
          <div className="topbar-left">
            {current.greeting ? (
              <div>
                <div className="topbar-greeting">{activePage === 'overview' ? greeting : current.greeting}</div>
                <div className="topbar-subtitle">{current.subtitle}</div>
              </div>
            ) : (
              <div>
                <div className="topbar-page-title">{current.title}</div>
                {current.subtitle && <div className="topbar-subtitle">{current.subtitle}</div>}
              </div>
            )}
          </div>

          <div className="topbar-search">
            <Search size={15} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search patient, ID, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="topbar-right">
            {/* Notifications */}
            <div className="topbar-icon-btn-wrap">
              <button
                className="topbar-icon-btn"
                onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
              >
                <Bell size={18} />
                {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
              </button>
              {showNotifications && (
                <div className="dropdown-panel notif-panel">
                  <div className="dropdown-header">
                    <span>Notifications</span>
                    <span className="notif-count">{notifications.length} records</span>
                  </div>
                  {notifications.map((n) => (
                    <div key={n.id} className={`notif-item ${n.type}`}>
                      <div className={`notif-dot ${n.type}`} />
                      <div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-content" onClick={() => { setShowNotifications(false); setShowUserMenu(false); }}>
          <div className="content-inner fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
