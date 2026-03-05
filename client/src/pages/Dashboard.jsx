import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle2, ChevronRight, LogOut, Play, Send } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [examStatus, setExamStatus] = useState({ isStarted: false, timeLeft: 0 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userSubmissions, setUserSubmissions] = useState([]);
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [isCorrect, setIsCorrect] = useState(null);
    const { user, logout } = useAuth();

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/questions');
                setQuestions(res.data);
                if (res.data.length > 0) setSelectedQuestion(res.data[0]);
                setLoading(false);
            } catch (err) {
                if (err.response?.status === 403) {
                    setExamStatus(prev => ({ ...prev, isStarted: false }));
                }
                console.error(err);
                setLoading(false);
            }
        };

        const fetchSettings = async () => {
            try {
                // Fetch user data first to get submissions
                const userRes = await axios.get('http://localhost:5000/api/auth/me');
                setUserSubmissions(userRes.data.submissions || []);

                const res = await axios.get('http://localhost:5000/api/admin/settings');
                if (res.data.isExamStarted) {
                    setExamStatus({ isStarted: true, timeLeft: calculateTimeLeft(res.data) });
                    fetchQuestions();
                } else {
                    setExamStatus({ isStarted: false, timeLeft: 0 });
                    setLoading(false);
                }
            } catch (err) {
                console.error("Failed to fetch settings/user", err);
                setLoading(false);
            }
        };

        fetchSettings();
        const interval = setInterval(fetchSettings, 5000); // Check settings every 5s for instant sync
        return () => clearInterval(interval);
    }, []);

    const calculateTimeLeft = (settings) => {
        const start = new Date(settings.startTime).getTime();
        const now = new Date().getTime();
        const durationMs = settings.examDuration * 60 * 1000;
        const diff = durationMs - (now - start);
        return Math.max(0, Math.floor(diff / 1000));
    };

    useEffect(() => {
        let timer;
        if (examStatus.isStarted && examStatus.timeLeft > 0) {
            timer = setInterval(() => {
                setExamStatus(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [examStatus.isStarted, examStatus.timeLeft]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleFinalize = async () => {
        if (!window.confirm("Are you sure you want to finalize your mission? You won't be able to change your answers.")) return;

        setIsSubmitting(true);
        try {
            const res = await axios.post('http://localhost:5000/api/questions/submit');
            alert(`Mission Accomplished! Total Time: ${res.data.duration}s`);
            window.location.reload(); // To show completed state
        } catch (err) {
            alert('Submission failed: ' + (err.response?.data?.message || 'Error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (selectedQuestion) {
            // Find existing submission for this question
            const existing = userSubmissions.find(s => s.questionId === selectedQuestion._id);
            setCode(existing ? existing.code : selectedQuestion.buggyCode);
            setOutput('');
            setIsCorrect(null);
        }
    }, [selectedQuestion, userSubmissions]);

    const handleRun = () => {
        // Since we can't actually execute code securely in browser without a sandbox,
        // we'll simulate output or ask for manual output if it was a real environment.
        // For this event, we'll assume the student provides the output they got.
        const studentOutput = prompt("Enter the output of your code:");
        if (studentOutput !== null) {
            setOutput(studentOutput);
            if (studentOutput.trim().toLowerCase() === selectedQuestion.correctOutput.trim().toLowerCase()) {
                setIsCorrect(true);
            } else {
                setIsCorrect(false);
            }
        }
    };

    const handleSubmitAnswer = async () => {
        if (output === '') {
            alert("Please run your code and provide output before submitting.");
            return;
        }
        try {
            const res = await axios.post('http://localhost:5000/api/questions/submit-answer', {
                questionId: selectedQuestion._id,
                code,
                output
            });
            setIsCorrect(res.data.isCorrect);
            alert(res.data.message);
            // Refresh submissions
            const userRes = await axios.get('http://localhost:5000/api/auth/me');
            setUserSubmissions(userRes.data.submissions || []);
        } catch (err) {
            alert('Submission failed');
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header p-4 bg-glass backdrop-blur-md border-b border-glass-border flex justify-between items-center px-4 md:px-8 z-50">
                <div className="flex items-center gap-4">
                    <div className="logo-box bg-primary p-1.5 rounded-lg shadow-neon">
                        <BookOpen size={20} className="text-black" />
                    </div>
                    <h2 className="uppercase font-black tracking-widest text-white text-sm md:text-base">Escape Code</h2>
                </div>

                <div className="flex items-center gap-3 md:gap-6">
                    {examStatus.isStarted && (
                        <div className="flex items-center gap-2 bg-black/60 border border-glass-border text-white px-3 md:px-4 py-1.5 rounded-full text-[10px] md:text-xs font-mono shadow-neon overflow-hidden">
                            <span className="opacity-50 hidden md:inline">TIME_REMAINING:</span>
                            <span className={examStatus.timeLeft < 300 ? "text-red-500 animate-pulse font-bold" : "text-primary font-bold"}>
                                {formatTime(examStatus.timeLeft)}
                            </span>
                        </div>
                    )}

                    <div className="hidden sm:flex flex-col items-end border-r pr-4 border-white/10 text-white">
                        <span className="text-[10px] font-black uppercase text-primary tracking-tighter leading-none mb-1">{user?.name}</span>
                        <span className="text-[8px] opacity-40 uppercase tracking-widest leading-none">{user?.collegeName}</span>
                    </div>

                    <div className="progress-pill bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hidden md:flex items-center gap-2">
                        <div className="flex gap-1">
                            {questions.map((q, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${userSubmissions.find(s => s.questionId === q._id)?.isCorrect ? 'bg-primary shadow-neon' : 'bg-white/10'}`} />
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-white ml-1">
                            {userSubmissions.filter(s => s.isCorrect).length}/{questions.length}
                        </span>
                    </div>

                    <LogoutButton />
                </div>
            </header>

            <main className="dashboard-main">
                <aside className="sidebar">
                    <h3 className="sidebar-title">Challenges Discovered</h3>
                    <div className="task-list">
                        {questions.map((q, idx) => {
                            const sub = userSubmissions.find(s => s.questionId === q._id);
                            return (
                                <div
                                    key={q._id}
                                    className={`task-item ${selectedQuestion?._id === q._id ? 'active' : ''} ${sub?.isCorrect ? 'completed' : ''}`}
                                    onClick={() => setSelectedQuestion(q)}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            {sub?.isCorrect && <CheckCircle2 size={12} className="text-green-500" />}
                                            <span>#{idx + 1} {q.title}</span>
                                        </div>
                                        {selectedQuestion?._id === q._id && <ChevronRight size={16} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                <section className="dashboard-content flex-1">
                    <div className="content-area">
                        <AnimatePresence mode="wait">
                            {selectedQuestion ? (
                                <motion.div
                                    key={selectedQuestion._id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex flex-col h-full"
                                >
                                    <div className="problem-header p-4 md:p-6 bg-white/5 border-b border-white/10">
                                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setSelectedQuestion(null)}
                                                    className="md:hidden p-2 bg-white/5 rounded-lg border border-white/10"
                                                >
                                                    <ChevronRight size={18} className="rotate-180" />
                                                </button>
                                                <h1 className="problem-title text-xl md:text-2xl font-black uppercase text-white tracking-tight">{selectedQuestion.title}</h1>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="marks-badge bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedQuestion.marks} UNITS</span>
                                                <span className="difficulty-badge bg-white/5 text-dim border border-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedQuestion.difficulty}</span>
                                            </div>
                                        </div>
                                        <p className="problem-desc text-sm md:text-base text-dim leading-relaxed">{selectedQuestion.problem}</p>
                                    </div>

                                    <div className="problem-details-grid grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 md:p-6 bg-black/20">
                                        <div className="buggy-code-container relative group">
                                            <div className="absolute top-3 right-3 text-[8px] font-black text-green-500/30 uppercase tracking-widest pointer-events-none">CORRUPTED_SOURCE</div>
                                            <div className="buggy-code-section p-4 bg-black/40 border border-glass-border text-green-400 rounded-2xl font-mono text-xs md:text-sm overflow-auto max-h-[200px] xl:max-h-none">
                                                <pre className="whitespace-pre-wrap">{selectedQuestion.buggyCode}</pre>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            {selectedQuestion.sampleInput && (
                                                <div className="input-section p-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-2 opacity-10"><Send size={40} /></div>
                                                    <h4 className="text-[10px] uppercase text-blue-400 mb-2 font-black tracking-[0.2em]">Input Vectors:</h4>
                                                    <pre className="font-mono text-xs text-blue-200/80 bg-black/20 p-2 rounded-lg">{selectedQuestion.sampleInput}</pre>
                                                </div>
                                            )}

                                            {selectedQuestion.note && (
                                                <div className="note-section p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-2xl relative">
                                                    <h4 className="text-[10px] uppercase text-yellow-500 mb-2 font-black tracking-[0.2em]">Intelligence Note:</h4>
                                                    <p className="text-xs text-yellow-200/70 italic leading-relaxed">{selectedQuestion.note}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="editor-wrapper flex-1 relative min-h-[400px] border-y border-white/5 bg-[#1e1e1e]">
                                        <Editor
                                            height="100%"
                                            defaultLanguage="javascript"
                                            theme="vs-dark"
                                            value={code}
                                            onChange={(val) => setCode(val)}
                                            options={{
                                                minimap: { enabled: false },
                                                fontSize: 14,
                                                lineNumbers: 'on',
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true,
                                                padding: { top: 20 },
                                                fontFamily: 'JetBrains Mono, Fira Code, monospace'
                                            }}
                                        />

                                        <AnimatePresence>
                                            {isCorrect !== null && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    className={`absolute top-6 right-6 px-4 py-2 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 z-20 shadow-2xl backdrop-blur-md border ${isCorrect ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full animate-pulse ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    {isCorrect ? 'VALID_SIGNAL_MATCH' : 'CHECKSUM_FAILED'}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="action-bar p-4 md:p-6 bg-glass border-t border-glass-border flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleRun}
                                                className="group flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-primary hover:text-black hover:border-primary transition-all duration-300 uppercase text-[10px] font-black tracking-widest"
                                            >
                                                <Play size={14} className="group-hover:fill-current" /> EXECUTE_ENV
                                            </button>
                                            <button
                                                onClick={handleSubmitAnswer}
                                                className="group flex items-center gap-2 px-6 py-2.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 uppercase text-[10px] font-black tracking-widest"
                                            >
                                                <Send size={14} /> COMMITT_LOG
                                            </button>
                                        </div>

                                        <div className="flex flex-col items-end">
                                            <div className="text-[8px] uppercase font-black opacity-30 tracking-widest mb-1">LOCAL_VERIFICATION_STATUS</div>
                                            <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${isCorrect === true ? 'bg-green-900/20 text-green-500 border-green-500/30' : isCorrect === false ? 'bg-red-900/20 text-red-500 border-red-500/30' : 'bg-white/5 text-dim border-white/10'}`}>
                                                {isCorrect === true ? 'SIGNAL_VERIFIED' : isCorrect === false ? 'RETRY_REQUIRED' : 'WAITING_FOR_INPUT'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="finalize-section p-8 text-center bg-black/40 border-t border-white/5">
                                        <button
                                            onClick={handleFinalize}
                                            disabled={isSubmitting}
                                            className="group relative bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 hover:border-red-600 px-12 py-4 rounded-2xl uppercase font-black tracking-[0.3em] transition-all duration-500 disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'UPLOADING...' : 'Finalize Mission'}
                                            <div className="absolute inset-0 bg-red-600 blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                                        </button>
                                        <p className="text-[9px] text-dim mt-4 opacity-40 uppercase tracking-[0.2em] font-bold italic">Critical: Finalization permanent. All active caches will be cleared.</p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-4 md:p-8">
                                    {!examStatus.isStarted ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center bg-card p-12 rounded-[2rem] border border-glass-border glass-morph max-w-lg shadow-2xl relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                                            <div className="mb-8 relative inline-block">
                                                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin relative z-10" />
                                            </div>
                                            <h2 className="uppercase font-black tracking-[0.3em] text-2xl text-white mb-4">Awaiting signal...</h2>
                                            <p className="text-dim text-sm italic opacity-70 leading-relaxed uppercase tracking-tighter">
                                                Encryption keys are currently locked. <br />
                                                Please remain on standby for admin authorization.
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <div className="w-full max-w-6xl mx-auto py-12">
                                            <div className="mb-12 text-center">
                                                <h2 className="text-3xl font-black uppercase tracking-[0.2em] text-white mb-2">Select Your Mission</h2>
                                                <p className="text-primary text-[10px] font-black tracking-[0.4em] opacity-50 uppercase">Active_Deployment_Grid</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {questions.map((q, idx) => {
                                                    const sub = userSubmissions.find(s => s.questionId === q._id);
                                                    return (
                                                        <motion.div
                                                            key={q._id}
                                                            whileHover={{ y: -5, scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => setSelectedQuestion(q)}
                                                            className={`mission-card group cursor-pointer relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden shadow-xl ${sub?.isCorrect ? 'bg-green-900/10 border-green-500/30 shadow-green-900/20' : 'bg-white/5 border-white/10 hover:border-primary/50 hover:shadow-primary/10'}`}
                                                        >
                                                            {sub?.isCorrect && (
                                                                <div className="absolute top-6 right-6 text-green-500">
                                                                    <CheckCircle2 size={24} />
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4 group-hover:text-primary transition-colors">Mission_0{idx + 1}</div>
                                                            <h3 className="text-xl font-black text-white uppercase mb-2 group-hover:translate-x-1 transition-transform leading-tight">{q.title}</h3>
                                                            <div className="flex items-center gap-3 mt-4">
                                                                <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full text-dim uppercase font-black">{q.marks}U</span>
                                                                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${q.difficulty === 'hard' ? 'bg-red-900/20 text-red-500 border-red-500/30' : q.difficulty === 'medium' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30' : 'bg-green-900/20 text-green-500 border-green-500/30'}`}>
                                                                    {q.difficulty}
                                                                </span>
                                                            </div>
                                                            <div className="mt-8 flex justify-end">
                                                                <div className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-500 shadow-inner">
                                                                    <ChevronRight size={24} className="text-white group-hover:text-black" />
                                                                </div>
                                                            </div>
                                                            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Dashboard;
