"use client";
import React from "react";
import LottieSuccess from "./LottieSuccess";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
export default function SuccessStep({ onDone }) {
    return (<div className="space-y-4 sm:space-y-6">
      <GlassCard className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-6 sm:py-8">
        <LottieSuccess className="w-32 h-32 sm:w-40 sm:h-40"/>
        <h3 className="text-lg sm:text-xl font-semibold text-white">Documents submitted</h3>
        <p className="text-xs sm:text-sm text-gray-300 text-center px-4">
          Verification usually takes 24–48 hours. We'll notify you when it's
          completed.
        </p>
      </GlassCard>

      <div>
        <Button className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold" onClick={() => onDone?.()}>
          Go to dashboard
        </Button>
      </div>
    </div>);
}
