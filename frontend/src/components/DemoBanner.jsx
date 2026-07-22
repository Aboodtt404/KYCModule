import React, { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { isDemoMode, demoRole, disableDemo } from "@/demo/demoMode";
import { DEMO_OTP_CODE } from "@/demo/demoData";

// Fixed banner shown on every page while demo mode is active.
export default function DemoBanner() {
  const [role, setRole] = useState(demoRole());

  useEffect(() => {
    const sync = () => setRole(demoRole());
    window.addEventListener("demo-change", sync);
    return () => window.removeEventListener("demo-change", sync);
  }, []);

  if (!role) return null;

  const exitDemo = () => {
    disableDemo();
    window.location.href = "/"; // full reload → clean state
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[200] bg-amber-500 text-black text-xs sm:text-sm font-medium px-3 py-2 flex items-center justify-center gap-2 sm:gap-3 shadow-lg" role="status">
      <FlaskConical className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">
        Demo mode ({role}) — fictional data, nothing is saved on-chain.
        {role === "user" && <> OTP code: <strong>{DEMO_OTP_CODE}</strong>.</>}
      </span>
      <button
        onClick={exitDemo}
        className="flex items-center gap-1 bg-black/15 hover:bg-black/25 rounded-xl px-2.5 py-1 font-semibold transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" /> Exit demo
      </button>
    </div>
  );
}
