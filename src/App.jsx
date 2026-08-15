import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, ArrowLeft, Square, BarChart3, Atom, FlaskConical, Calculator, Languages, Leaf, BookOpen, X, Trash2, Flame, ChevronRight } from "lucide-react";

const STORAGE_KEY = "ttusa-study-timer-v1";

const COLORS = {
  bg: "#0B0B0E",      // near-black page background
  card: "#1C1C1F",    // dark gray card surfaces
  text: "#FFFFFF",    // primary text
  muted: "#8E8E93",   // gray labels
  highlight: "#FFFFFF", // buttons, ring, progress — kept neutral, not orange
};

const FLAME = "#FF8A3D"; // used only for flame icons + the streak milestone bar

const MILESTONES = [7, 14, 30, 60, 100, 180, 365];

const SUBJECT_ICONS = [
  { match: /phys/i, Icon: Atom, color: COLORS.highlight },
  { match: /chem/i, Icon: FlaskConical, color: COLORS.muted },
  { match: /math/i, Icon: Calculator, color: COLORS.highlight },
  { match: /eng|lang/i, Icon: Languages, color: COLORS.muted },
  { match: /bio/i, Icon: Leaf, color: COLORS.highlight },
];

function iconFor(name) {
  const found = SUBJECT_ICONS.find((s) => s.match.test(name));
  return found || { Icon: BookOpen, color: COLORS.highlight };
}

