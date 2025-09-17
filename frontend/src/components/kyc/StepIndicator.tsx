"use client";
import React from "react";

export default function StepIndicator({
  step,
  total,
}: {
  step: number;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-gray-300">
      <div>
        Step {step} of {total}
      </div>
      <div className="text-right">{Math.round((step / total) * 100)}%</div>
    </div>
  );
}
