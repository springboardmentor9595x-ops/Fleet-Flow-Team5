import React from 'react';
import { motion } from 'framer-motion';
import './LoginCard.css';

export default function LoginCard({ children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="auth-card"
    >
      {children}
    </motion.section>
  );
}
