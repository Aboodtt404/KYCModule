"use client";
import React from "react";
export default function GlassCard({ children, className = "", }) {
    return (<div className={`bg-white/[0.04] backdrop-blur-xl border border-white/5 ring-1 ring-white/10 shadow-card rounded-xl sm:rounded-2xl p-3 sm:p-6 ${className}`}>
      {children}
    </div>);
}
