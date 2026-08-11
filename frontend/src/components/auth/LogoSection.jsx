import React from 'react';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';

export default function LogoSection({ large = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="flex items-center justify-center"
    >
      <div className={`flex items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-500 to-indigo-600 shadow-lg ${large ? 'h-20 w-20' : 'h-12 w-12'}`}>
        <Truck className={`text-white ${large ? 'h-9 w-9' : 'h-6 w-6'}`} />
      </div>
    </motion.div>
  );
}
