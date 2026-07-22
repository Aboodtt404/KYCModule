"use client";
import React from "react";
import { Link } from "react-router-dom";
import LottieSuccess from "./LottieSuccess";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
import { Search, Trash2 } from "lucide-react";

export default function SuccessStep({ onDone, submissionId, nationalId }) {
    return (
        <div className="space-y-4 sm:space-y-6">
            <GlassCard className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-6 sm:py-8">
                <LottieSuccess className="w-32 h-32 sm:w-40 sm:h-40" />
                <h3 className="text-lg sm:text-xl font-semibold text-white">Verification Submitted!</h3>
                <p className="text-xs sm:text-sm text-gray-300 text-center px-4">
                    Your documents are under review. You will be notified once a decision is made (usually 24–48 hours).
                </p>

                {/* Submission ID */}
                {submissionId && (
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Your Submission ID</p>
                        <p className="text-xs font-mono text-white break-all">{submissionId}</p>
                        <p className="text-[10px] text-gray-500 mt-1">Keep this for your records</p>
                    </div>
                )}

                {/* Quick links */}
                <div className="flex gap-3 w-full">
                    <Link
                        to="/status"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
                    >
                        <Search className="w-3.5 h-3.5" />
                        Check Status
                    </Link>
                    <Link
                        to="/delete-my-data"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:bg-white/10 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete My Data
                    </Link>
                </div>
            </GlassCard>

            <Button
                className="w-full h-10 sm:h-12 text-sm sm:text-base font-semibold touch-manipulation min-h-[44px]"
                onClick={() => onDone?.()}
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                Done
            </Button>
        </div>
    );
}
