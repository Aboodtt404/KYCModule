"use client";
import React from "react";

type Props = { 
  value: number; 
  height?: string; // optional height class
};

export default function ProgressBar({ value, height = "h-2" }: Props) {
  const clamped = Math.max(0, Math.min(100, value)); // ensure between 0–100

  return (
    <div className={`w-full ${height} bg-white/10 rounded-full overflow-hidden`}>
      <div
        className="h-full bg-emerald-400 transition-all duration-500 ease-in-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
