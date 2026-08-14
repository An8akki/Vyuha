import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SimulationEngine.css';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';

// ─── AI Voice Hook ───────────────────────────────────────────────────────────
const useSpeech = () => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;    // slightly slower for clarity
    u.pitch = 0.95;  // deeper, male tone
    u.volume = 1.0;
    // Prefer male voice: Google Male, David, Daniel, etc.
    const voices = window.speechSynthesis.getVoices();
    const male = voices.find(v => v.name.includes('Google UK English Male'))
      || voices.find(v => v.name.includes('Google US English') && v.name.includes('Male'))
      || voices.find(v => v.name.includes('David')) // Windows male
      || voices.find(v => v.name.includes('Daniel')) // macOS male
      || voices.find(v => v.name.includes('Alex')) // macOS male
      || voices.find(v => v.name.toLowerCase().includes('male') && v.lang.startsWith('en'))
      || voices.find(v => v.lang === 'en-US')
      || voices[0];
    if (male) u.voice = male;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  }, [voiceEnabled]);

  const stop = useCallback(() => { window.speechSynthesis.cancel(); }, []);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  return { voiceEnabled, setVoiceEnabled, speak, stop };
};

// ─── Scene Definitions ──────────────────────────────────────────────────────
// Durations set long enough for female voice to finish narration naturally
const SCENES = [
  { id: 'intro',       duration: 7000,  phase: 'intro',   narration: 'The outbreak did not suddenly appear. The signals were already there. Vyuha is a system that connects those weak signals early.' },
  { id: 'w_day1_a',   duration: 9000,  phase: 'without', narration: 'Day 1, 8 AM. Hospital status: normal. ICU, Ward A, B, and General Ward. 99 patients. No concerns. Everything looks routine.' },
  { id: 'w_day1_b',   duration: 10000, phase: 'without', narration: 'Day 1, 8:42 AM. Patient P047 admitted to ICU with suspected bacterial infection. A culture is sent. AMR risk signals exist — but nobody connects them to the rest of the hospital.' },
  { id: 'w_culture1', duration: 9000,  phase: 'without', narration: 'Day 1, 6:20 PM. Culture returns. Klebsiella pneumoniae. Resistance code R-07. It is documented. Treatment is reassessed. The case appears closed.' },
  { id: 'w_day2',     duration: 9000,  phase: 'without', narration: 'Day 2, 7:15 AM. Patient P052 develops an infection. Same organism. Same resistance. Two cases now — but they are treated as individuals. No cluster signal.' },
  { id: 'w_transfer', duration: 9000,  phase: 'without', narration: 'Day 2, 2:40 PM. P052 is transferred from ICU to Ward B. The organism moves silently through a shared hospital pathway.' },
  { id: 'w_day3',     duration: 10000, phase: 'without', narration: 'Day 3, 10 AM. Patient P061 in Ward A develops the same infection. Same organism. Same resistance. Three cases. Two wards. 48 hours have passed with no signal.' },
  { id: 'w_signal',   duration: 11000, phase: 'without', narration: 'Day 4. The hospital finally recognizes a possible AMR cluster. The pattern was there all along. But the time to signal: 72 hours. Three days of silent spread.' },
  { id: 'reset',      duration: 6000,  phase: 'reset',   narration: 'Same hospital. Same patients. Same data. Same timeline. One difference: Vyuha is now active.' },
  { id: 'v_day1_a',   duration: 10000, phase: 'with',    narration: 'Day 1, 8:42 AM. P047 admitted. Vyuha evaluates instantly. AMR Risk: 81 percent, HIGH. Previous antibiotic exposure, resistant organism history — the doctor sees the risk immediately.' },
  { id: 'v_culture',  duration: 10000, phase: 'with',    narration: 'Day 1, 6:20 PM. Culture result: Klebsiella R-07. Vyuha does not just store it. It creates a hospital-level signal fingerprint — organism, resistance code, ward, and time — all indexed.' },
  { id: 'v_signal',   duration: 10000, phase: 'with',    narration: 'Day 2, 7:17 AM. P052 appears with the same organism, same resistance. Vyuha connects the signal immediately. AMR signal detected. Not an outbreak — an early warning.' },
  { id: 'v_chain',    duration: 11000, phase: 'with',    narration: 'Vyuha builds the AMR Signal Chain. P047 connected to P052 through shared resistance fingerprint. Organism similarity: 100%. Resistance match: 94%. Investigation triggered at Day 2, not Day 4.' },
  { id: 'v_response', duration: 10000, phase: 'with',    narration: 'Day 2, 8 AM. Response scenario initiated. Patient pathways reviewed. Targeted infection control investigation begins. P061 is flagged before confirmation. The chain is investigated before it grows.' },
  { id: 'compare',    duration: 11000, phase: 'compare', narration: 'Same data. Two timelines. Without Vyuha: pattern recognized on Day 4. With Vyuha: actionable signal raised on Day 2. 48 hours of opportunity — that is the difference.' },
  { id: 'network',    duration: 10000, phase: 'network', narration: 'Without early signal: 8 patients in the simulated exposure network. With Vyuha early signal: 4 patients. The goal is not to predict the future — it is to give the hospital more time to change it.' },
  { id: 'finale',     duration: 11000, phase: 'finale',  narration: 'Vyuha connects weak signals. It assists the doctor. It does not replace clinical judgment. The goal is simple: give the hospital more time to act, before the pattern becomes a crisis.' },
];

