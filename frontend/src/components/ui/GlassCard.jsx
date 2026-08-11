import React from 'react';
import { motion } from 'framer-motion';

export default function GlassCard({ className = '', children, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`glass-card overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
