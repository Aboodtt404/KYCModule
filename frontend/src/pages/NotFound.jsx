import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <p className="text-8xl font-bold text-white/10 select-none">404</p>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-gray-400 text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold text-sm transition active:scale-95"
          >
            Go to Home
          </Link>
          <Link
            to="/status"
            className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white font-semibold text-sm transition hover:bg-white/15"
          >
            Check KYC Status
          </Link>
        </div>
      </div>
    </div>
  );
}
