"use client";
import React from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";

export default function ReviewStep({
  onSubmit,
  summary,
  editedData,
}: {
  onSubmit: () => void;
  summary?: { phone?: string; documentName?: string };
  editedData?: Record<string, string>;
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
        
        {editedData && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <h4 className="font-medium mb-2">Verified Information:</h4>
            {Object.entries(editedData).map(([key, value]) => (
              <div key={key} className="flex justify-between mt-1">
                <span className="capitalize">{key.replace('_', ' ')}</span>
                <span>{value || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="pt-2">
        <Button onClick={onSubmit} className="w-full">
          Submit for verification
        </Button>
      </div>
    </GlassCard>
  );
}
