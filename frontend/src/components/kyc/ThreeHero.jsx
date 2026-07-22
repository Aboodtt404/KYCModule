import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

// Brand hero: shows the platform logo when it resolves (canister-served),
// and falls back to a glowing brand badge in dev or if the asset is missing.
export default function ThreeHero({ className }) {
  const [jump, setJump] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleClick = () => {
    setJump(true);
    setTimeout(() => setJump(false), 300);
  };

  return (
    <div className={`w-full h-32 sm:h-44 flex items-center justify-center ${className || ""}`}>
      <div
        onClick={handleClick}
        className={`relative cursor-pointer transition-all duration-300 animate-float
          ${jump ? "-translate-y-3 scale-110" : "hover:scale-105 hover:-rotate-2"}
        `}
      >
        {imgFailed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-brand-500/15 ring-1 ring-brand-400/30 animate-pulse-glow">
              <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-brand-300" />
            </div>
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Mercatura KYC
            </span>
          </div>
        ) : (
          <img
            src={`/j.png?canisterId=${process.env.CANISTER_ID_FRONTEND}`}
            alt="Platform Logo"
            onError={() => setImgFailed(true)}
            className="w-auto h-auto max-h-24 sm:max-h-32 md:max-h-36 object-contain drop-shadow-xl"
          />
        )}
      </div>
    </div>
  );
}
