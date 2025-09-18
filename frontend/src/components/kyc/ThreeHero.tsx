import React, { useState } from "react";
import { motion } from "framer-motion";

interface LogoHeroProps {
  className?: string;
  onNext?: () => void;
}

export default function LogoHero({
  className = "h-40 sm:h-60",
  onNext,
}: LogoHeroProps) {
  const [animate, setAnimate] = useState(false);

  const handleClick = () => {
    setAnimate(true);
    setTimeout(() => setAnimate(false), 1000);
  };

  const handleStartVerification = () => {
    if (onNext) {
      onNext();
    }
  };

  return (
    <div className={`w-full ${className} flex flex-col items-center justify-center space-y-8`}>
      {/* Title and Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome to KYC Verification
        </h1>
        <p className="text-lg text-gray-300 max-w-md">
          Complete your identity verification in just a few simple steps to get started.
        </p>
      </motion.div>

      {/* 3D Cube */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className={`relative cursor-pointer select-none transition-all duration-1000 ${animate
            ? "animate-bounce scale-110 rotate-12"
            : "hover:scale-105 hover:-rotate-2"
          }`}
        onClick={handleClick}
      >
        {/* Isometric cube container */}
        <div className="relative w-32 h-32">
          {/* SVG for precise isometric cube */}
          <svg
            width="128"
            height="128"
            viewBox="0 0 128 128"
            className="drop-shadow-2xl"
          >
            {/* Define gradients for faces */}
            <defs>
              {/* Top face - bright cyan-green */}
              <linearGradient id="topFace" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ff88" />
                <stop offset="100%" stopColor="#00d4aa" />
              </linearGradient>

              {/* Left face - vibrant green to teal */}
              <linearGradient id="leftFace" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ff66" />
                <stop offset="100%" stopColor="#00aa88" />
              </linearGradient>

              {/* Right face - cyan to deep blue */}
              <linearGradient
                id="rightFace"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#00ccdd" />
                <stop offset="100%" stopColor="#0066bb" />
              </linearGradient>
            </defs>

            {/* Cube faces - filled */}
            {/* Top face */}
            <polygon points="64,16 100,36 64,56 28,36" fill="url(#topFace)" />

            {/* Left face */}
            <polygon points="28,36 64,56 64,96 28,76" fill="url(#leftFace)" />

            {/* Right face */}
            <polygon
              points="64,56 100,36 100,76 64,96"
              fill="url(#rightFace)"
            />

            {/* Glowing wireframe overlay */}
            {/* Top face outline */}
            <polygon
              points="64,16 100,36 64,56 28,36"
              fill="none"
              stroke="#00ff88"
              strokeWidth="2"
              style={{
                filter: "drop-shadow(0 0 8px #00ff88)",
              }}
            />

            {/* Left face outline */}
            <polygon
              points="28,36 64,56 64,96 28,76"
              fill="none"
              stroke="#00ff66"
              strokeWidth="2"
              style={{
                filter: "drop-shadow(0 0 6px #00ff66)",
              }}
            />

            {/* Right face outline */}
            <polygon
              points="64,56 100,36 100,76 64,96"
              fill="none"
              stroke="#00ccdd"
              strokeWidth="2"
              style={{
                filter: "drop-shadow(0 0 6px #00ccdd)",
              }}
            />

            {/* Additional edge highlights for that neon look */}
            <line
              x1="64"
              y1="16"
              x2="64"
              y2="56"
              stroke="#ffffff"
              strokeWidth="1"
              opacity="0.8"
              style={{
                filter: "drop-shadow(0 0 3px #00ff88)",
              }}
            />
            <line
              x1="28"
              y1="36"
              x2="64"
              y2="56"
              stroke="#ffffff"
              strokeWidth="1"
              opacity="0.6"
              style={{
                filter: "drop-shadow(0 0 3px #00ff66)",
              }}
            />
            <line
              x1="100"
              y1="36"
              x2="64"
              y2="56"
              stroke="#ffffff"
              strokeWidth="1"
              opacity="0.6"
              style={{
                filter: "drop-shadow(0 0 3px #00ccdd)",
              }}
            />
          </svg>
        </div>
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex flex-col items-center space-y-4"
      >
        <button
          onClick={handleStartVerification}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-opacity-50"
        >
          Start Verification
        </button>
        <p className="text-sm text-gray-400 text-center max-w-sm">
          This process takes about 2-3 minutes and requires your phone number and a valid ID document.
        </p>
      </motion.div>
    </div>
  );
}
