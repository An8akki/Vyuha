import React from 'react';
import './LandingPage.css';
import { Play, Building2, Users, ClipboardCheck, Activity, Lock, Globe, Server, HeartPulse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LandingPageProps {
  onLaunch: (role?: 'doctor') => void;
}

const scrollTo = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const navigate = useNavigate();
  return (
    <div className="landing-ref">
      {/* DNA Strand Background - contained inside overflow:hidden parent */}
      <div className="dna-realistic-bg" />

      <div style={{ overflowY: 'auto', height: '100vh', scrollBehavior: 'smooth', position: 'relative', zIndex: 1 }}>
      <header className="landing-header-ref" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
        <div className="ref-brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Vyuha Logo" style={{ width: 'auto', height: 48, objectFit: 'contain' }} />
        </div>

        <nav className="ref-nav">
          <button className="ref-nav-link" onClick={() => scrollTo('features')}>Features</button>
          <button className="ref-nav-link" onClick={() => scrollTo('integrations')}>Integrations</button>
          <button className="ref-nav-link" onClick={() => navigate('/simulation')} style={{ color: 'var(--primary)', fontWeight: 700 }}>Simulation</button>
          <button className="ref-nav-link" onClick={() => scrollTo('security')}>Security</button>
          <button className="ref-nav-link" onClick={() => scrollTo('about')}>About</button>
        </nav>

        <div>
          <button className="ref-btn-login" onClick={() => onLaunch('doctor')} style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
            Doctor Login
          </button>
        </div>
      </header>

      <section className="hero-ref" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="hero-content-ref fade-in">
          <h1 className="hero-title-ref hover-3d" style={{ transition: 'transform 0.3s ease', cursor: 'default' }}>
            Empowering Clinical Decisions with Precision
          </h1>
          <p className="hero-subtitle-ref">
            Advanced, real-time AMR insights for healthcare professionals to provide exceptional, data-driven patient care and combat resistance.
          </p>

          <div className="hero-buttons-ref">
            <button className="ref-btn-primary" onClick={() => onLaunch('doctor')} style={{ background: 'var(--primary)', color: 'white' }}>
              Access Clinical Portal
            </button>
            <button className="ref-btn-secondary" onClick={() => scrollTo('features')}>
              <div className="ref-btn-icon-wrap" style={{ background: 'var(--sky-blue)' }}>
                <Play size={16} color="var(--primary)" fill="var(--primary)" />
              </div>
              <span>Explore Features</span>
            </button>
          </div>

          <div className="hero-stats-ref">
            <div className="stat-item-ref hover-3d" style={{ background: 'white', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div className="stat-icon-ref" style={{ background: 'var(--primary)' }}><Building2 color="white" size={20} /></div>
              <div>
                <div className="stat-value-ref" style={{ color: 'var(--text-primary)' }}>50+</div>
                <div className="stat-label-ref">Integrations</div>
              </div>
            </div>
            
            <div className="stat-item-ref hover-3d" style={{ background: 'white', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div className="stat-icon-ref" style={{ background: 'var(--primary)' }}><Users color="white" size={20} /></div>
              <div>
                <div className="stat-value-ref" style={{ color: 'var(--text-primary)' }}>2K+</div>
                <div className="stat-label-ref">Providers</div>
              </div>
            </div>

            <div className="stat-item-ref hover-3d" style={{ background: 'white', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div className="stat-icon-ref" style={{ background: 'var(--primary)' }}><ClipboardCheck color="white" size={20} /></div>
              <div>
                <div className="stat-value-ref" style={{ color: 'var(--text-primary)' }}>99%</div>
                <div className="stat-label-ref">Accuracy</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-visual-ref">
          <img src="/doctor_transparent.png" alt="Doctor" style={{ width: '100%', maxWidth: 600, objectFit: 'contain', position: 'relative', zIndex: 10, filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.15))' }} />
        </div>
      </section>

      {/* --- Details Sections --- */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', display: 'flex', flexDirection: 'column', gap: 120, position: 'relative', zIndex: 10 }}>
        
        {/* Features */}
        <section id="features" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>FEATURES</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.2 }}>Next-Generation Risk Stratification</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Vyuha analyzes dozens of real-time biomarkers and EHR data points in milliseconds to accurately predict Antimicrobial Resistance (AMR) risks before culture results return.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="card-3d" style={{ padding: 24, flex: 1 }}>
                <Activity size={24} color="var(--primary)" style={{ marginBottom: 16 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Live Telemetry</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Continuous monitoring of patient vitals and lab results.</p>
              </div>
              <div className="card-3d" style={{ padding: 24, flex: 1 }}>
                <HeartPulse size={24} color="var(--primary)" style={{ marginBottom: 16 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Empiric Guidance</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>AI-driven recommendations for empiric coverage protocols.</p>
              </div>
            </div>
          </div>
          <div className="card-3d" style={{ height: 400, background: 'linear-gradient(135deg, var(--sky-blue) 0%, #ffffff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={120} color="var(--primary)" style={{ opacity: 0.2 }} />
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div className="card-3d hover-3d hover-lift" style={{ height: 400, background: 'linear-gradient(135deg, var(--sky-blue) 0%, #ffffff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Server size={120} color="var(--primary)" style={{ opacity: 0.2 }} />
          </div>
          <div>
            <div style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>INTEGRATIONS</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.2 }}>Seamless EHR Compatibility</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Vyuha integrates effortlessly with Epic, Cerner, and other leading Electronic Health Record systems via HL7 FHIR standards, requiring zero manual data entry from your clinical staff.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {['HL7 v2.x & FHIR R4 Native Support', 'Bi-directional clinical data flow', 'Single Sign-On (SSO) Ready'].map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--sky-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardCheck size={14} color="var(--primary)" />
                  </div>
                  <span style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Security */}
        <section id="security" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>SECURITY & COMPLIANCE</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.2 }}>Bank-Grade HIPAA Security</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Patient privacy is our highest priority. Vyuha utilizes end-to-end AES-256 encryption, role-based access controls, and comprehensive audit logs.
            </p>
            <div className="card-3d" style={{ padding: 24, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <Lock size={32} color="var(--primary)" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>Federated Learning</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Our models learn continuously without ever exposing raw patient data outside your institution's firewall.
                </p>
              </div>
            </div>
          </div>
          <div className="card-3d" style={{ height: 400, background: 'linear-gradient(135deg, var(--sky-blue) 0%, #ffffff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={120} color="var(--primary)" style={{ opacity: 0.2 }} />
          </div>
        </section>

        {/* About */}
        <section id="about" style={{ textAlign: 'center', padding: '80px 0 120px' }}>
          <div style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>ABOUT VYUHA</div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.2 }}>Join the Fight Against AMR</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 40px' }}>
            Vyuha was built by a dedicated team of clinicians and engineers committed to stopping the spread of Antimicrobial Resistance through intelligent, actionable data.
          </p>
          <button className="ref-btn-primary btn-3d" onClick={() => onLaunch('doctor')} style={{ background: 'var(--primary)', color: 'white', padding: '16px 32px', fontSize: '1.1rem' }}>
            Get Started Today
          </button>
        </section>

      </div>
      </div>
    </div>
  );
};

export default LandingPage;
