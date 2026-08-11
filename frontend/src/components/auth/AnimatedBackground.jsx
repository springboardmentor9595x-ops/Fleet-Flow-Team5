import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Package, Box } from 'lucide-react';

const icons = [
  { Icon: Truck, position: 'top-[18%] left-10' },
  { Icon: Package, position: 'top-24 right-20' },
  { Icon: Box, position: 'bottom-24 left-24' },
];

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#07111D]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(45,191,255,0.12),transparent_28%)]" />

      <div className="absolute inset-x-0 top-28 h-px border-t border-dashed border-white/10 opacity-60" />
      <div className="absolute inset-x-0 top-1/2 h-px border-t border-dashed border-white/8 opacity-50" />
      <div className="absolute inset-x-0 bottom-28 h-px border-t border-dashed border-white/8 opacity-40" />

      <div className="absolute left-10 top-16 h-24 w-24 rounded-[36px] bg-sky-500/8 blur-3xl" />
      <div className="absolute right-16 top-48 h-32 w-32 rounded-[40px] bg-slate-200/5 blur-3xl" />
      <div className="absolute left-1/2 top-1/4 h-44 w-44 -translate-x-1/2 rounded-full bg-sky-400/6 blur-3xl" />
      <div className="absolute right-24 bottom-16 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" />

      {icons.map(({ Icon, position }, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: [0, -8, 0] }}
          transition={{ duration: 6 + index * 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute rounded-3xl border border-slate-600/30 bg-slate-950/70 p-3 shadow-[0_0_40px_rgba(59,130,246,0.22)] ${position}`}
        >
          <Icon className="h-5 w-5 text-sky-300" />
        </motion.div>
      ))}
    </div>
  );
}
