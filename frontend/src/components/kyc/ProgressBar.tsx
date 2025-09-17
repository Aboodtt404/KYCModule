"use client";
import React from "react";

type Props = { value: number };

export default function ProgressBar({ value }: Props) {
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-emerald-400 transition-all duration-400 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
