"use client";
import React, { type ReactNode } from "react";

export default function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
