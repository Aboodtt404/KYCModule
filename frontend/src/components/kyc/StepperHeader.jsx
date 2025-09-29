// components/kyc/StepperHeader.tsx
"use client";
import React from "react";
import ProgressBar from "./ProgressBar";
export default function StepperHeader({ step, total, percent }) {
    return (<div className="mb-6">
      <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
        <span>Step {step} of {total}</span>
        <span>{percent}%</span>
      </div>
      <ProgressBar value={percent} height="h-2"/>
    </div>);
}