function fmtClock(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtHours(totalSeconds) {
  const h = totalSeconds / 3600;
  if (h < 1) return `${Math.round(totalSeconds / 60)}m`;
  return `${h.toFixed(1)}h`;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function getMonday(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function computeCurrentStreak(datesSet) {
  let streak = 0;
  let d = new Date();
  if (!datesSet.has(todayKey(d))) d.setDate(d.getDate() - 1);
  let startDate = null;
  while (datesSet.has(todayKey(d))) {
    streak++;
    startDate = todayKey(d);
    d.setDate(d.getDate() - 1);
  }
  return { streak, startDate };
}

function computeMaxStreak(datesSet, currentStreak) {
  if (datesSet.size === 0) return currentStreak;
  const dates = Array.from(datesSet).sort();
  let max = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diffDays = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
    if (diffDays === 1) { cur++; max = Math.max(max, cur); }
    else if (diffDays > 1) { cur = 1; }
  }
  return Math.max(max, currentStreak);
}

export default function StudyTimer() {
  const [loaded, setLoaded] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [screen, setScreen] = useState("home");
  const [newSubject, setNewSubject] = useState("");
  const [draftSubjects, setDraftSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const intervalRef = useRef(null);
  const [addingSubject, setAddingSubject] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setSubjects(data.subjects || []);
        setLogs(data.logs || []);
        setScreen((data.subjects || []).length > 0 ? "home" : "onboarding");
      } else {
        setScreen("onboarding");
      }
    } catch (e) {
      setScreen("onboarding");
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((nextSubjects, nextLogs) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects: nextSubjects, logs: nextLogs })); }
    catch (e) { /* storage full or unavailable — fails silently */ }
  }, []);

  useEffect(() => {
    if (screen === "timer" && startRef.current) {
      intervalRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);
      return () => clearInterval(intervalRef.current);
    }
  }, [screen]);

  function addDraftSubject() {
    const name = newSubject.trim();
    if (!name) return;
    if (draftSubjects.some((s) => s.toLowerCase() === name.toLowerCase())) { setNewSubject(""); return; }
    setDraftSubjects((d) => [...d, name]);
    setNewSubject("");
  }

  function finishOnboarding() {
    if (draftSubjects.length === 0) return;
    const next = draftSubjects.map((name, i) => ({ id: `${Date.now()}-${i}`, name }));
    setSubjects(next);
    persist(next, logs);
    setScreen("home");
  }

  function addSubjectFromHome() {
    const name = newSubject.trim();
    if (!name) return;
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) { setNewSubject(""); setAddingSubject(false); return; }
    const next = [...subjects, { id: `${Date.now()}`, name }];
    setSubjects(next);
    persist(next, logs);
    setNewSubject("");
    setAddingSubject(false);
  }

  function actuallyRemoveSubject(id) {
    const next = subjects.filter((s) => s.id !== id);
    setSubjects(next);
    persist(next, logs);
  }

  function actuallyStartTimer(subject) {
    setActiveSubject(subject);
    startRef.current = Date.now();
    setElapsed(0);
    setScreen("timer");
  }

  const requestStart = (subject) => setPendingConfirm({ type: "start", subject });
  const requestDelete = (subject) => setPendingConfirm({ type: "delete", subject });

  function confirmYes() {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === "start") actuallyStartTimer(pendingConfirm.subject);
    if (pendingConfirm.type === "delete") actuallyRemoveSubject(pendingConfirm.subject.id);
    setPendingConfirm(null);
  }
  const confirmNo = () => setPendingConfirm(null);

  function discardTimer() {
    clearInterval(intervalRef.current);
    startRef.current = null;
    setActiveSubject(null);
    setScreen("home");
  }

  function finishTimer() {
    clearInterval(intervalRef.current);
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    if (durationSec >= 5) {
      const entry = { id: `${Date.now()}`, subjectId: activeSubject.id, subjectName: activeSubject.name, seconds: durationSec, date: todayKey(), endedAt: Date.now() };
      const nextLogs = [...logs, entry];
      setLogs(nextLogs);
      persist(subjects, nextLogs);
    }
    startRef.current = null;
    setActiveSubject(null);
    setScreen("home");
  }

  const totalForSubject = (id) => logs.filter((l) => l.subjectId === id).reduce((a, l) => a + l.seconds, 0);
  const totalToday = logs.filter((l) => l.date === todayKey()).reduce((a, l) => a + l.seconds, 0);
  const sessionsToday = logs.filter((l) => l.date === todayKey()).length;

  const datesSet = new Set(logs.map((l) => l.date));
  const { streak, startDate } = computeCurrentStreak(datesSet);
  const maxStreak = computeMaxStreak(datesSet, streak);

  if (!loaded) return <div style={styles.loadingScreen}><div style={styles.loadingDot} /></div>;

  return (
    <div style={styles.app}>
      <style>{fontImports}</style>
      {screen === "onboarding" && (
        <Onboarding newSubject={newSubject} setNewSubject={setNewSubject} draftSubjects={draftSubjects}
          addDraftSubject={addDraftSubject} removeDraft={(name) => setDraftSubjects((d) => d.filter((s) => s !== name))}
          finish={finishOnboarding} />
      )}
      {screen === "home" && (
        <Home subjects={subjects} totalForSubject={totalForSubject} totalToday={totalToday} sessionsToday={sessionsToday}
          streak={streak} requestStart={requestStart} requestDelete={requestDelete}
          addingSubject={addingSubject} setAddingSubject={setAddingSubject}
          newSubject={newSubject} setNewSubject={setNewSubject} addSubjectFromHome={addSubjectFromHome}
          goStats={() => setScreen("stats")} goStreak={() => setScreen("streak")} />
      )}
      {screen === "timer" && (
        <TimerScreen subject={activeSubject} elapsed={elapsed} onFinish={finishTimer} onDiscard={discardTimer} />
      )}
      {screen === "stats" && (
        <Stats subjects={subjects} logs={logs} totalForSubject={totalForSubject} onBack={() => setScreen("home")} />
      )}
      {screen === "streak" && (
        <StreakScreen streak={streak} maxStreak={maxStreak} startDate={startDate} datesSet={datesSet} onBack={() => setScreen("home")} />
      )}

      {pendingConfirm && pendingConfirm.type === "delete" && (
        <ConfirmModal subjectName={pendingConfirm.subject.name} onYes={confirmYes} onNo={confirmNo} />
      )}
      {pendingConfirm && pendingConfirm.type === "start" && (
        <StartSheet subjectName={pendingConfirm.subject.name} onContinue={confirmYes} onCancel={confirmNo} />
      )}
    </div>
  );
}

