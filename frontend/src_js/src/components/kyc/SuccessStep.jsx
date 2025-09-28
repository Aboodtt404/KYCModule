"use client";
import React from "react";
import LottieSuccess from "./LottieSuccess";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
export default function SuccessStep({ onDone }) {
    return (<div className="space-y-6">
      <GlassCard className="flex flex-col items-center justify-center gap-4">
        <LottieSuccess className="w-40 h-40"/>
        <h3 className="text-xl font-semibold">Documents submitted</h3>
        <p className="text-sm text-gray-300 text-center">
          Verification usually takes 24–48 hours. We'll notify you when it's
          completed.
        </p>
      </GlassCard>

      <div>
        <Button className="w-full" onClick={() => onDone?.()}>
          Go to dashboard
        </Button>
      </div>
    </div>);
}
