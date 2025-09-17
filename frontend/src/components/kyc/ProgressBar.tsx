"use client";
import React from "react";
import { motion } from "framer-motion";

type Props = { 
  value: number; 
  height?: string; // optional height class
};

export default function ProgressBar({ value, height = "h-2" }: Props) {
  const clamped = Math.max(0, Math.min(100, value)); // ensure between 0–100

<<<<<<< HEAD
export default function ProgressBar({ value }: Props) {
  const percentage = Math.max(0, Math.min(100, value));
  
  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Progress
        </span>
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-sm"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
=======
  return (
    <div className={`w-full ${height} bg-white/10 rounded-full overflow-hidden`}>
      <div
        className="h-full bg-emerald-400 transition-all duration-500 ease-in-out"
        style={{ width: `${clamped}%` }}
      />
>>>>>>> b39fae27837b325f504d18fa1cdb95f3f4517997
    </div>
  );
}
