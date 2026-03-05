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
            className={`btn-neon-logout ${className}`}
            title="Terminate Session"
        >
            <LogOut size={14} />
            <span>TERMINATE_SESSION</span>
        </motion.button>
    );
};

export default LogoutButton;