// ─── Hospital State per Scene ────────────────────────────────────────────────
const HOSPITAL_STATE: Record<string, any> = {
  intro:       { icu: [0,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  w_day1_a:    { icu: [0,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  w_day1_b:    { icu: [2,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  w_culture1:  { icu: [1,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  w_day2:      { icu: [1,2,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  w_transfer:  { icu: [1,0,0,0], wardA: [0,0,0], wardB: [2,0,0], general: [0,0,0] },
  w_day3:      { icu: [1,0,0,0], wardA: [0,2,0], wardB: [1,0,0], general: [0,0,0] },
  w_signal:    { icu: [1,1,0,0], wardA: [3,0,0], wardB: [1,1,0], general: [3,0,0] },
  reset:       { icu: [0,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  v_day1_a:    { icu: [4,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  v_culture:   { icu: [4,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  v_signal:    { icu: [1,4,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  v_chain:     { icu: [1,1,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  v_response:  { icu: [1,1,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  compare:     { icu: [1,1,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
  network:     { icu: [1,1,0,0], wardA: [0,0,0], wardB: [1,0,0], general: [0,0,0] },
  finale:      { icu: [0,0,0,0], wardA: [0,0,0], wardB: [0,0,0], general: [0,0,0] },
};
// node values: 0=healthy, 1=infected, 2=new-infected, 3=spreading, 4=flagged-by-ai

const NodeDot: React.FC<{ state: number }> = ({ state }) => {
  const cls = ['healthy','infected','new-infected','spreading','ai-flagged'][state] || 'healthy';
  return <div className={`sim-node ${cls}`} />;
};

const HospitalMap: React.FC<{ sceneId: string }> = ({ sceneId }) => {
  const state = HOSPITAL_STATE[sceneId] || HOSPITAL_STATE['intro'];
  return (
    <div className="live-hospital-map">
      <div className="live-ward">
        <div className="ward-label">ICU</div>
        <div className="ward-nodes">
          {state.icu.map((v: number, i: number) => <NodeDot key={i} state={v} />)}
        </div>
      </div>
      <div className="live-ward">
        <div className="ward-label">Ward A</div>
        <div className="ward-nodes">
          {state.wardA.map((v: number, i: number) => <NodeDot key={i} state={v} />)}
        </div>
      </div>
      <div className="live-ward">
        <div className="ward-label">Ward B</div>
        <div className="ward-nodes">
          {state.wardB.map((v: number, i: number) => <NodeDot key={i} state={v} />)}
        </div>
      </div>
      <div className="live-ward">
        <div className="ward-label">General</div>
        <div className="ward-nodes">
          {state.general.map((v: number, i: number) => <NodeDot key={i} state={v} />)}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const SimulationEngine: React.FC = () => {
  const navigate = useNavigate();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0); // 0-100
  const [typedNarration, setTypedNarration] = useState('');
  const { voiceEnabled, setVoiceEnabled, speak, stop } = useSpeech();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const currentScene = SCENES[sceneIdx];

  // ── Typewriter Effect ──
  const startTyping = useCallback((text: string) => {
    if (typingRef.current) clearInterval(typingRef.current);
    setTypedNarration('');
    let i = 0;
    typingRef.current = setInterval(() => {
      setTypedNarration(text.slice(0, i + 1));
      i++;
      if (i >= text.length && typingRef.current) clearInterval(typingRef.current);
    }, 28);
  }, []);

  // ── Scene Advance ──
  const goToScene = useCallback((idx: number) => {
    if (idx >= SCENES.length) { setPlaying(false); return; }
    setSceneIdx(idx);
    setSceneProgress(0);
    startTimeRef.current = Date.now();
    startTyping(SCENES[idx].narration);
  }, [startTyping]);

  // ── Auto-progress timer ──
  useEffect(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!playing) return;

    const dur = currentScene.duration;
    startTimeRef.current = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setSceneProgress(Math.min(100, (elapsed / dur) * 100));
    }, 50);

    // If voice is disabled, we use the fixed timer
    if (!voiceEnabled) {
      timerRef.current = setTimeout(() => {
        goToScene(sceneIdx + 1);
      }, dur);
    }

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, sceneIdx, currentScene.duration, goToScene, voiceEnabled]);

  // Start typing and speaking on scene change
  useEffect(() => {
    startTyping(currentScene.narration);
    if (playing) {
      if (voiceEnabled) {
        speak(currentScene.narration, () => {
          // When speech finishes, wait a brief moment and advance
          timerRef.current = setTimeout(() => {
            // Need to check if still playing to prevent advancing after pause
            setPlaying(p => {
              if (p) goToScene(sceneIdx + 1);
              return p;
            });
          }, 800);
        });
      } else {
        speak(currentScene.narration); // Call anyway just in case it handles disabled state internally
      }
    }
  }, [sceneIdx, currentScene.narration, startTyping, playing, speak, voiceEnabled, goToScene]);

  const handlePlay = () => {
    if (sceneIdx >= SCENES.length - 1 && !playing) {
      // Restart
      stop();
      goToScene(0);
    }
    if (playing) stop();
    setPlaying(p => !p);
  };

  const handleRestart = () => {
    stop();
    setPlaying(false);
    goToScene(0);
    setTimeout(() => setPlaying(true), 100);
  };

  const totalProgress = ((sceneIdx + sceneProgress / 100) / SCENES.length) * 100;

  return (
    <div className="sim-live-page">
      {/* Cinematic Header */}
      <div className="sim-live-header">
        <button className="sim-back-btn" onClick={() => navigate('/')}>← Back to Vyuha</button>
        <div className="sim-live-title">
          <span className="sim-live-badge">LIVE SIMULATION</span>
          <span>VYUHA: THE TWO-FUTURE SCENARIO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="sim-ctrl-btn"
            onClick={() => setVoiceEnabled(v => !v)}
            title={voiceEnabled ? 'Mute AI Voice' : 'Enable AI Voice'}
            style={{ background: voiceEnabled ? 'rgba(72,199,186,0.2)' : undefined, color: voiceEnabled ? '#48c7ba' : undefined }}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <div className="sim-scene-counter">{sceneIdx + 1} / {SCENES.length}</div>
        </div>
      </div>

      {/* Main Cinematic Stage */}
      <div className="sim-stage" data-phase={currentScene.phase}>

        {/* === INTRO SCENE === */}
        {currentScene.phase === 'intro' && (
          <div className="scene-intro">
            <div className="intro-headline">VYUHA</div>
            <div className="intro-sub">THE TWO-FUTURE SIMULATION</div>
            <div className="intro-divider" />
            <div className="intro-quote">"The outbreak didn't suddenly appear.<br/>The signals were already there."</div>
          </div>
        )}

        {/* === WITHOUT VYUHA SCENES === */}
        {currentScene.phase === 'without' && (
          <div className="scene-main">
            <div className="scene-panel left">
              <div className="scene-tag tag-bad">WITHOUT VYUHA · THE SILENT SPREAD</div>

              {currentScene.id === 'w_day1_a' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 1 · 08:00</div>
                  <div className="event-title">All Wards Normal</div>
                  <div className="event-stat-row">
                    <div className="event-stat"><span>ICU</span><strong>18</strong></div>
                    <div className="event-stat"><span>Ward A</span><strong>24</strong></div>
                    <div className="event-stat"><span>Ward B</span><strong>21</strong></div>
                    <div className="event-stat"><span>General</span><strong>36</strong></div>
                  </div>
                  <div className="event-status green">No confirmed outbreak</div>
                </div>
              )}

              {currentScene.id === 'w_day1_b' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 1 · 08:42</div>
                  <div className="event-title">Patient P047 Admitted</div>
                  <div className="event-body">Suspected bacterial infection. Culture sent. Clinical management started.</div>
                  <div className="signal-ignored">AMR Risk: 81% · <em>Signal not connected to hospital-wide layer</em></div>
                </div>
              )}

              {currentScene.id === 'w_culture1' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 1 · 18:20</div>
                  <div className="event-title">Culture Result</div>
                  <div className="culture-card">
                    <div className="culture-row"><span>Patient</span><strong>P047</strong></div>
                    <div className="culture-row"><span>Organism</span><strong>Klebsiella pneumoniae</strong></div>
                    <div className="culture-row highlight-red"><span>Resistance</span><strong>R-07</strong></div>
                  </div>
                  <div className="event-status gray">Result documented. Nothing connects this case to others.</div>
                </div>
              )}

              {currentScene.id === 'w_day2' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 2 · 07:15</div>
                  <div className="event-title">Patient P052</div>
                  <div className="culture-card">
                    <div className="culture-row highlight-red"><span>Culture</span><strong>Klebsiella R-07</strong></div>
                  </div>
                  <div className="event-body">Two cases now. Treated as individual results. No cluster signal.</div>
                </div>
              )}

              {currentScene.id === 'w_transfer' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 2 · 14:40</div>
                  <div className="event-title">Patient Movement</div>
                  <div className="transfer-visual">
                    <div className="transfer-from">ICU</div>
                    <div className="transfer-arrow">→</div>
                    <div className="transfer-to">Ward B</div>
                  </div>
                  <div className="event-body">P052 transferred through shared hospital pathway. The organism moves.</div>
                </div>
              )}

              {currentScene.id === 'w_day3' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 3 · 10:05</div>
                  <div className="event-title">Patient P061</div>
                  <div className="culture-card">
                    <div className="culture-row highlight-red"><span>Culture</span><strong>Klebsiella R-07</strong></div>
                  </div>
                  <div className="cluster-stat-row">
                    <div className="cluster-stat"><strong>3</strong><span>Patients</span></div>
                    <div className="cluster-stat"><strong>2</strong><span>Wards</span></div>
                    <div className="cluster-stat"><strong>1</strong><span>Organism</span></div>
                    <div className="cluster-stat"><strong>48h</strong><span>Window</span></div>
                  </div>
                  <div className="event-status orange">No early cross-patient signal engine active</div>
                </div>
              )}

              {currentScene.id === 'w_signal' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 4</div>
                  <div className="event-title" style={{ color: 'var(--risk-high)' }}>⚠ Cluster Recognized</div>
                  <div className="event-body">3 confirmed cases. Multiple wards connected. Investigation begins.</div>
                  <div className="punchline-box red">
                    <div className="punchline-number">72 hours</div>
                    <div className="punchline-label">Time to Signal</div>
                    <div className="punchline-sub">"The resistance pattern existed before the cluster was formally recognized."</div>
                  </div>
                </div>
              )}
            </div>

            <div className="scene-panel right">
              <HospitalMap sceneId={currentScene.id} />
            </div>
          </div>
        )}

        {/* === RESET SCENE === */}
        {currentScene.phase === 'reset' && (
          <div className="scene-reset">
            <div className="reset-ring" />
            <div className="reset-text">↻ RESETTING</div>
            <div className="reset-sub">Same hospital. Same patients. Same data.</div>
            <div className="reset-highlight">VYUHA IS NOW ACTIVE</div>
          </div>
        )}

        {/* === WITH VYUHA SCENES === */}
        {currentScene.phase === 'with' && (
          <div className="scene-main">
            <div className="scene-panel left">
              <div className="scene-tag tag-good">WITH VYUHA · PREDICT &amp; PREVENT</div>

              {currentScene.id === 'v_day1_a' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 1 · 08:42</div>
                  <div className="event-title">P047 Admitted · Vyuha Evaluates</div>
                  <div className="vyuha-risk-card">
                    <div className="risk-label-sm">AMR RISK</div>
                    <div className="risk-score-big">81%<span>HIGH</span></div>
                    <div className="risk-reasons">
                      <div className="risk-reason">Previous antibiotic exposure</div>
                      <div className="risk-reason">Previous resistant organism</div>
                      <div className="risk-reason">Recent hospitalization</div>
                    </div>
                  </div>
                  <div className="event-body">The doctor sees the risk. The clinician remains in control.</div>
                </div>
              )}

              {currentScene.id === 'v_culture' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 1 · 18:20</div>
                  <div className="event-title">Culture → Hospital Signal Created</div>
                  <div className="signal-fingerprint">
                    <div className="fp-row"><span>ORGANISM</span><strong>Klebsiella pneumoniae</strong></div>
                    <div className="fp-row"><span>FINGERPRINT</span><strong className="fp-code">R-07</strong></div>
                    <div className="fp-row"><span>WARD</span><strong>ICU</strong></div>
                    <div className="fp-row"><span>TIME</span><strong>18:20</strong></div>
                  </div>
                  <div className="event-status green">Signal indexed. No cluster yet. One case is one case.</div>
                </div>
              )}

              {currentScene.id === 'v_signal' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 2 · 07:17</div>
                  <div className="event-title">P052 → Signal Matched</div>
                  <div className="amr-signal-alert">
                    <div className="signal-icon">🟡</div>
                    <div className="signal-text">
                      <strong>AMR SIGNAL DETECTED</strong>
                      <p>2 patients · 1 organism · Similar resistance · Same environment</p>
                    </div>
                  </div>
                  <div className="event-body" style={{ fontStyle: 'italic' }}>Not: "Outbreak confirmed." Instead: "Early signal. Investigation recommended."</div>
                </div>
              )}

              {currentScene.id === 'v_chain' && (
                <div className="scene-event-stack">
                  <div className="event-title">AMR Signal Chain</div>
                  <div className="live-chain">
                    <div className="chain-bubble p047">
                      <strong>P047</strong>
                      <span>81% · Culture R-07</span>
                    </div>
                    <div className="chain-connector">
                      <div className="chain-wire" />
                      <div className="chain-tag">Shared resistance fingerprint</div>
                    </div>
                    <div className="chain-bubble p052">
                      <strong>P052</strong>
                      <span>76% · Culture R-07</span>
                    </div>
                  </div>
                  <div className="signal-basis">
                    <div className="basis-item"><span>Organism similarity</span><div className="basis-bar" style={{width:'100%'}} /><b>100%</b></div>
                    <div className="basis-item"><span>Resistance match</span><div className="basis-bar" style={{width:'94%'}} /><b>94%</b></div>
                    <div className="basis-item"><span>Temporal proximity</span><div className="basis-bar" style={{width:'91%'}} /><b>91%</b></div>
                    <div className="basis-item"><span>Ward relationship</span><div className="basis-bar" style={{width:'86%'}} /><b>86%</b></div>
                  </div>
                </div>
              )}

              {currentScene.id === 'v_response' && (
                <div className="scene-event-stack">
                  <div className="event-timestamp">Day 2 · 08:00</div>
                  <div className="event-title">Response Scenario Initiated</div>
                  <div className="response-list">
                    <div className="response-item">✓ Review affected patients</div>
                    <div className="response-item">✓ Review patient movement pathways</div>
                    <div className="response-item">✓ Targeted infection-control investigation</div>
                    <div className="response-item">✓ Enhanced microbiological surveillance</div>
                    <div className="response-item">✓ P061 flagged before confirmation</div>
                  </div>
                  <div className="scenario-disclaimer">Scenario assumptions — demonstrating concept, not validated outcomes</div>
                </div>
              )}
            </div>

            <div className="scene-panel right">
              <HospitalMap sceneId={currentScene.id} />
            </div>
          </div>
        )}

        {/* === COMPARE SCENE === */}
        {currentScene.phase === 'compare' && (
          <div className="scene-compare">
            <h2 className="compare-headline">SAME DATA. EARLIER SIGNAL.</h2>
            <div className="compare-timelines">
              <div className="cmp-col bad">
                <div className="cmp-header">WITHOUT VYUHA</div>
                <div className="cmp-days">
                  <div className="cmp-day"><span>DAY 1</span><div className="cmp-dot red" /></div>
                  <div className="cmp-day"><span>DAY 2</span><div className="cmp-dot red" /></div>
                  <div className="cmp-day"><span>DAY 3</span><div className="cmp-dot red" /></div>
                  <div className="cmp-day signal-day"><span>DAY 4</span><div className="cmp-dot alert pulse" /><div className="cmp-label">Pattern Recognized</div></div>
                </div>
              </div>
              <div className="cmp-divider">
                <div className="vs-badge">48 HOURS OF OPPORTUNITY</div>
              </div>
              <div className="cmp-col good">
                <div className="cmp-header">WITH VYUHA</div>
                <div className="cmp-days">
                  <div className="cmp-day"><span>DAY 1</span><div className="cmp-dot red" /></div>
                  <div className="cmp-day signal-day"><span>DAY 2</span><div className="cmp-dot vyuha pulse" /><div className="cmp-label" style={{color:'var(--primary)'}}>Signal → Investigate → Respond</div></div>
                  <div className="cmp-day"><span>DAY 3</span></div>
                  <div className="cmp-day"><span>DAY 4</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === NETWORK SCENE === */}
        {currentScene.phase === 'network' && (
          <div className="scene-network">
            <h2 className="compare-headline">THE "WHAT IF?" ENGINE</h2>
            <div className="network-split">
              <div className="net-col">
                <div className="net-label bad">Without Vyuha</div>
                <svg className="net-svg" viewBox="0 0 240 300">
                  <circle cx="80" cy="30" r="18" fill="#f04455" opacity="0.9"/>
                  <text x="80" y="35" textAnchor="middle" fontSize="11" fill="white">P047</text>
                  <circle cx="160" cy="30" r="18" fill="#f04455" opacity="0.9"/>
                  <text x="160" y="35" textAnchor="middle" fontSize="11" fill="white">P052</text>
                  <line x1="80" y1="48" x2="120" y2="90" stroke="#f04455" strokeWidth="1.5" strokeDasharray="4"/>
                  <line x1="160" y1="48" x2="120" y2="90" stroke="#f04455" strokeWidth="1.5" strokeDasharray="4"/>
                  <circle cx="120" cy="108" r="18" fill="#f04455" opacity="0.8"/>
                  <text x="120" y="113" textAnchor="middle" fontSize="11" fill="white">P073</text>
                  <line x1="100" y1="125" x2="70" y2="165" stroke="#f04455" strokeWidth="1.5" strokeDasharray="4"/>
                  <line x1="140" y1="125" x2="175" y2="165" stroke="#f04455" strokeWidth="1.5" strokeDasharray="4"/>
                  <circle cx="70" cy="183" r="16" fill="#f04455" opacity="0.7"/>
                  <text x="70" y="188" textAnchor="middle" fontSize="11" fill="white">P081</text>
                  <circle cx="175" cy="183" r="16" fill="#f04455" opacity="0.7"/>
                  <text x="175" y="188" textAnchor="middle" fontSize="11" fill="white">P094</text>
                  <line x1="175" y1="199" x2="155" y2="240" stroke="#f04455" strokeWidth="1.5" strokeDasharray="4"/>
                  <circle cx="155" cy="258" r="14" fill="#f04455" opacity="0.5"/>
                  <text x="155" y="263" textAnchor="middle" fontSize="11" fill="white">P102</text>
                </svg>
                <div className="net-count bad">Potential exposure: <strong>8 patients</strong></div>
              </div>
              <div className="net-col">
                <div className="net-label good">With Vyuha</div>
                <svg className="net-svg" viewBox="0 0 240 300">
                  <circle cx="80" cy="30" r="18" fill="#f04455" opacity="0.9"/>
                  <text x="80" y="35" textAnchor="middle" fontSize="11" fill="white">P047</text>
                  <circle cx="160" cy="30" r="18" fill="#f04455" opacity="0.9"/>
                  <text x="160" y="35" textAnchor="middle" fontSize="11" fill="white">P052</text>
                  {/* Shield blocking spread */}
                  <line x1="80" y1="48" x2="120" y2="80" stroke="#48c7ba" strokeWidth="2"/>
                  <line x1="160" y1="48" x2="120" y2="80" stroke="#48c7ba" strokeWidth="2"/>
                  <rect x="60" y="90" width="120" height="36" rx="8" fill="#48c7ba" opacity="0.15" stroke="#48c7ba" strokeWidth="2" strokeDasharray="6"/>
                  <text x="120" y="113" textAnchor="middle" fontSize="12" fill="#48c7ba" fontWeight="bold">INVESTIGATION</text>
                  <text x="75" y="155" textAnchor="middle" fontSize="28" fill="#ef4444">✕</text>
                  <text x="175" y="155" textAnchor="middle" fontSize="28" fill="#ef4444">✕</text>
                  <circle cx="120" cy="200" r="16" fill="#48c7ba" opacity="0.7"/>
                  <text x="120" y="205" textAnchor="middle" fontSize="11" fill="white">P061</text>
                  <text x="120" y="240" textAnchor="middle" fontSize="10" fill="#48c7ba">Flagged &amp; monitored</text>
                </svg>
                <div className="net-count good">Potential exposure: <strong>4 patients</strong></div>
              </div>
            </div>
            <div className="net-disclaimer">Illustrative simulation based on predefined hospital-network assumptions. Not a transmission prediction.</div>
          </div>
        )}

        {/* === FINALE SCENE === */}
        {currentScene.phase === 'finale' && (
          <div className="scene-finale">
            <div className="finale-split">
              <div className="fin-col fin-bad">
                <div className="fin-label">Without Vyuha</div>
                <div className="fin-orb red-orb" />
                <div className="fin-desc">Pattern becomes visible</div>
                <div className="fin-day">Day 4</div>
              </div>
              <div className="fin-center">
                <div className="fin-hours">48 HOURS</div>
                <div className="fin-hours-sub">OF OPPORTUNITY</div>
              </div>
              <div className="fin-col fin-good">
                <div className="fin-label" style={{color:'var(--primary)'}}>With Vyuha</div>
                <div className="fin-orb green-orb" />
                <div className="fin-desc">Pattern becomes actionable</div>
                <div className="fin-day" style={{color:'var(--primary)'}}>Day 2</div>
              </div>
            </div>
            <div className="finale-quote">
              "The goal isn't to predict the future.<br/>It's to give the hospital more time to change it."
            </div>
          </div>
        )}

        {/* Narration Bar */}
        <div className="narration-bar">
          <Volume2 size={16} className="narration-icon" />
          <span className="narration-text">{typedNarration}<span className="narration-cursor">|</span></span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="sim-progress-track">
        <div className="sim-progress-fill" style={{ width: `${totalProgress}%` }} />
        {SCENES.map((s, i) => (
          <div
            key={i}
            className={`sim-chapter-tick ${i <= sceneIdx ? 'done' : ''} ${s.phase}`}
            style={{ left: `${(i / SCENES.length) * 100}%` }}
            title={s.phase}
            onClick={() => { setPlaying(false); goToScene(i); }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="sim-controls">
        <button className="sim-ctrl-btn" onClick={handleRestart}><RotateCcw size={20} /></button>
        <button className="sim-play-btn" onClick={handlePlay}>
          {playing ? <Pause size={28} /> : <Play size={28} fill="currentColor" />}
        </button>
        <div className="sim-phase-badge" data-phase={currentScene.phase}>
          {currentScene.phase === 'without' ? '⚠ WITHOUT VYUHA'
           : currentScene.phase === 'with' ? '✓ WITH VYUHA'
           : currentScene.phase === 'compare' ? '⟺ COMPARISON'
           : currentScene.phase === 'network' ? '◎ NETWORK'
           : currentScene.phase === 'finale' ? '★ FINALE'
           : '▶ INTRO'}
        </div>
      </div>
    </div>
  );
};

export default SimulationEngine;
