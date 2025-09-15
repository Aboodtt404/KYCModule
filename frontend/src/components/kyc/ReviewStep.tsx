"use client";
import React from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";

export default function ReviewStep({
  onSubmit,
  summary,
}: {
  onSubmit: () => void;
  summary?: { phone?: string; documentName?: string; selfieCaptured?: boolean };
}) {
  return (
    <GlassCard className="space-y-4">
      <h3 className="text-lg font-semibold">Review & submit</h3>
      <div className="text-sm text-gray-300">
        <div className="flex justify-between">
          <span>Phone</span>
          <span>{summary?.phone ?? "—"}</span>
        </div>
        <div className="flex justify-between mt-2">
          <span>Document</span>
          <span>{summary?.documentName ?? "—"}</span>
        </div>
        <div className="flex justify-between mt-2">
          <span>Selfie</span>
          <span>{summary?.selfieCaptured ? "Captured" : "—"}</span>
        </div>
      </div>
      <div className="pt-2">
        <Button onClick={onSubmit} className="w-full">
          Submit for verification
        </Button>
      </div>
    </GlassCard>
  );
}
