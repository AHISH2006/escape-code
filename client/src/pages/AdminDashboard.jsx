import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Trophy, List, Settings, BarChart3, Database, UserPlus, Users, LogOut, CheckCircle2, BarChart2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalQuestions: 0,
        avgScore: 0
    });
    const [settings, setSettings] = useState({ isExamStarted: false, examDuration: 30, prepDuration: 0, startTime: null });
    const [prepTimeLeft, setPrepTimeLeft] = useState(0);
    const [examTimeLeft, setExamTimeLeft] = useState(0);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showStudents, setShowStudents] = useState(false);
    const [showQuestions, setShowQuestions] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [examReport, setExamReport] = useState(null);
    const [allQuestions, setAllQuestions] = useState([]);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [newQuestion, setNewQuestion] = useState({
        round: 1,
        title: '',
        problem: '',
        buggyCode: '',
        sampleInput: '',
        correctOutput: '',
        marks: 10,
        difficulty: 'medium',
        note: ''
    });

    const { logout } = useAuth();

    const fetchStats = async () => {
        try {
            const adminStatsRes = await axios.get('http://localhost:5000/api/admin/stats');
            const questionsRes = await axios.get('http://localhost:5000/api/questions');

            setStats({
                totalStudents: adminStatsRes.data.totalStudents,
                totalQuestions: questionsRes.data.length,
                avgScore: adminStatsRes.data.avgScore
            });
        } catch (err) {
            console.error("Failed to fetch stats", err);
        }
    };

    const fetchExamReport = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/exam-report');
            setExamReport(res.data);
        } catch (err) {
            console.error('Failed to fetch exam report', err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/settings');
            setSettings(res.data);
        } catch (err) {
            console.error("Failed to fetch settings", err);
        }
    };

    const fetchQuestions = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/questions');
            setAllQuestions(res.data);
        } catch (err) {
            console.error("Failed to fetch questions", err);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/students');
            setStudents(res.data);
        } catch (err) {
            console.error("Failed to fetch students", err);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchSettings();
        fetchStudents();
        fetchQuestions();
        fetchExamReport();
        const statsInterval = setInterval(() => {
            fetchStudents();
            fetchStats();
            fetchSettings();
            fetchExamReport();
        }, 10000);

        const timerInterval = setInterval(() => {
            if (settings.isExamStarted && settings.startTime) {
                const start = new Date(settings.startTime);
                const prepMs = (settings.prepDuration || 0) * 60000;
                const examMs = (settings.examDuration || 30) * 60000;
                const prepEnd = new Date(start.getTime() + prepMs);
                const examEnd = new Date(prepEnd.getTime() + examMs);
                const now = new Date();
                setPrepTimeLeft(Math.max(0, Math.floor((prepEnd - now) / 1000)));
                setExamTimeLeft(Math.max(0, Math.floor((examEnd - now) / 1000)));
            } else {
                setPrepTimeLeft(0);
                setExamTimeLeft(0);
            }
        }, 1000);

        return () => {
            clearInterval(statsInterval);
            clearInterval(timerInterval);
        };
    }, [settings.isExamStarted, settings.startTime, settings.examDuration, settings.prepDuration]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    };

    const toggleExam = async () => {
        const newStatus = !settings.isExamStarted;
        if (!window.confirm(`Are you sure you want to ${newStatus ? 'START' : 'STOP'} the exam?`)) return;

        try {
            const res = await axios.post('http://localhost:5000/api/admin/settings', {
                isExamStarted: newStatus,
                examDuration: settings.examDuration || 30,
                prepDuration: 0
            });
            setSettings(res.data);
        } catch (err) {
            alert('CRITICAL_ERROR: Failed to update synchronization layer.');
        }
    };

    const handleAddOrUpdateQuestion = async (e) => {
        e.preventDefault();
        try {
            if (editingQuestion) {
                await axios.put(`http://localhost:5000/api/questions/${editingQuestion._id}`, newQuestion);
                alert('Challenge updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/questions', newQuestion);
                alert('Challenge deployed into the system!');
            }
            setShowForm(false);
            setEditingQuestion(null);
            setNewQuestion({ round: 1, title: '', problem: '', buggyCode: '', sampleInput: '', correctOutput: '', marks: 10, difficulty: 'medium', note: '' });
            fetchStats();
        } catch (err) {
            alert('Operation failed: ' + (err.response?.data?.message || 'Error'));
        }
    };

    const handleDeleteQuestion = async (id) => {
        if (!window.confirm("ARE_YOU_SURE? THIS_PROCESS_IS_IRREVERSIBLE.")) return;
        try {
            await axios.delete(`http://localhost:5000/api/questions/${id}`);
            fetchQuestions();
            fetchStats();
        } catch (err) {
            alert("DELETION_FAILED: DATABASE_ACCESS_DENIED");
        }
    };

    const handleDeleteStudent = async (id, name) => {
        if (!window.confirm(`PURGE STUDENT: "${name}"? This will permanently delete all their data.`)) return;
        try {
            await axios.delete(`http://localhost:5000/api/admin/students/${id}`);
            setStudents(prev => prev.filter(s => s._id !== id));
            if (selectedStudent?._id === id) setSelectedStudent(null);
            fetchStats();
        } catch (err) {
            alert("DELETION_FAILED: " + (err.response?.data?.message || 'Server error'));
        }
    };

    const handleEditClick = (q) => {
        setEditingQuestion(q);
        setNewQuestion({
            round: q.round,
            title: q.title,
            problem: q.problem,
            buggyCode: q.buggyCode,
            sampleInput: q.sampleInput || '',
            correctOutput: q.correctOutput,
            marks: q.marks,
            difficulty: q.difficulty,
            note: q.note || ''
        });
        setShowForm(true);
        // Scroll to form
        window.scrollTo({ top: document.querySelector('.question-form-container')?.offsetTop - 100, behavior: 'smooth' });
    };

    return (
        <div className="admin-container">
            <header className="p-4 bg-glass backdrop-blur-md border-b border-glass-border flex justify-between items-center px-4 md:px-12 z-50 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg shadow-neon">
                        <Settings size={20} className="text-black" />
                    </div>
                    <h2 className="uppercase font-black tracking-widest text-white text-sm md:text-base">Command Center</h2>
                </div>
                <div className="flex items-center gap-6">
                    {settings.isExamStarted && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: examTimeLeft > 0 && examTimeLeft <= 300 ? 'rgba(239,68,68,0.1)' : 'rgba(0,255,162,0.08)',
                            border: `1px solid ${examTimeLeft > 0 && examTimeLeft <= 300 ? 'rgba(239,68,68,0.35)' : 'rgba(0,255,162,0.25)'}`,
                            padding: '8px 16px', borderRadius: 12
                        }}>
                            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: examTimeLeft > 0 && examTimeLeft <= 300 ? '#ef4444' : 'var(--primary-neon)', animation: examTimeLeft > 0 && examTimeLeft <= 300 ? 'pulse 1s infinite' : 'none' }}>
                                {examTimeLeft > 0 && examTimeLeft <= 300 ? '⚠ Critical' : '● Exam Live'}
                            </span>
                            <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 900, color: examTimeLeft > 0 && examTimeLeft <= 300 ? '#ef4444' : '#fff' }}>
                                {examTimeLeft > 0 ? formatTime(examTimeLeft) : '--:--'}
                            </span>
                        </div>
                    )}
                    <div className="hidden sm:flex flex-col items-end border-r pr-4 border-white/10 text-white">
                        <span className="text-[10px] font-black uppercase text-primary tracking-tighter leading-none mb-1">Root_Admin</span>
                        <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">System_Override_Enabled</span>
                    </div>
                    <LogoutButton />
                </div>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-content"
            >
                <div className="stats-grid">
                    <div className="stat-card">
                        <p className="stat-label">Active Recruits</p>
                        <p className="stat-value">{stats.totalStudents}</p>
                    </div>
                    <div className="stat-card">
                        <p className="stat-label">Deployments</p>
                        <p className="stat-value">{stats.totalQuestions}</p>
                    </div>
                    <div className="stat-card">
                        <p className="stat-label">Avg Proficiency</p>
                        <p className="stat-value">{Math.round(stats.avgScore)}</p>
                    </div>
                </div>

                <div className="admin-menu-grid">
                    <div className="menu-card" onClick={() => setShowForm(!showForm)}>
                        <div className="menu-icon-wrapper">
                            <Database size={32} />
                        </div>
                        <div className="menu-info">
                            <h2>Deploy Challenge</h2>
                            <p>{showForm ? 'Abort Deployment' : 'Inject new code challenge'}</p>
                        </div>
                    </div>

                    <div className="menu-card" onClick={() => setShowStudents(!showStudents)}>
                        <div className="menu-icon-wrapper">
                            <Users size={32} />
                        </div>
                        <div className="menu-info">
                            <h2>Recruit Intel</h2>
                            <p>Detailed login & progress monitoring.</p>
                        </div>
                    </div>

                    <div className="menu-card" onClick={() => setShowQuestions(!showQuestions)}>
                        <div className="menu-icon-wrapper">
                            <List size={32} />
                        </div>
                        <div className="menu-info">
                            <h2>Manage Deployments</h2>
                            <p>View, edit or purge active missions.</p>
                        </div>
                    </div>

                    {/* ── Exam Report Card ── */}
                    <div className="menu-card" onClick={() => setShowReport(!showReport)}>
                        <div className="menu-icon-wrapper">
                            <BarChart2 size={32} />
                        </div>
                        <div className="menu-info">
                            <h2>Exam Report</h2>
                            <p>Attendance, attempts & question stats.</p>
                        </div>
                    </div>

                    {/* ── Exam Control Panel ── */}
                    <div className="menu-card" style={{ cursor: 'default' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '100%', padding: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Settings size={18} style={{ color: 'var(--primary-neon)' }} />
                                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary-neon)' }}>Mission Parameters</span>
                            </div>

                            {!settings.isExamStarted && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, marginBottom: 6 }}>Exam Duration (min)</label>
                                        <input type="number" value={settings.examDuration || 30}
                                            onChange={e => setSettings({ ...settings, examDuration: parseInt(e.target.value) || 30 })}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,162,0.15)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontFamily: 'monospace', fontSize: 13 }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, marginBottom: 6 }}>Prep Wait (min)</label>
                                        <input type="number" value={settings.prepDuration ?? 0}
                                            onChange={e => setSettings({ ...settings, prepDuration: parseInt(e.target.value) ?? 0 })}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,162,0.15)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontFamily: 'monospace', fontSize: 13 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {settings.isExamStarted && (
                                <div style={{ marginBottom: 16 }}>
                                    {/* Exam countdown — same style as student dashboard */}
                                    <div style={{
                                        padding: '14px 12px',
                                        background: examTimeLeft > 0 && examTimeLeft <= 300 ? 'rgba(239,68,68,0.08)' : 'rgba(0,255,162,0.05)',
                                        border: `1px solid ${examTimeLeft > 0 && examTimeLeft <= 300 ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,162,0.15)'}`,
                                        borderRadius: 14, textAlign: 'center'
                                    }}>
                                        <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.55, marginBottom: 6, color: examTimeLeft > 0 && examTimeLeft <= 300 ? '#ef4444' : 'var(--primary-neon)' }}>
                                            Exam Time Remaining
                                        </p>
                                        <div style={{
                                            fontSize: '2rem', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
                                            color: examTimeLeft > 0 && examTimeLeft <= 300 ? '#ef4444' : 'var(--primary-neon)',
                                            textShadow: examTimeLeft > 0 && examTimeLeft <= 300 ? '0 0 20px rgba(239,68,68,0.6)' : '0 0 20px var(--primary-glow)',
                                            animation: examTimeLeft > 0 && examTimeLeft <= 300 ? 'pulse 1s infinite' : 'none'
                                        }}>
                                            {examTimeLeft > 0 ? formatTime(examTimeLeft) : '00:00'}
                                        </div>
                                        {examTimeLeft > 0 && examTimeLeft <= 300 && (
                                            <p style={{ fontSize: 9, color: '#ef4444', textTransform: 'uppercase', marginTop: 6, fontWeight: 900 }}>⚠ Less than 5 min left</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button onClick={toggleExam}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: 'pointer', transition: 'all 0.3s',
                                    background: settings.isExamStarted ? 'rgba(239,68,68,0.2)' : 'var(--primary-neon)',
                                    color: settings.isExamStarted ? '#ef4444' : '#000',
                                    boxShadow: settings.isExamStarted ? '0 0 20px rgba(239,68,68,0.2)' : '0 0 20px var(--primary-glow)'
                                }}>
                                {settings.isExamStarted ? '⏹ Stop Exam' : '▶ Start Exam'}
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {showQuestions && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-card p-6 rounded-3xl border border-glass-border mt-8 overflow-hidden glass-morph"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="uppercase font-black text-white tracking-widest">Active Deployments</h3>
                                <button
                                    onClick={fetchQuestions}
                                    className="text-[10px] border border-glass-border px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all font-bold opacity-50 hover:opacity-100"
                                >
                                    REFRESH_DATA
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-glass-border uppercase text-[10px] text-dim opacity-50">
                                            <th className="p-3">Round</th>
                                            <th className="p-3">Challenge Intel</th>
                                            <th className="p-3">Specs</th>
                                            <th className="p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allQuestions.map(q => (
                                            <tr key={q._id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                                                <td className="p-3">
                                                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-mono font-bold text-xs border border-primary/30">
                                                        R{q.round}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-white text-sm">{q.title}</div>
                                                    <div className="text-[10px] opacity-50 truncate max-w-[300px] italic">{q.problem}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded font-bold">{q.marks}U</span>
                                                        <span className={`text-[10px] font-black uppercase ${q.difficulty === 'hard' ? 'text-error' : q.difficulty === 'medium' ? 'text-yellow-400' : 'text-success'}`}>
                                                            {q.difficulty}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handleEditClick(q)}
                                                            className="text-[10px] bg-primary text-black px-3 py-1.5 rounded-lg font-black hover:scale-105 transition-all shadow-neon"
                                                        >
                                                            RE_ENGAGE
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteQuestion(q._id)}
                                                            className="text-[10px] bg-red-900/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg font-black hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            PURGE
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                    {showStudents && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card p-8 rounded-3xl border border-glass-border mt-8 overflow-hidden glass-morph shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                                <h3 className="uppercase font-black text-white tracking-[0.2em] text-lg">Recruit Intelligence Feed</h3>
                                <div className="text-[10px] font-mono opacity-50 bg-white/5 px-3 py-1 rounded-full uppercase">
                                    Live_Monitoring_Active
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b uppercase text-[10px] tracking-widest opacity-50 text-dim">
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Credentials</th>
                                            <th className="p-4">Recruit Info</th>
                                            <th className="p-4">Joined / Last Act.</th>
                                            <th className="p-4 text-center">Duration</th>
                                            <th className="p-4 text-center">Score</th>
                                            <th className="p-4 text-center">Missions</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(s => (
                                            <tr key={s._id} className="border-b border-white/5 text-sm hover:bg-white/2 transition-colors">
                                                <td className="p-4">
                                                    <div className="relative group">
                                                        <span className={`inline-block w-3 h-3 rounded-full border-2 border-black/50 ${s.isOnline ? 'bg-green-500 shadow-neon-green animate-pulse' : 'bg-gray-600'}`}></span>
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 bg-black text-[8px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/10 uppercase font-black">
                                                            {s.isOnline ? 'Active_Signal' : 'Signal_Offline'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-black text-white text-base tracking-tight leading-none mb-1">{s.name}</div>
                                                    <div className="text-[10px] text-primary/80 uppercase font-black tracking-widest flex items-center gap-1">
                                                        <span className="opacity-40 font-mono">SOURCE//</span> {s.collegeName || 'CORRUPTED_SOURCE'}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className={`text-[10px] px-3 py-1 rounded-full inline-block font-black tracking-widest border ${s.participationType === 'team' ? 'bg-purple-900/40 border-purple-500/30 text-purple-400' : 'bg-blue-900/40 border-blue-500/30 text-blue-400'}`}>
                                                        {s.participationType?.toUpperCase() || 'SINGLE'}
                                                    </div>
                                                    {s.participationType === 'team' && (
                                                        <div className="mt-2 pl-2 border-l-2 border-white/5">
                                                            <div className="text-[10px] font-black text-accent uppercase">ID: {s.teamName}</div>
                                                            <div className="text-[8px] opacity-50 font-mono">NODES: {s.teamMembers?.join(', ')}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-[10px] font-mono text-dim opacity-70">
                                                        <span className="text-white/40">J:</span> {new Date(s.createdAt).toLocaleDateString()}
                                                        <br />
                                                        <span className="text-primary/60 font-black">L:</span> {s.submissions?.length > 0
                                                            ? new Date(s.submissions[s.submissions.length - 1].submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                            : '---'}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {s.isCompleted ? (
                                                        <div className="text-xs font-black text-primary font-mono">
                                                            {Math.floor(s.duration / 60)}m {s.duration % 60}s
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] opacity-20 font-black uppercase">Active</div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className={`text-xl font-black font-mono drop-shadow-neon ${s.isCompleted ? 'text-primary' : 'text-white/80'}`}>{s.score}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className={`inline-flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border ${s.isCompleted ? 'border-primary/50 bg-primary/5' : 'border-white/10'}`}>
                                                        <span className={`text-xs font-black mono ${s.isCompleted ? 'text-primary' : 'text-white'}`}>
                                                            {s.submissions?.filter(sub => sub.isCorrect).length || 0}
                                                        </span>
                                                        <span className="text-[8px] opacity-30 font-black">/</span>
                                                        <span className="text-[10px] opacity-50 font-black">
                                                            {allQuestions.length}
                                                        </span>
                                                        {s.isCompleted && <CheckCircle2 size={10} className="text-primary ml-1" />}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => setSelectedStudent(s)}
                                                            className="text-[10px] bg-white/5 border border-white/10 px-4 py-2 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all uppercase font-black tracking-widest text-white shadow-soft"
                                                        >
                                                            ANALYSIS_LOG
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStudent(s._id, s.name)}
                                                            style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 14px', borderRadius: 12, fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.08em' }}
                                                            onMouseEnter={e => { e.target.style.background = '#ef4444'; e.target.style.color = '#fff'; }}
                                                            onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.15)'; e.target.style.color = '#ef4444'; }}
                                                        >
                                                            PURGE
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && <tr><td colSpan="7" className="text-center p-12 opacity-30 font-black uppercase tracking-[0.3em]">No recruits detected on the grid.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Submission Viewer Modal */}
                <AnimatePresence>
                    {selectedStudent && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-glass-border glass-morph"
                            >
                                <div className="p-6 border-b border-glass-border flex justify-between items-center bg-white/5">
                                    <div>
                                        <h2 className="font-black uppercase tracking-widest text-xl text-white">{selectedStudent.name}</h2>
                                        <p className="text-[10px] opacity-50 uppercase tracking-tighter text-dim">{selectedStudent.collegeName} • {selectedStudent.submissions?.length || 0} OPERATIONS_RECORDED</p>
                                    </div>
                                    <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white">
                                        <LogOut size={20} className="rotate-180" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-6 space-y-8 bg-black/40">
                                    {selectedStudent.submissions?.length > 0 ? (
                                        selectedStudent.submissions.map((sub, idx) => (
                                            <div key={idx} className="bg-white/5 border border-glass-border rounded-xl shadow-sm overflow-hidden">
                                                <div className="p-3 border-b border-glass-border flex justify-between items-center bg-white/5">
                                                    <span className="font-bold text-xs uppercase tracking-widest text-primary">{sub.questionId?.title || 'CORRUPTED_IDENTIFIER'}</span>
                                                    <span className={`text-[10px] px-2 py-1 rounded font-black ${sub.isCorrect ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                        {sub.isCorrect ? 'SUCCESS_AUTHORIZED' : 'FAILURE_DENIED'}
                                                    </span>
                                                </div>
                                                <div className="p-4 bg-black/60 text-green-400 font-mono text-xs overflow-x-auto border-b border-glass-border">
                                                    <pre>{sub.code}</pre>
                                                </div>
                                                <div className="p-3 text-[10px] opacity-50 flex justify-between items-center font-mono">
                                                    <span>OUTPUT: {sub.output || 'NULL'}</span>
                                                    <span>TIMESTAMP: {new Date(sub.submittedAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20 opacity-30 uppercase tracking-[0.2em] font-black">No operations recorded</div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="question-form-container mt-8"
                        >
                            <form onSubmit={handleAddOrUpdateQuestion} className="question-form bg-card p-8 rounded-3xl border border-glass-border shadow-soft glass-morph">
                                <h3 className="uppercase font-black mb-8 tracking-widest text-primary border-b border-primary/20 pb-4">
                                    {editingQuestion ? 'Update mission spec' : 'Deploy new configuration'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="input-group">
                                        <label className="input-label">Title</label>
                                        <input
                                            className="input-light"
                                            value={newQuestion.title}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                                            required placeholder="Challenge Name"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Round</label>
                                        <input
                                            className="input-light"
                                            type="number"
                                            value={newQuestion.round}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, round: parseInt(e.target.value) })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group mt-6">
                                    <label className="input-label">Problem Statement</label>
                                    <textarea
                                        rows="3"
                                        className="input-light font-sans"
                                        value={newQuestion.problem}
                                        onChange={(e) => setNewQuestion({ ...newQuestion, problem: e.target.value })}
                                        required placeholder="Describe the mission objectives..."
                                    />
                                </div>
                                <div className="input-group mt-6">
                                    <label className="input-label">Buggy Code (Target for Debugging)</label>
                                    <textarea
                                        rows="6"
                                        className="input-light font-mono text-xs text-green-400"
                                        value={newQuestion.buggyCode}
                                        onChange={(e) => setNewQuestion({ ...newQuestion, buggyCode: e.target.value })}
                                        required placeholder="// Inject flawed code here..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6 mt-6">
                                    <div className="input-group">
                                        <label className="input-label">Sample Input</label>
                                        <textarea
                                            rows="2"
                                            className="input-light font-mono text-xs"
                                            value={newQuestion.sampleInput}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, sampleInput: e.target.value })}
                                            placeholder="Standard input for test case..."
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Expected Output</label>
                                        <textarea
                                            rows="2"
                                            className="input-light font-mono text-xs text-primary"
                                            value={newQuestion.correctOutput}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, correctOutput: e.target.value })}
                                            required placeholder="The exact decoded result..."
                                        />
                                    </div>
                                </div>
                                <div className="input-group mt-6">
                                    <label className="input-label">Decryption Note / Hints</label>
                                    <input
                                        className="input-light italic"
                                        value={newQuestion.note}
                                        onChange={(e) => setNewQuestion({ ...newQuestion, note: e.target.value })}
                                        placeholder="Internal hints for the operative..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-6 mt-6">
                                    <div className="input-group">
                                        <label className="input-label">Difficulty Level</label>
                                        <select
                                            className="input-light font-black uppercase text-[10px]"
                                            value={newQuestion.difficulty}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                                        >
                                            <option value="easy">Level: Easy</option>
                                            <option value="medium">Level: Medium</option>
                                            <option value="hard">Level: Hard</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Merit Points (Marks)</label>
                                        <input
                                            className="input-light font-mono"
                                            type="number"
                                            value={newQuestion.marks}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, marks: parseInt(e.target.value) })}
                                            required
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary w-full mt-6 uppercase font-bold tracking-tighter">
                                    {editingQuestion ? 'Deploy Update' : 'Finalize Deployment'}
                                </button>
                                {editingQuestion && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingQuestion(null); setShowForm(false); }}
                                        className="w-full mt-2 text-xs uppercase opacity-50 hover:opacity-100"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default AdminDashboard;
