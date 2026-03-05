import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const LogoutButton = ({ className = "" }) => {
    const { logout } = useAuth();

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className={`btn btn-outline-danger fw-bold text-uppercase d-flex align-items-center gap-2 ${className}`}
            style={{
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
                borderRadius: '10px',
                padding: '0.5rem 1rem'
            }}
            title="Terminate Session"
        >
            <LogOut size={16} />
            <span>Logout</span>
        </motion.button>
    );
};

export default LogoutButton;
