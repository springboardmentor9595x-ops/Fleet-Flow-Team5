import React from 'react';
import { motion } from 'framer-motion';
import './GradientButton.css';

export default function GradientButton({ children, loading, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="gradient-button"
      {...props}
    >
      {loading ? 'Processing…' : children}
    </motion.button>
  );
}