function ConfirmModal({ subjectName, onYes, onNo }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalText}>Delete "{subjectName}"? Sessions already logged for it will stay in your stats.</div>
        <div style={styles.modalBtnRow}>
          <button style={styles.modalBtnNo} onClick={onNo}>No</button>
          <button style={styles.modalBtnYes} onClick={onYes}>Yes</button>
        </div>
      </div>
    </div>
  );
}

function StartSheet({ subjectName, onContinue, onCancel }) {
  return (
    <div style={styles.sheetOverlay} onClick={onCancel}>
      <div style={styles.sheetBar} onClick={(e) => e.stopPropagation()}>
        <div style={styles.sheetHandle} />
        <div style={styles.sheetText}>Start a session for <strong>{subjectName}</strong>?</div>
        <button style={styles.sheetContinueBtn} onClick={onContinue}>CONTINUE</button>
        <button style={styles.sheetCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function LeaveConfirmSheet({ onFinish, onDiscard, onDismiss }) {
  return (
    <div style={styles.sheetOverlay} onClick={onDismiss}>
      <div style={styles.sheetBar} onClick={(e) => e.stopPropagation()}>
        <div style={styles.sheetHandle} />
        <div style={styles.sheetText}>Leaving now without finishing will lose this session's time.</div>
        <button style={styles.sheetContinueBtn} onClick={onFinish}>
          <Square size={15} color={COLORS.bg} fill={COLORS.bg} style={{ marginRight: 6, verticalAlign: "-2px" }} />
          FINISH SESSION
        </button>
        <button style={styles.sheetDiscardBtn} onClick={onDiscard}>Discard without saving</button>
      </div>
    </div>
  );
}

function Onboarding({ newSubject, setNewSubject, draftSubjects, addDraftSubject, removeDraft, finish }) {
  return (
    <div style={styles.screen}>
      <div style={{ marginTop: 48 }}>
        <div style={styles.eyebrow}>PROJECT · TICKET TO USA</div>
        <h1 style={styles.h1}>Log the hours.<br />Trust the record.</h1>
        <p style={styles.sub}>Add every subject you're studying. You'll tap one to start a session, and every finished session gets logged automatically.</p>
      </div>
      <div style={{ marginTop: 32 }}>
        <div style={styles.inputRow}>
          <input style={styles.input} placeholder="e.g. Physics" value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDraftSubject()} />
          <button style={styles.iconBtn} onClick={addDraftSubject} aria-label="Add subject"><Plus size={20} color={COLORS.bg} /></button>
        </div>
        <div style={styles.chipWrap}>
          {draftSubjects.map((name) => {
            const { Icon, color } = iconFor(name);
            return (
              <div key={name} style={{ ...styles.chip, borderColor: color }}>
                <Icon size={14} color={color} />
                <span>{name}</span>
                <button style={styles.chipX} onClick={() => removeDraft(name)} aria-label={`Remove ${name}`}><X size={12} color={COLORS.muted} /></button>
              </div>
            );
          })}
        </div>
      </div>
      <button style={{ ...styles.primaryBtn, marginTop: "auto", opacity: draftSubjects.length ? 1 : 0.4 }}
        disabled={!draftSubjects.length} onClick={finish}>
        Start tracking ({draftSubjects.length})
      </button>
    </div>
  );
}

function Home({
  subjects, totalForSubject, totalToday, sessionsToday, streak, requestStart, requestDelete,
  addingSubject, setAddingSubject, newSubject, setNewSubject, addSubjectFromHome, goStats, goStreak
}) {
  return (
    <div style={styles.screen}>
      <div style={styles.homeHeaderRow}>
        <div>
          <div style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
          <h1 style={{ ...styles.h1, fontSize: 30, marginTop: 6 }}>
            {fmtHours(totalToday)} <span style={{ color: COLORS.muted, fontSize: 16, fontFamily: "Inter, sans-serif", fontWeight: 400 }}>today · {sessionsToday} session{sessionsToday !== 1 ? "s" : ""}</span>
          </h1>
        </div>
        <button style={styles.streakBox} onClick={goStreak} aria-label="View streak">
          <Flame size={22} color={FLAME} fill={FLAME} />
          <span style={styles.streakBoxNum}>{streak}</span>
        </button>
      </div>

      <button style={styles.statsPillFull} onClick={goStats} aria-label="View statistics">
        <BarChart3 size={16} color={COLORS.highlight} />
        <span>Statistics</span>
        <ChevronRight size={16} color={COLORS.muted} style={{ marginLeft: "auto" }} />
      </button>

      <div style={styles.subjectList}>
        {subjects.map((s) => {
          const { Icon, color } = iconFor(s.name);
          const total = totalForSubject(s.id);
          return (
            <div key={s.id} style={styles.subjectCard} onClick={() => requestStart(s)}>
              <div style={{ ...styles.subjectIconWrap, background: `${color}22` }}><Icon size={22} color={color} /></div>
              <div style={{ flex: 1 }}>
                <div style={styles.subjectName}>{s.name}</div>
                <div style={styles.subjectMeta}>{total > 0 ? `${fmtHours(total)} logged` : "no sessions yet"}</div>
              </div>
              <button style={styles.trashBtn} onClick={(e) => { e.stopPropagation(); requestDelete(s); }} aria-label={`Remove ${s.name}`}>
                <Trash2 size={15} color={COLORS.muted} />
              </button>
            </div>
          );
        })}
      </div>

      {addingSubject ? (
        <div style={styles.inputRow}>
          <input style={styles.input} autoFocus placeholder="Subject name" value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubjectFromHome()} />
          <button style={styles.iconBtn} onClick={addSubjectFromHome}><Plus size={20} color={COLORS.bg} /></button>
        </div>
      ) : (
        <button style={styles.addSubjectBtn} onClick={() => setAddingSubject(true)}><Plus size={16} color={COLORS.highlight} /> Add subject</button>
      )}
    </div>
  );
}

function TimerScreen({ subject, elapsed, onFinish, onDiscard }) {
  const { Icon, color } = iconFor(subject.name);
  const cycle = Math.floor(elapsed / 60);
  const angle = ((elapsed % 60) / 60) * 360;
  const circumference = 2 * Math.PI * 112;
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <div style={{ ...styles.screen, justifyContent: "space-between", alignItems: "center", paddingTop: 24 }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
        <button style={styles.backBtn} onClick={() => setConfirmLeave(true)} aria-label="Leave session"><ArrowLeft size={20} color={COLORS.muted} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ ...styles.subjectIconWrap, width: 52, height: 52, background: `${color}22` }}><Icon size={26} color={color} /></div>
        <div style={styles.timerLabel}>{subject.name}</div>
        <div style={styles.ringWrap}>
          <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "absolute", top: 0, left: 0 }}>
            <circle cx="120" cy="120" r="112" fill="none" stroke={COLORS.card} strokeWidth="2" />
            <circle key={cycle} cx="120" cy="120" r="112" fill="none" stroke={COLORS.highlight} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${(angle / 360) * circumference} ${circumference}`}
              transform="rotate(-90 120 120)" style={{ animation: "ringFadeIn 0.35s ease-out" }} />
          </svg>
          <div style={styles.timerDigits}>{fmtClock(elapsed)}</div>
        </div>
      </div>
      <button style={styles.finishBtn} onClick={onFinish}>
        <Square size={16} color={COLORS.bg} fill={COLORS.bg} /> Finish session
      </button>

      {confirmLeave && (
        <LeaveConfirmSheet onFinish={onFinish} onDiscard={onDiscard} onDismiss={() => setConfirmLeave(false)} />
      )}
    </div>
  );
}

function Stats({ subjects, logs, totalForSubject, onBack }) {
  const totals = subjects.map((s) => ({ ...s, total: totalForSubject(s.id), sessions: logs.filter((l) => l.subjectId === s.id).length }))
    .sort((a, b) => b.total - a.total);
  const grandTotal = totals.reduce((a, s) => a + s.total, 0);
  const maxTotal = Math.max(1, ...totals.map((s) => s.total));
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = todayKey(d);
    const secs = logs.filter((l) => l.date === key).reduce((a, l) => a + l.seconds, 0);
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), secs };
  });
  const maxDay = Math.max(1, ...last7.map((d) => d.secs));
  return (
    <div style={styles.screen}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button style={styles.backBtn} onClick={onBack} aria-label="Back"><ArrowLeft size={20} color={COLORS.muted} /></button>
        <div style={styles.eyebrow}>STATISTICS</div>
      </div>
      <h1 style={{ ...styles.h1, fontSize: 30, marginTop: 4 }}>
        {fmtHours(grandTotal)} <span style={{ color: COLORS.muted, fontSize: 15, fontFamily: "Inter, sans-serif", fontWeight: 400 }}>total logged</span>
      </h1>
      <div style={{ marginTop: 28 }}>
        <div style={styles.sectionLabel}>Last 7 days</div>
        <div style={styles.dayBars}>
          {last7.map((d, i) => (
            <div key={i} style={styles.dayBarCol}>
              <div style={styles.dayBarTrack}><div style={{ ...styles.dayBarFill, height: `${(d.secs / maxDay) * 100}%` }} /></div>
              <div style={styles.dayBarLabel}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 32, flex: 1 }}>
        <div style={styles.sectionLabel}>By subject</div>
        {totals.length === 0 && <div style={styles.subjectMeta}>No sessions logged yet.</div>}
        {totals.map((s) => {
          const { Icon, color } = iconFor(s.name);
          return (
            <div key={s.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={14} color={color} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.text }}>{s.name}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.muted }}>{fmtHours(s.total)} · {s.sessions} sess.</span>
              </div>
              <div style={styles.hBarTrack}><div style={{ ...styles.hBarFill, width: `${(s.total / maxTotal) * 100}%`, background: color }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StreakScreen({ streak, maxStreak, startDate, datesSet, onBack }) {
  const nextMilestone = MILESTONES.find((m) => m > streak) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= streak) || 0;
  const progressPct = nextMilestone === prevMilestone ? 100 : Math.min(100, ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100);
  const daysToGo = Math.max(0, nextMilestone - streak);

  const monday = getMonday(new Date());
  const weekDays = [...Array(7)].map((_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { date: d, key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3).toUpperCase(), isToday: todayKey(d) === todayKey(new Date()) };
  });

  return (
    <div style={styles.screen}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button style={styles.backBtn} onClick={onBack} aria-label="Back"><ArrowLeft size={20} color={COLORS.muted} /></button>
        <div style={styles.eyebrow}>DAY STREAK</div>
      </div>

      <div style={styles.streakHero}>
        <div style={styles.streakFlameWrap}><Flame size={64} color={FLAME} fill={FLAME} /></div>
        <div style={styles.streakBigNum}>{streak}</div>
        <div style={styles.streakBigLabel}>DAY STREAK</div>
      </div>

      <div style={styles.streakStatsRow}>
        <div>
          <div style={styles.streakStatNum}>{startDate ? new Date(startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
          <div style={styles.streakStatLabel}>Streak started</div>
        </div>
        <div style={styles.streakDivider} />
        <div>
          <div style={styles.streakStatNum}>{maxStreak}</div>
          <div style={styles.streakStatLabel}>Max streak</div>
        </div>
      </div>

      <div style={styles.streakCard}>
        <div style={styles.sectionLabel}>THIS WEEK</div>
        <div style={styles.weekRow}>
          {weekDays.map((d) => (
            <div key={d.key} style={styles.weekCol}>
              <div style={{ ...styles.weekDayLabel, color: d.isToday ? COLORS.text : COLORS.muted, fontWeight: d.isToday ? 700 : 500 }}>{d.label}</div>
              {datesSet.has(d.key) ? <Flame size={22} color={FLAME} fill={FLAME} /> : <div style={styles.weekDot} />}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.streakCard}>
        <div style={styles.milestoneRow}>
          <div style={styles.milestoneCircleActive}><Flame size={18} color={FLAME} fill={FLAME} /><span>{prevMilestone}</span></div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={styles.milestoneText}>{daysToGo > 0 ? `${daysToGo} more day${daysToGo !== 1 ? "s" : ""}` : "Milestone reached!"}</div>
            <div style={styles.milestoneSub}>to unlock your next milestone.</div>
            <div style={styles.milestoneTrack}><div style={{ ...styles.milestoneFill, width: `${progressPct}%` }} /></div>
          </div>
          <div style={styles.milestoneCircleFuture}><Flame size={18} color={COLORS.muted} /><span>{nextMilestone}</span></div>
        </div>
      </div>
    </div>
  );
}

const fontImports = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
  @keyframes ringFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;

const styles = {
  app: { minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "Inter, sans-serif", display: "flex", justifyContent: "center", position: "relative" },
  loadingScreen: { minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" },
  loadingDot: { width: 10, height: 10, borderRadius: "50%", background: COLORS.highlight, animation: "pulse 1s ease-in-out infinite" },
  screen: { width: "100%", maxWidth: 420, minHeight: "100vh", padding: "28px 22px 28px", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  eyebrow: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: COLORS.muted, textTransform: "uppercase" },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 36, lineHeight: 1.15, margin: "10px 0 0", color: COLORS.text },
  sub: { fontSize: 14.5, lineHeight: 1.6, color: COLORS.muted, marginTop: 14, maxWidth: 340 },
  inputRow: { display: "flex", gap: 8, marginTop: 4 },
  input: { flex: 1, background: COLORS.card, border: "1px solid #2E2E32", borderRadius: 10, padding: "13px 14px", color: COLORS.text, fontFamily: "Inter, sans-serif", fontSize: 15, outline: "none" },
  iconBtn: { background: COLORS.highlight, border: "none", borderRadius: 10, width: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: { display: "flex", alignItems: "center", gap: 6, background: COLORS.card, border: "1px solid", borderRadius: 20, padding: "6px 10px", fontSize: 13, color: COLORS.text },
  chipX: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 },
  primaryBtn: { background: COLORS.highlight, border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: COLORS.bg, cursor: "pointer" },
  homeHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  streakBox: { width: 64, height: 64, background: COLORS.card, border: "1px solid #2E2E32", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4 },
  streakBoxNum: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text },
  statsPillFull: { marginTop: 16, background: COLORS.card, border: "1px solid #2E2E32", borderRadius: 14, display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", color: COLORS.text },
  subjectList: { marginTop: 22, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  subjectCard: { display: "flex", alignItems: "center", gap: 14, background: COLORS.card, border: "1px solid #2E2E32", borderRadius: 14, padding: "14px 14px", cursor: "pointer" },
  subjectIconWrap: { width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  subjectName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: COLORS.text },
  subjectMeta: { fontSize: 12.5, color: COLORS.muted, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" },
  trashBtn: { background: "none", border: "none", cursor: "pointer", padding: 6 },
  addSubjectBtn: { marginTop: 16, background: "none", border: "1px dashed #333336", borderRadius: 12, padding: "13px", color: COLORS.highlight, fontFamily: "Inter, sans-serif", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" },
  backBtn: { background: "none", border: "none", cursor: "pointer", padding: 4 },
  timerLabel: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 20, color: COLORS.text },
  ringWrap: { position: "relative", width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" },
  timerDigits: { fontFamily: "'JetBrains Mono', monospace", fontSize: 38, fontWeight: 700, color: COLORS.text, letterSpacing: "0.02em" },
  finishBtn: { width: "100%", background: COLORS.highlight, border: "none", borderRadius: 14, padding: "17px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: COLORS.bg, cursor: "pointer" },
  sectionLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.1em", color: COLORS.muted, textTransform: "uppercase", marginBottom: 12 },
  dayBars: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 90, gap: 8 },
  dayBarCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 },
  dayBarTrack: { width: "100%", height: 64, background: COLORS.card, borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" },
  dayBarFill: { width: "100%", background: COLORS.highlight, borderRadius: "6px 6px 0 0", minHeight: 2 },
  dayBarLabel: { fontSize: 11, color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace" },
  hBarTrack: { height: 6, background: COLORS.card, borderRadius: 4, overflow: "hidden" },
  hBarFill: { height: "100%", borderRadius: 4 },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 },
  modalCard: { background: COLORS.card, borderRadius: 16, padding: "22px 20px", maxWidth: 340, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" },
  modalText: { fontFamily: "Inter, sans-serif", fontSize: 15, lineHeight: 1.5, color: COLORS.text, marginBottom: 18 },
  modalBtnRow: { display: "flex", gap: 10 },
  modalBtnNo: { flex: 1, background: "transparent", border: "1px solid #3A3A3E", borderRadius: 10, padding: "11px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: COLORS.text, cursor: "pointer" },
  modalBtnYes: { flex: 1, background: COLORS.highlight, border: "none", borderRadius: 10, padding: "11px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: COLORS.bg, cursor: "pointer" },
  sheetOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "transparent", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheetBar: { width: "100%", maxWidth: 420, background: COLORS.card, borderRadius: "20px 20px 0 0", padding: "10px 20px 26px", boxSizing: "border-box", animation: "sheetUp 0.25s ease-out", boxShadow: "0 -10px 30px rgba(0,0,0,0.3)" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, background: "#3A3A3E", margin: "0 auto 16px" },
  sheetText: { fontFamily: "Inter, sans-serif", fontSize: 15, color: COLORS.text, textAlign: "center", marginBottom: 16, lineHeight: 1.5 },
  sheetContinueBtn: { width: "100%", background: COLORS.highlight, border: "none", borderRadius: 14, padding: "16px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "-0.5px", color: COLORS.bg, cursor: "pointer", marginBottom: 8 },
  sheetCancelBtn: { width: "100%", background: "none", border: "none", padding: "14px", fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.muted, cursor: "pointer" },
  sheetDiscardBtn: { width: "100%", background: "none", border: "none", padding: "14px", fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.muted, cursor: "pointer", marginTop: 2 },
  streakHero: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 20 },
  streakFlameWrap: { width: 100, height: 100, borderRadius: "50%", background: `${FLAME}18`, display: "flex", alignItems: "center", justifyContent: "center" },
  streakBigNum: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 56, marginTop: 14, color: COLORS.text },
  streakBigLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.12em", color: COLORS.muted, marginTop: 2 },
  streakStatsRow: { display: "flex", alignItems: "center", justifyContent: "space-around", marginTop: 28, marginBottom: 24 },
  streakStatNum: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, textAlign: "center" },
  streakStatLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.muted, marginTop: 4, textAlign: "center" },
  streakDivider: { width: 1, height: 30, background: "#2E2E32" },
  streakCard: { background: COLORS.card, borderRadius: 16, padding: "18px 16px", marginBottom: 14 },
  weekRow: { display: "flex", justifyContent: "space-between" },
  weekCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 },
  weekDayLabel: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 },
  weekDot: { width: 22, height: 22, borderRadius: "50%", border: "1.5px dashed #3A3A3E" },
  milestoneRow: { display: "flex", alignItems: "center", gap: 12 },
  milestoneCircleActive: { width: 50, height: 50, borderRadius: "50%", background: COLORS.card, border: `2px solid ${FLAME}`, boxShadow: `0 0 12px ${FLAME}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 2 },
  milestoneCircleFuture: { width: 50, height: 50, borderRadius: "50%", border: "1.5px solid #3A3A3E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 2 },
  milestoneText: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: COLORS.text },
  milestoneSub: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  milestoneTrack: { height: 5, background: COLORS.bg, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  milestoneFill: { height: "100%", background: FLAME, borderRadius: 4 },
};
