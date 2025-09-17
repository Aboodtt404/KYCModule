"use client";
import React, { useState } from "react";
import ProgressBar from "@/components/kyc/ProgressBar";
import StepIndicator from "@/components/kyc/StepIndicator";
import OTPStep from "@/components/kyc/OTPStep";
import DocumentStep from "@/components/kyc/DocumentStep";
import SelfieStep from "@/components/kyc/SelfieStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";

export default function KYCPage() {
  const totalSteps = 6;
  const [step, setStep] = useState<number>(1);

  // shared data
  const [phone, setPhone] = useState<string | undefined>();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieCaptured, setSelfieCaptured] = useState<boolean>(false);

  function next() {
    setStep((s) => Math.min(totalSteps, s + 1));
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <StepIndicator step={step} total={totalSteps} />
          <ProgressBar value={Math.round((step / totalSteps) * 100)} />
        </div>

        <div className="bg-transparent rounded-2xl p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-4">
              <LogoHero />
              <div className="bg-white/4 backdrop-blur-md p-4 rounded-xl">
                <h2 className="text-lg font-semibold">Verify your identity</h2>
                <p className="text-sm text-gray-300 mt-2">
                  This process helps keep your account secure.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 py-3 rounded-lg bg-emerald-400 text-black font-medium"
                    onClick={next}
                  >
                    Start verification
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <OTPStep
              onNext={() => {
                next();
              }}
              onSent={(p) => setPhone(p)}
            />
          )}

          {step === 3 && (
            <DocumentStep
              onNext={() => next()}
              onUploaded={(f) => setDocumentFile(f)}
            />
          )}

          {step === 4 && (
            <SelfieStep
              onNext={() => {
                setSelfieCaptured(true);
                next();
              }}
              onCapture={() => {
                setSelfieCaptured(true);
              }}
            />
          )}

          {step === 5 && (
            <ReviewStep
              onSubmit={() => next()}
              summary={{
                phone,
                documentName: documentFile?.name,
                selfieCaptured,
              }}
            />
          )}

          {step === 6 && (
            <SuccessStep
              onDone={() => {
                /* navigate away or close */
              }}
            />
          )}
        </div>

        <div className="mt-4 flex justify-between text-xs text-gray-400">
          <button
            onClick={prev}
            className={`px-3 py-2 rounded-md ${
              step === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-white/4"
            }`}
            disabled={step === 1}
          >
            Back
          </button>
          <button
            onClick={() => {
              setStep(totalSteps);
            }}
            className="px-3 py-2 rounded-md hover:bg-white/4"
          >
            Skip to end
          </button>
        </div>
      </div>
    </div>
  );
}
