"use client";
import React from "react";
export default function GlassCard({ children, className = "", }) {
    return (<div className={`bg-white/6 backdrop-blur-md border border-white/6 rounded-xl sm:rounded-2xl p-3 sm:p-6 ${className}`}>
      {children}
    </div>);
}
