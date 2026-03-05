import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle2, ChevronRight, Send } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import '../styles/Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * EXAM FLOW:
 *  1. Admin starts exam  → isExamStarted = true in DB
 *  2. Students immediately see questions + countdown timer
 *  3. Timer counts down from examDuration minutes
 *  4. When timer hits 0, server returns isExamStarted = false → "Exam Ended" screen
 *  5. Admin can stop the exam early at any time
 */

const Dashboard = () => {
    const { user } = useAuth();

    const [examStarted, setExamStarted] = useState(false);
    const [examTimeLeft, setExamTimeLeft] = useState(0);  // seconds
    const [examEnded, setExamEnded] = useState(false);

    const [questions, setQuestions] = useState([]);
    const [userSubmissions, setUserSubmissions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [currentView, setCurrentView] = useState('missions');
    const [isCompleted, setIsCompleted] = useState(false);

    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [isCorrect, setIsCorrect] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Use a ref to track if questions have been successfully loaded
    // Prevents duplicate fetches across multiple poll cycles
    const didFetchQuestions = useRef(false);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmt = (s) => {
        const sec = Math.max(0, s);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const ss = sec % 60;
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${ss < 10 ? '0' + ss : ss}`;
    };

    // ── Load questions from server ────────────────────────────────────────────
    const loadQuestions = useCallback(async () => {
        if (didFetchQuestions.current) return;       // already loaded
        try {
            const res = await axios.get(`${API_URL}/api/questions`);
            if (res.data && res.data.length > 0) {
                setQuestions(res.data);
                didFetchQuestions.current = true;    // mark success
            }
            // If empty (no questions in DB yet), didFetch stays false → will retry
        } catch (err) {
            console.error('loadQuestions error:', err.response?.status, err.message);
            // Do NOT mark as fetched → will retry on next poll
        }
    }, []);

    // ── Load user submissions ─────────────────────────────────────────────────
    const loadSubmissions = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/auth/me`);
            setUserSubmissions(res.data?.submissions || []);
            setIsCompleted(res.data?.isCompleted || false);
        } catch { /* silent */ }
    }, []);

    // ── Main poll: checks exam status from server every 3 seconds ─────────────
    const pollExamStatus = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/settings`);
            const data = res.data;

            if (!data.isExamStarted) {
                // Exam not running (either never started or auto-ended)
                if (examStarted) {
                    // Was running → now ended
                    setExamEnded(true);
                }
                setExamStarted(false);
                setExamTimeLeft(0);

                // Reset for next exam
                didFetchQuestions.current = false;
                setQuestions([]);
            } else {
                // Exam IS running
                setExamStarted(true);
                setExamEnded(false);
                setExamTimeLeft(data.examTimeLeft || 0);

                // Immediately load questions
                await loadQuestions();
            }
        } catch (err) {
            // Network error — keep current state, don't reset
            console.error('pollExamStatus error:', err.message);
        } finally {
            setLoading(false);
        }
    }, [examStarted, loadQuestions]);

    // ── Tick local timer every second (smooth countdown) ─────────────────────
    useEffect(() => {
        const tick = setInterval(() => {
            setExamTimeLeft(t => Math.max(0, t - 1));
        }, 1000);
        return () => clearInterval(tick);
    }, []);

    // ── Start polling on mount ────────────────────────────────────────────────
    useEffect(() => {
        pollExamStatus();
        loadSubmissions();
        const pollId = setInterval(pollExamStatus, 3000);
        const subId = setInterval(loadSubmissions, 10000);
        return () => {
            clearInterval(pollId);
            clearInterval(subId);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // ^ intentionally empty deps — pollExamStatus is stable via useCallback

    // ── Sync editor when question is FIRST selected (do not re-run on submission polls) ──
    const lastInitializedQuestion = useRef(null);
    useEffect(() => {
        if (!selectedQuestion) return;
        // Only initialize code when the question actually changes (not on submission update)
        if (lastInitializedQuestion.current === selectedQuestion._id) return;
        lastInitializedQuestion.current = selectedQuestion._id;

        const sub = userSubmissions.find(s => s.questionId === selectedQuestion._id);
        setCode(sub?.code || selectedQuestion.buggyCode || '');
        setOutput(sub?.output || '');
        setIsCorrect(sub?.isCorrect ?? null);
    }, [selectedQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Update result badge when submissions refresh (WITHOUT touching code) ────
    useEffect(() => {
        if (!selectedQuestion) return;
        const sub = userSubmissions.find(s => s.questionId === selectedQuestion._id);
        if (!sub) return;
        // Only update result/output, never overwrite what the student typed
        setOutput(prev => sub.output || prev);
        setIsCorrect(sub.isCorrect ?? null);
    }, [userSubmissions]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSaveProgress = async () => {
        // Guard: student must actually edit the code (not just fill the output)
        if (code.trim() === (selectedQuestion?.buggyCode || '').trim()) {
            alert('⚠ VERIFICATION_BLOCKED: You must fix the buggy code in the editor before submitting. Do not leave it unchanged.');
            return;
        }
        if (!code.trim()) { alert('⚠ VERIFICATION_BLOCKED: Code editor is empty. Write the corrected code first.'); return; }
        if (!output.trim()) { alert('Please paste the output of your code in the Verification Terminal first.'); return; }
        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/api/questions/submit-answer`, {
                questionId: selectedQuestion._id, code, output
            });
            setIsCorrect(res.data.isCorrect);
            await loadSubmissions();
            alert(res.data.isCorrect
                ? '✅ SIGNAL_VERIFIED: Correct answer recorded!'
                : '❌ VERIFICATION_FAILED: Output does not match. Try again.');
        } catch { alert('SYSTEM_ERROR: Could not save. Check your connection.'); }
        finally { setIsSubmitting(false); }
    };

    const handleNextMission = () => {
        const idx = questions.findIndex(q => q._id === selectedQuestion._id);
        if (idx < questions.length - 1) setSelectedQuestion(questions[idx + 1]);
    };

    const handleFinalize = async () => {
        if (!window.confirm('CRITICAL: Finalize all missions? This action is permanent.')) return;
        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/questions/submit`);
            setIsCompleted(true);
            alert('MISSION_COMPLETE: All data finalized.');
        } catch { alert('SYSTEM_ERROR: Finalization failed.'); }
        finally { setIsSubmitting(false); }
    };

    // ── Loading spinner ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, border: '4px solid var(--primary-neon)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
        );
    }

    // ── Screen: Exam not started ───────────────────────────────────────────────
    if (!examStarted && !examEnded) {
        return (
            <div className="dashboard-container">
                <header className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
                    {/* ── Top bar: logo + logout ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="header-logo">
                            <BookOpen size={18} className="logo-icon" />
                            <span className="logo-text" style={{ fontSize: 11 }}>ARC_ESCAPE_CODE</span>
                        </div>
                        <LogoutButton />
                    </div>
                    {/* ── Student identity banner ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', background: 'rgba(0,255,162,0.04)' }}>
                        <div style={{ width: 9, height: 9, background: 'var(--primary-neon)', borderRadius: '50%', boxShadow: '0 0 8px var(--primary-neon)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>{user?.name || '—'}</p>
                            <p style={{ fontSize: 9, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{user?.collegeName || ''}{user?.participationType === 'team' ? ' · Team Mission' : ' · Solo Mission'}</p>
                            {user?.participationType === 'team' && user?.teamMembers?.length > 0 && (
                                <p style={{ fontSize: 9, color: 'var(--primary-neon)', opacity: 0.7, marginTop: 2 }}>⚡ {user.teamMembers.join(', ')}</p>
                            )}
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary-neon)', opacity: 0.6 }}>OPERATIVE_STANDBY</span>
                    </div>
                </header>
                <main className="dashboard-main">
                    <div className="h-full w-full flex flex-col items-center justify-center p-12 text-center">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="bg-card p-12 rounded-3xl border border-glass-border glass-morph max-w-2xl">
                            {/* User greeting */}
                            <div style={{ marginBottom: 28, padding: '12px 16px', background: 'rgba(0,255,162,0.05)', border: '1px solid rgba(0,255,162,0.15)', borderRadius: 14, textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    <div style={{ width: 7, height: 7, background: 'var(--primary-neon)', borderRadius: '50%', boxShadow: '0 0 6px var(--primary-neon)', animation: 'pulse 2s infinite' }} />
                                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary-neon)' }}>Operative Identified</span>
                                </div>
                                <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{user?.name || '—'}</p>
                                <p style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{user?.collegeName || 'Unknown Base'}</p>
                                {user?.participationType === 'team' && user?.teamMembers?.length > 0 && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <p style={{ fontSize: 9, color: 'var(--primary-neon)', fontWeight: 900, marginBottom: 4, textTransform: 'uppercase' }}>⚡ Team Members</p>
                                        <p style={{ fontSize: 10, opacity: 0.5 }}>{user.teamMembers.join(', ')}</p>
                                    </div>
                                )}
                            </div>

                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto border border-primary/20">
                                <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-neon" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-widest text-white mb-4">Awaiting Mission Briefing</h1>
                            <p style={{ color: 'var(--text-dim)', opacity: 0.7, marginBottom: 32, textTransform: 'uppercase', fontSize: 12, letterSpacing: 2 }}>
                                Connection established. Standby for HQ deployment signal.
                            </p>
                            <div className="flex items-center justify-center gap-4">
                                <div className="h-[1px] w-12 bg-white/10" />
                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--primary-neon)', animation: 'pulse 2s infinite' }}>LISTENING_FOR_START_SIGNAL</span>
                                <div className="h-[1px] w-12 bg-white/10" />
                            </div>
                        </motion.div>
                    </div>
                </main>
            </div>
        );
    }

    // ── Screen: Exam ended ────────────────────────────────────────────────────
    if (examEnded && !examStarted) {
        return (
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="header-logo">
                        <BookOpen size={24} className="logo-icon" />
                        <span className="logo-text">ARC_ESCAPE_CODE</span>
                    </div>
                    <div className="header-controls"><LogoutButton /></div>
                </header>
                <main className="dashboard-main">
                    <div className="accomplished-overlay" style={{ width: '100%' }}>
                        <CheckCircle2 size={80} className="accomplished-icon" />
                        <h1 className="problem-title">Exam Ended</h1>
                        <p className="accomplished-subtitle">Time is up. Mission data transmitted to HQ.</p>
                    </div>
                </main>
            </div>
        );
    }

    // ── Screen: Student finalized early ────────────────────────────────────────
    if (isCompleted) {
        return (
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div className="header-logo">
                        <BookOpen size={24} className="logo-icon" />
                        <span className="logo-text">ARC_ESCAPE_CODE</span>
                    </div>
                    <div className="header-controls"><LogoutButton /></div>
                </header>
                <main className="dashboard-main">
                    <div className="accomplished-overlay" style={{ width: '100%' }}>
                        <CheckCircle2 size={80} className="accomplished-icon" />
                        <h1 className="problem-title">Mission Accomplished</h1>
                        <p className="accomplished-subtitle">All encryption layers bypassed. Well done, operative.</p>
                    </div>
                </main>
            </div>
        );
    }

    // ── Screen: Active exam ────────────────────────────────────────────────────

    const renderDeployments = () => (
        <div style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#fff', marginBottom: '2rem' }}>Deployment Overview</h1>
            <div style={{ display: 'grid', gap: '1rem' }}>
                {questions.length === 0 ? (
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>No missions deployed yet.</p>
                ) : questions.map((q, idx) => {
                    const sub = userSubmissions.find(s => s.questionId === q._id);
                    return (
                        <div key={q._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--primary-neon)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>MISSION_0{idx + 1}</span>
                                <h3 style={{ fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', color: '#fff' }}>{q.title}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 12px', borderRadius: 20, border: '1px solid', borderColor: sub?.isCorrect ? 'rgba(34,197,94,0.4)' : 'rgba(234,179,8,0.4)', color: sub?.isCorrect ? '#4ade80' : '#facc15', background: sub?.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)' }}>
                                    {sub?.isCorrect ? 'VERIFIED' : 'PENDING'}
                                </span>
                                <button onClick={() => { setSelectedQuestion(q); setCurrentView('missions'); }}
                                    style={{ background: 'var(--primary-neon)', color: '#000', padding: '8px 20px', borderRadius: 10, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>
                                    ENGAGE
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderMissions = () => {
        const isLow = examTimeLeft > 0 && examTimeLeft <= 300; // under 5 min
        return (
            <>
                <aside className="sidebar">
                    {/* ── Timer block ── */}
                    <div style={{
                        margin: '0 0 16px',
                        padding: '16px 12px',
                        background: isLow ? 'rgba(239,68,68,0.08)' : 'rgba(0,255,162,0.05)',
                        border: `1px solid ${isLow ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,162,0.15)'}`,
                        borderRadius: 16,
                        textAlign: 'center'
                    }}>
                        <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.5, marginBottom: 8, color: isLow ? '#ef4444' : 'var(--primary-neon)' }}>
                            Time Remaining
                        </p>
                        <div style={{
                            fontSize: examTimeLeft >= 3600 ? '1.8rem' : '2.4rem',
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            color: isLow ? '#ef4444' : 'var(--primary-neon)',
                            textShadow: isLow ? '0 0 20px rgba(239,68,68,0.6)' : '0 0 20px var(--primary-glow)',
                            animation: isLow ? 'pulse 1s infinite' : 'none',
                            lineHeight: 1
                        }}>
                            {examTimeLeft > 0 ? fmt(examTimeLeft) : '--:--'}
                        </div>
                        {isLow && (
                            <p style={{ fontSize: 9, color: '#ef4444', textTransform: 'uppercase', marginTop: 6, fontWeight: 900, letterSpacing: '0.1em' }}>⚠ Finalise now</p>
                        )}
                    </div>

                    <h2 className="sidebar-title">Mission Grid</h2>
                    <div className="task-list">
                        {questions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20 }}>
                                <div style={{ width: 8, height: 8, background: 'var(--primary-neon)', borderRadius: '50%', animation: 'pulse 1s infinite', margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Loading missions...</p>
                            </div>
                        ) : questions.map((q, idx) => {
                            const sub = userSubmissions.find(s => s.questionId === q._id);
                            const isSel = selectedQuestion?._id === q._id;
                            return (
                                <div key={q._id} className={`task-item ${isSel ? 'active' : ''}`} onClick={() => setSelectedQuestion(q)}>
                                    <div className="task-item-content">
                                        <div className="task-item-header">
                                            <span className="task-mission-id">MISSION_0{idx + 1}</span>
                                            {sub?.isCorrect && <CheckCircle2 size={12} className="verified-icon" />}
                                        </div>
                                        <span className="task-title-text">{q.title}</span>
                                    </div>
                                    {isSel && <ChevronRight size={16} />}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── User identity card ── */}
                    <div style={{
                        marginTop: 'auto',
                        padding: '12px',
                        background: 'rgba(0,255,162,0.04)',
                        border: '1px solid rgba(0,255,162,0.12)',
                        borderRadius: 14,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 7, height: 7, background: 'var(--primary-neon)', borderRadius: '50%', boxShadow: '0 0 6px var(--primary-neon)', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary-neon)' }}>Operative Online</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                            {user?.name || '—'}
                        </p>
                        <p style={{ fontSize: 9, color: 'var(--text-dim)', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 0 }}>
                            {user?.collegeName || 'Unknown Base'}
                        </p>
                        {user?.participationType === 'team' && (
                            <p style={{ fontSize: 9, color: 'var(--primary-neon)', opacity: 0.8, marginTop: 5, textTransform: 'uppercase', fontWeight: 700 }}>
                                ⚡ Team Mission
                            </p>
                        )}
                    </div>
                </aside>

                <section className="dashboard-content">
                    <div className="content-area">
                        <AnimatePresence mode="wait">
                            {!selectedQuestion ? (
                                /* Mission card grid */
                                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="h-full flex flex-col items-center justify-center p-12">
                                    {questions.length === 0 ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ width: 40, height: 40, border: '3px solid var(--primary-neon)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                                            <p style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 12 }}>Loading missions from HQ...</p>
                                        </div>
                                    ) : (
                                        <div className="selection-grid w-full">
                                            {questions.map((q, idx) => {
                                                const sub = userSubmissions.find(s => s.questionId === q._id);
                                                return (
                                                    <div key={q._id} className="mission-card" onClick={() => setSelectedQuestion(q)}>
                                                        <span className="problem-meta">Mission_0{idx + 1}</span>
                                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', margin: '8px 0 16px' }}>{q.title}</h3>
                                                        <div className="problem-tags">
                                                            <span className="tag tag-difficulty">{q.difficulty}</span>
                                                            <span className="tag tag-marks">{q.marks} Marks</span>
                                                        </div>
                                                        {sub?.isCorrect && <p style={{ color: 'var(--primary-neon)', fontSize: 10, marginTop: 12, fontWeight: 900 }}>✓ VERIFIED</p>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                /* Question detail view */
                                <motion.div key={selectedQuestion._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                    className="h-full flex flex-col">
                                    <div className="problem-header">
                                        <p className="problem-meta">DATA_STREAM // {selectedQuestion._id}</p>
                                        <h1 className="problem-title">{selectedQuestion.title}</h1>
                                        <div className="problem-tags">
                                            <span className="tag tag-difficulty">{selectedQuestion.difficulty}</span>
                                            <span className="tag tag-marks">{selectedQuestion.marks} Marks</span>
                                        </div>
                                    </div>

                                    <div className="problem-body">
                                        <div className="description-box">
                                            <p className="problem-desc">{selectedQuestion.problem}</p>
                                        </div>

                                        {selectedQuestion.note && (
                                            <div style={{
                                                margin: '16px 0',
                                                padding: '12px 16px',
                                                background: 'rgba(251,191,36,0.07)',
                                                border: '1px solid rgba(251,191,36,0.25)',
                                                borderLeft: '3px solid #fbbf24',
                                                borderRadius: '0 12px 12px 0',
                                            }}>
                                                <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#fbbf24', marginBottom: 6 }}>📌 Note</p>
                                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{selectedQuestion.note}</p>
                                            </div>
                                        )}

                                        {selectedQuestion.sampleInput && (
                                            <div style={{
                                                margin: '12px 0 0',
                                                padding: '10px 14px',
                                                background: 'rgba(99,102,241,0.07)',
                                                border: '1px solid rgba(99,102,241,0.2)',
                                                borderLeft: '3px solid #818cf8',
                                                borderRadius: '0 10px 10px 0',
                                            }}>
                                                <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#818cf8', marginBottom: 6 }}>⌨ Sample Input</p>
                                                <pre style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedQuestion.sampleInput}</pre>
                                            </div>
                                        )}

                                        <div className="editor-outer-container mt-8">
                                            <Editor height="100%" theme="vs-dark" language="javascript" value={code}
                                                onChange={v => setCode(v)}
                                                options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 20 } }}
                                            />
                                        </div>
                                    </div>

                                    <div className="action-bar">
                                        <div className="button-group">
                                            <button onClick={handleSaveProgress} disabled={isSubmitting} className="btn-primary">
                                                <Send size={14} style={{ marginRight: 8 }} />
                                                {isSubmitting ? 'UPLOADING...' : 'SAVE_PROGRESS'}
                                            </button>
                                        </div>

                                        <div className="verification-terminal">
                                            <span className="terminal-label">Verification Terminal</span>
                                            <div className="terminal-row">
                                                <input type="text" value={output}
                                                    onChange={e => setOutput(e.target.value)}
                                                    placeholder="Paste your code output here..."
                                                    className="terminal-input" />
                                                <div className={`status-badge ${isCorrect === true ? 'verified' : isCorrect === false ? 'failed' : 'awaiting'}`}>
                                                    {isCorrect === true ? 'VERIFIED' : isCorrect === false ? 'FAILED' : 'AWAITING'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mission-controls">
                                            {questions.findIndex(q => q._id === selectedQuestion._id) < questions.length - 1 ? (
                                                <button onClick={handleNextMission} className="btn-next">
                                                    Next <ChevronRight size={18} />
                                                </button>
                                            ) : (
                                                <button onClick={handleFinalize} disabled={isSubmitting} className="btn-finalize">
                                                    Finalize
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </>
        );
    };
    return (
        <div className="dashboard-container">
            <header className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
                {/* ── Top bar: controls ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="header-logo">
                        <BookOpen size={16} className="logo-icon" />
                        <span className="logo-text" style={{ fontSize: 10 }}>DNA DECODE</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {examTimeLeft > 0 && (
                            <div className="status-header-pill" style={{ borderColor: examTimeLeft <= 300 ? 'rgba(239,68,68,0.4)' : undefined, background: examTimeLeft <= 300 ? 'rgba(239,68,68,0.1)' : undefined }}>
                                <span className="pill-label" style={{ color: examTimeLeft <= 300 ? '#ef4444' : undefined }}>TIME_REMAINING</span>
                                <span className="pill-value" style={{ color: examTimeLeft <= 300 ? '#ef4444' : undefined, animation: examTimeLeft <= 300 ? 'pulse 1s infinite' : 'none' }}>{fmt(examTimeLeft)}</span>
                            </div>
                        )}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                            <button onClick={() => setCurrentView('missions')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all rounded-lg ${currentView === 'missions' ? 'bg-primary text-black shadow-neon' : 'text-dim hover:text-white'}`}>
                                Missions
                            </button>
                            <button onClick={() => setCurrentView('deployments')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all rounded-lg ${currentView === 'deployments' ? 'bg-primary text-black shadow-neon' : 'text-dim hover:text-white'}`}>
                                Deployments
                            </button>
                        </div>
                        <LogoutButton />
                    </div>
                </div>
                {/* ── Student identity banner ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', background: 'rgba(0,255,162,0.04)', borderBottom: '1px solid rgba(0,255,162,0.08)' }}>
                    <div style={{ width: 9, height: 9, background: 'var(--primary-neon)', borderRadius: '50%', boxShadow: '0 0 8px var(--primary-neon)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>{user?.name || '—'}</p>
                        <p style={{ fontSize: 9, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                            {user?.collegeName || ''}  {user?.participationType === 'team' ? '· Team Mission' : '· Solo Mission'}
                        </p>
                    </div>
                    {user?.participationType === 'team' && user?.teamMembers?.length > 0 && (
                        <span style={{ fontSize: 9, color: 'var(--primary-neon)', fontWeight: 900, opacity: 0.8 }}>⚡ {user.teamMembers.join(', ')}</span>
                    )}
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--primary-neon)', opacity: 0.5 }}>OPERATIVE_ACTIVE</span>
                </div>
            </header>
            <main className="dashboard-main">
                {currentView === 'deployments' ? renderDeployments() : renderMissions()}
            </main>
        </div>
    );
};

export default Dashboard;
