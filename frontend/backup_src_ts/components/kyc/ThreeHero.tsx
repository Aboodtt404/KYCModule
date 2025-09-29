import React, { useState } from "react";

interface ThreeHeroProps {
  className?: string;
}

export default function ThreeHero({ className }: ThreeHeroProps) {
  const [animate, setAnimate] = useState(false);

  const handleClick = () => {
    setAnimate(true);
    setTimeout(() => setAnimate(false), 1000);
  };

  return (
    <div className={`w-full h-40 sm:h-60 flex items-center justify-center ${className || ""}`}>
      <div
        className={`relative cursor-pointer transition-all duration-1000 
          ${animate ? "animate-bounce scale-110 rotate-6" : "hover:scale-105 hover:-rotate-2"}
          animate-float animate-glow
        `}
        onClick={handleClick}
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
