import { useState } from "react";

export function useStepper(totalSteps: number, initialStep: number = 1) {
  const [step, setStep] = useState(initialStep);

  const next = () => setStep((s) => Math.min(totalSteps, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));
  const skipToEnd = () => setStep(totalSteps);

  const safeStep = Math.max(1, Math.min(totalSteps, step));

 
  const percent =
    totalSteps > 1
      ? Math.round(((safeStep - 1) / (totalSteps - 1)) * 100)
      : 100;

  return {
    step: safeStep,
    setStep,
    next,
    prev,
    skipToEnd,
    percent,
    totalSteps,
  };
}
