"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useStepper } from "../../../hooks/useStepper";

import StepperHeader from "@/components/kyc/StepperHeader";

import OTPStep from "@/components/kyc/OTPStep";
import DocumentStep from "@/components/kyc/DocumentStep";
import SelfieStep from "@/components/kyc/SelfieStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";

export default function KYCPage() {
  const totalSteps = 6;
  const { step, next, prev, skipToEnd, percent } = useStepper(totalSteps);

  // shared data
  const [phone, setPhone] = useState<string>();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieCaptured, setSelfieCaptured] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Stepper header */}
        <StepperHeader step={step} total={totalSteps} percent={percent} />

        {/* Animated step content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl"
        >
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <LogoHero className="max-h-40" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mt-4">
                  Verify your identity
                </h2>
                <p className="text-gray-300 text-sm sm:text-base mt-1">
                  This process helps keep your account secure.
                </p>
              </div>
              <button
                onClick={next}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform hover:scale-105 hover:shadow-[0_0_10px_rgba(0,255,136,0.6)]"
              >
                Start Verification
              </button>
            </div>
          )}

          {step === 2 && <OTPStep onNext={next} onSent={setPhone} />}
          {step === 3 && <DocumentStep onNext={next} onUploaded={setDocumentFile} />}
          {step === 4 && (
            <SelfieStep
              onNext={() => {
                setSelfieCaptured(true);
                next();
              }}
              onCapture={() => setSelfieCaptured(true)}
            />
          )}
          {step === 5 && (
            <ReviewStep
              onSubmit={next}
              summary={{
                phone,
                documentName: documentFile?.name,
                selfieCaptured,
              }}
            />
          )}
          {step === 6 && <SuccessStep onDone={() => {}} />}
        </motion.div>

        {/* Navigation controls */}
        <div className="mt-6 flex justify-between text-xs text-gray-400">
          <button
            onClick={prev}
            className={`px-3 py-2 rounded-md transition ${
              step === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
            }`}
            disabled={step === 1}
          >
            Back
          </button>
          <button
            onClick={skipToEnd}
            className="px-3 py-2 rounded-md hover:bg-white/10"
          >
            Skip to end
          </button>
        </div>
      </div>
    </div>
  );
}
