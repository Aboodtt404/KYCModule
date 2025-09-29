import React, { useState } from "react";

export default function ThreeHero({ className }) {
  const [jump, setJump] = useState(false);

  const handleClick = () => {
    setJump(true);
    setTimeout(() => setJump(false), 300); // reset after 0.3s
  };

  return (
    <div
      className={`w-full h-40 sm:h-60 flex items-center justify-center ${className || ""}`}
    >
      <div
        onClick={handleClick}
        className={`relative cursor-pointer transition-all duration-300
          ${jump ? "-translate-y-3 scale-110" : "hover:scale-105 hover:-rotate-2"}
          animate-float animate-glow
        `}
      >
        <img
          src={`/j.png?canisterId=${process.env.CANISTER_ID_FRONTEND}`}
          alt="Platform Logo"
          className="w-auto h-auto max-h-28 sm:max-h-36 md:max-h-40 object-contain drop-shadow-xl"
        />
      </div>
    </div>
  );
}
