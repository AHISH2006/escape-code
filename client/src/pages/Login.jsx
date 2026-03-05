import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ShieldCheck, School, Lock, Users, Plus, X } from 'lucide-react';
import '../styles/Login.css';

const Login = () => {
    const [loginType, setLoginType] = useState('student');
    const [participationType, setParticipationType] = useState('single');
    const [teamMembers, setTeamMembers] = useState(['']);
    const [formData, setFormData] = useState({
        name: '',
        collegeName: '',
        teamName: '',
        email: '',
        password: ''
    });

    const { login } = useAuth();
    const navigate = useNavigate();

    const addTeamMember = () => {
        if (teamMembers.length < 3) {
            setTeamMembers([...teamMembers, '']);
        }
    };

    const removeTeamMember = (index) => {
        const updated = teamMembers.filter((_, i) => i !== index);
        setTeamMembers(updated);
    };

    const handleMemberChange = (index, value) => {
        const updated = [...teamMembers];
        updated[index] = value;
        setTeamMembers(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const loginData = loginType === 'student'
                ? {
                    type: 'student',
                    name: formData.name,
                    collegeName: formData.collegeName,
                    participationType,
                    teamName: participationType === 'team' ? formData.teamName : '',
                    teamMembers: participationType === 'team' ? teamMembers.filter(m => m.trim() !== '') : []
                }
                : { type: 'admin', email: formData.email, password: formData.password };

            const res = await login(loginData);
            if (res.user.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            alert('Login failed: ' + (err.response?.data?.message || 'Access Denied'));
        }
    };

    return (
        <div className="login-container">
            {/* Background elements */}
            <div className="cyber-grid"></div>
            <div className="glow-orb orb-1"></div>
            <div className="glow-orb orb-2"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="login-card glass-morph"
            >
                <div className="access-header">
                    <span className="terminal-dot"></span>
                    <span className="terminal-dot"></span>
                    <span className="terminal-dot"></span>
                </div>
                <div className="login-toggle">
                    <button
                        onClick={() => setLoginType('student')}
                        className={`toggle-btn ${loginType === 'student' ? 'active' : ''}`}
                    >
                        <User size={18} /> STUDENT
                    </button>
                    <button
                        onClick={() => setLoginType('admin')}
                        className={`toggle-btn ${loginType === 'admin' ? 'active' : ''}`}
                    >
                        <ShieldCheck size={18} /> ADMIN
                    </button>
                </div>

                <h2 className="text-center mb-6 color-primary tracking-widest uppercase font-bold">
                    {loginType === 'student' ? 'Recruit Access' : 'System Command'}
                </h2>

                <form onSubmit={handleSubmit}>
                    <AnimatePresence mode="wait">
                        {loginType === 'student' ? (
                            <motion.div
                                key="student-form"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                            >
                                <div className="input-group">
                                    <label className="input-label">Full Name</label>
                                    <div className="input-wrapper">
                                        <User className="input-icon" size={18} />
                                        <input
                                            className="input-light login-input"
                                            placeholder="Enter your name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">College / Institution</label>
                                    <div className="input-wrapper">
                                        <School className="input-icon" size={18} />
                                        <input
                                            className="input-light login-input"
                                            placeholder="Institution name"
                                            value={formData.collegeName}
                                            onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="participation-section mb-6">
                                    <label className="input-label">Participation Mode</label>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="participation"
                                                value="single"
                                                checked={participationType === 'single'}
                                                onChange={() => setParticipationType('single')}
                                            />
                                            <span className="text-sm">Single</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="participation"
                                                value="team"
                                                checked={participationType === 'team'}
                                                onChange={() => setParticipationType('team')}
                                            />
                                            <span className="text-sm">Team</span>
                                        </label>
                                    </div>
                                    {participationType === 'team' && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mb-4"
                                        >
                                            <div className="input-group mb-0">
                                                <label className="input-label">Strike Team Name</label>
                                                <div className="input-wrapper">
                                                    <Users className="input-icon" size={18} />
                                                    <input
                                                        className="input-light login-input"
                                                        placeholder="Enter team designation"
                                                        value={formData.teamName}
                                                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                </div>

                                {participationType === 'team' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="team-members-section mb-4"
                                    >
                                        <div className="team-header d-flex justify-content-between align-items-center">
                                            <label className="input-label mb-0">Team Operatives (Max 3)</label>
                                            {teamMembers.length < 3 && (
                                                <button type="button" onClick={addTeamMember} className="add-operative-btn">
                                                    <Plus size={14} /> Add Operative
                                                </button>
                                            )}
                                        </div>
                                        {teamMembers.map((member, idx) => (
                                            <div key={idx} className="operative-input-wrapper">
                                                <Users className="input-icon" size={16} />
                                                <input
                                                    className="input-light login-input text-sm"
                                                    placeholder={`Operative ${idx + 2} Name`}
                                                    value={member}
                                                    onChange={(e) => handleMemberChange(idx, e.target.value)}
                                                    required
                                                />
                                                {teamMembers.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTeamMember(idx)}
                                                        className="remove-member-btn"
                                                        title="Remove Operative"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="admin-form"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                            >
                                <div className="input-group">
                                    <label className="input-label">Admin Secure Email</label>
                                    <div className="input-wrapper">
                                        <Lock className="input-icon" size={18} />
                                        <input
                                            type="text"
                                            className="input-light login-input"
                                            placeholder="demo@"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Authorization Code</label>
                                    <div className="input-wrapper">
                                        <ShieldCheck className="input-icon" size={18} />
                                        <input
                                            type="password"
                                            className="input-light login-input"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button type="submit" className="login-submit-btn w-full uppercase tracking-[0.2em] font-black mt-4">
                        {loginType === 'student' ? 'Initialize Entry' : 'Authenticate Access'}
                    </button>
                </form>

                <div className="login-footer text-xs">
                    This system monitors all activity. Unauthorised access is prohibited.
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
