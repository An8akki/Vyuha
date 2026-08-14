import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import './LoginPage.css';

export type UserRole = 'doctor' | 'staff';

export interface PortalUser {
  role: UserRole;
  name: string;
  shortName: string;
  initials: string;
  title: string;
  department: string;
}

interface LoginPageProps {
  initialRole?: UserRole; // Kept for interface compatibility but we only use 'doctor'
  onBack: () => void;
  onLogin: (role: UserRole, email: string, password: string) => Promise<void>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // Auto-login for hackathon demo to save time
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin('doctor', 'doctor@amrguard.demo', 'demo1234');
    } catch (e) {
      console.error("Login failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-ref fade-in">
      <div className="login-card-ref">
        
        {/* Left Side Branding */}
        <div className="login-left-ref">
          <div className="circle-decoration"></div>
          <div className="brand-link" onClick={onBack} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <img src="/logo.png" alt="Vyuha Logo" style={{ width: 'auto', height: '60px', maxWidth: '100%', objectFit: 'contain' }} />
          </div>

          <div className="brand-tagline">
            We at <strong>Vyuha</strong> are always fully focused on helping your patient.
          </div>

          <div className="illustration-wrap">
            <svg className="svg-floater" width="320" height="290" viewBox="0 0 260 240" fill="none">
              {/* Podium shadow */}
              <ellipse cx="130" cy="200" rx="85" ry="20" fill="rgba(10, 50, 120, 0.18)"/>
              {/* Podium cylinder body */}
              <path d="M45 172 L45 188 C45 207, 215 207, 215 188 L215 172 Z" fill="rgba(255,255,255,0.4)"/>
              {/* Podium top face */}
              <ellipse cx="130" cy="172" rx="85" ry="22" fill="rgba(255,255,255,0.7)"/>
              <ellipse cx="130" cy="170" rx="79" ry="19" fill="#ffffff"/>

              {/* Stethoscope group */}
              <g transform="translate(0,-8)">
                {/* Tube shadow */}
                <path d="M95 125 C95 148, 168 148, 168 125 L168 88 C168 78, 180 78, 180 88 L180 102"
                      stroke="rgba(0,0,0,0.15)" strokeWidth="11" strokeLinecap="round" fill="none" transform="translate(3,5)"/>
                {/* Left earpiece arm */}
                <path d="M98 70 C98 55, 98 42, 98 42 C98 37, 104 35, 108 39"
                      stroke="#1e3a8a" strokeWidth="7" strokeLinecap="round" fill="none"/>
                {/* Right earpiece arm */}
                <path d="M162 70 C162 55, 162 42, 162 42 C162 37, 156 35, 152 39"
                      stroke="#1e3a8a" strokeWidth="7" strokeLinecap="round" fill="none"/>
                {/* Eartips */}
                <circle cx="110" cy="37" r="5" fill="#ffffff"/>
                <circle cx="150" cy="37" r="5" fill="#ffffff"/>
                {/* U-bridge */}
                <path d="M98 70 C98 100, 162 100, 162 70"
                      stroke="#1e40af" strokeWidth="8" strokeLinecap="round" fill="none"/>
                {/* Center clip */}
                <rect x="126" y="89" width="7" height="9" rx="3" fill="#93c5fd"/>
                {/* Tube to chestpiece */}
                <path d="M130 97 C130 126, 100 134, 100 152 C100 170, 172 170, 172 150 L172 132"
                      stroke="#1e3a8a" strokeWidth="8" strokeLinecap="round" fill="none"/>
                {/* Chestpiece */}
                <circle cx="172" cy="132" r="6" fill="#93c5fd"/>
                <circle cx="181" cy="140" r="15" fill="#1e3a8a"/>
                <circle cx="181" cy="140" r="12" fill="#bfdbfe"/>
                <circle cx="181" cy="140" r="6" fill="#1e3a8a"/>
                <circle cx="181" cy="140" r="3.5" fill="#60a5fa"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Right Side Auth Form */}
        <div className="login-right-ref">
          <button className="back-btn-top" onClick={onBack}>← Back</button>
          
          <div className="form-area">
            <h1 className="form-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>

            <div className="sso-row">
              <button className="sso-pill" onClick={handleAuth}>
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span className="sso-text">Google</span>
              </button>
              <button className="sso-pill" onClick={handleAuth}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="sso-text">Facebook</span>
              </button>
            </div>

            <div className="or-divider">
              <div className="or-line" />
              <span className="or-text">-OR-</span>
              <div className="or-line" />
            </div>

            <form onSubmit={handleAuth}>
              {!isLogin && (
                <div className="field-group">
                  <label className="field-label">Full Name:</label>
                  <div className="input-wrap">
                    <input type="text" className="input-field" placeholder="Dr. John Doe" />
                  </div>
                </div>
              )}

              <div className="field-group">
                <label className="field-label">Email:</label>
                <div className="input-wrap">
                  <input type="email" className="input-field" placeholder="doctor@amrguard.demo" defaultValue="doctor@amrguard.demo" />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Password:</label>
                <div className="input-wrap">
                  <input type="password" className="input-field" placeholder="••••••••" defaultValue="demo1234" />
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Authenticating...' : (isLogin ? 'Log in' : 'Create Account')}
              </button>
            </form>

            <div className="switch-row">
              <span className="switch-text">{isLogin ? "Don't have an Account?" : "Already have an Account?"}</span>
              <button className="switch-link" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
