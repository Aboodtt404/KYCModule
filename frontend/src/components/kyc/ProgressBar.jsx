"use client";
import React from "react";
import { motion } from "framer-motion";
export default function ProgressBar({ value }) {
    const percentage = Math.max(0, Math.min(100, value));
    return (<div className="w-full mb-3 sm:mb-6">
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          Progress
        </span>
        <span className="text-xs sm:text-sm font-semibold text-brand-600 dark:text-brand-400">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full h-2 sm:h-3 bg-white/5 ring-1 ring-white/10 rounded-full overflow-hidden shadow-inner">
        <motion.div className="h-full bg-gradient-to-r from-brand-500 via-violet-500 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.6)]" initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.6, ease: "easeOut" }}/>
      </div>
    </div>);
}
