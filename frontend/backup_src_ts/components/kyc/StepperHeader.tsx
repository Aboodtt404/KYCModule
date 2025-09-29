// components/kyc/StepperHeader.tsx
"use client";
import React from "react";
import ProgressBar from "./ProgressBar";

type Props = {
  step: number;
  total: number;
  percent: number;
};

export default function StepperHeader({ step, total, percent }: Props) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
        <span>Step {step} of {total}</span>
        <span>{percent}%</span>
      </div>
      <ProgressBar value={percent} height="h-2" />
    </div>
  );
}
