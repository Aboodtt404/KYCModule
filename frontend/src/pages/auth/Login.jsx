import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Shield, ArrowRight, Loader2, Lock, FlaskConical, Code2, ScanFace, Timer, FileCheck2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { enableDemo } from "@/demo/demoMode";

export function Login() {
    const [loggingIn, setLoggingIn] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { loginWithII, isAuthenticated } = useAuth();

    const handleUserLogin = () => navigate("/user");

    const handleDemo = (role) => {
        enableDemo(role);
        if (role === "admin") navigate("/admin");
        else if (role === "developer") navigate("/developers");
        else navigate("/user");
    };

    const handleAdminLogin = async () => {
        setLoggingIn(true);
        setError("");
        try {
            const adminStatus = await loginWithII();
            if (adminStatus) {
                navigate("/admin");
            } else {
                setError(
                    "Authenticated, but your Internet Identity is not registered as an admin. " +
                    "Ask the canister controller to run: dfx canister call rust_backend set_admin \'(principal \"<your-principal>\")\''."
                );
            }
        } catch (err) {
            setError("Authentication cancelled or failed. Please try again.");
        } finally {
            setLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen app-bg flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            <div className="w-full max-w-4xl relative">
                <div className="text-center mb-8 sm:mb-10">
                    <div className="inline-block animate-float mb-5">
                        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30 animate-pulse-glow">
                            <Lock className="w-8 h-8 text-brand-300" />
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 px-2 tracking-tight">
                        <span className="text-white">Identity verification,</span>{" "}
                        <span className="text-gradient">on-chain.</span>
                    </h1>
                    <p className="text-sm sm:text-base text-slate-400 px-2 max-w-xl mx-auto">
                        KYC by Mercatura — document scanning, live face checks, and a tamper-proof
                        audit trail on the Internet Computer.
                    </p>

                    {/* Feature chips */}
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur">
                            <ScanFace className="w-3.5 h-3.5 text-brand-300" /> Active liveness
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur">
                            <FileCheck2 className="w-3.5 h-3.5 text-brand-300" /> On-chain audit trail
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur">
                            <Timer className="w-3.5 h-3.5 text-brand-300" /> ~2 minute verification
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center max-w-2xl mx-auto">
                        {error}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                    {/* User card */}
                    <motion.button
 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4 }}
 type="button"
 className="group text-left bg-white/[0.04] backdrop-blur-xl rounded-2xl shadow-card ring-1 ring-white/10 p-6 md:p-8 border border-white/5
 hover:border-brand-500/60 hover:shadow-brand-glow active:scale-[0.99] transition-all cursor-pointer touch-manipulation"
 onClick={handleUserLogin}
 >
                        <div className="w-12 h-12 bg-brand-500/15 ring-1 ring-brand-400/20 rounded-xl flex items-center justify-center mb-5">
                            <User className="w-6 h-6 text-brand-300" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">User Access</h2>
                        <p className="text-sm text-slate-400 mb-6">
                            Submit your KYC verification documents
                        </p>
                        <span className="btn-primary w-full min-h-[44px] group-hover:bg-brand-500">
                            Continue as User
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    </motion.button>

                    {/* Admin card */}
                    <motion.button
 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: 0.1 }}
 type="button"
 disabled={loggingIn}
 className="group text-left bg-white/[0.04] backdrop-blur-xl rounded-2xl shadow-card ring-1 ring-white/10 p-6 md:p-8 border border-white/5
 hover:border-brand-500/60 hover:shadow-brand-glow active:scale-[0.99] transition-all cursor-pointer touch-manipulation disabled:opacity-70"
 onClick={!loggingIn ? handleAdminLogin : undefined}
 >
                        <div className="w-12 h-12 bg-slate-700/60 ring-1 ring-white/10 rounded-xl flex items-center justify-center mb-5">
                            <Shield className="w-6 h-6 text-slate-200" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Admin Access</h2>
                        <p className="text-sm text-slate-400 mb-1">
                            Review, approve, and manage KYC submissions
                        </p>
                        <p className="text-xs text-slate-500 mb-6">
                            Authenticated via Internet Identity
                        </p>
                        <span className="btn-secondary w-full min-h-[44px]">
                            {loggingIn ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating…</>
                            ) : (
                                <><Shield className="w-4 h-4" /> Sign in with Internet Identity</>
                            )}
                        </span>
                    </motion.button>
                </div>

                {/* Demo mode — explore with fictional data, nothing touches the chain */}
                <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                    <div className="flex items-center justify-center gap-2 text-amber-300 text-sm font-semibold mb-3">
                        <FlaskConical className="w-4 h-4" />
                        Try a demo — no signup, fictional data only
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                            onClick={() => handleDemo("user")}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm text-slate-200 transition-colors touch-manipulation min-h-[44px]"
                        >
                            <User className="w-4 h-4 text-brand-300" /> Demo as User
                        </button>
                        <button
                            onClick={() => handleDemo("admin")}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm text-slate-200 transition-colors touch-manipulation min-h-[44px]"
                        >
                            <Shield className="w-4 h-4 text-brand-300" /> Demo as Admin
                        </button>
                        <button
                            onClick={() => handleDemo("developer")}
                            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm text-slate-200 transition-colors touch-manipulation min-h-[44px]"
                        >
                            <Code2 className="w-4 h-4 text-brand-300" /> Demo Developer
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-6">
                    <Link to="/status" className="text-sm text-brand-300 hover:text-brand-200 transition-colors">
                        Already submitted? Check your KYC status →
                    </Link>
                    <Link to="/developers" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                        Developers: integrate our KYC API →
                    </Link>
                </div>
                <p className="text-center text-xs text-slate-500 mt-4">
                    By continuing you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-slate-300">Terms of Service</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="underline hover:text-slate-300">Privacy Policy</Link>.
                </p>

                <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-slate-600">
                    <Lock className="w-3 h-3" />
                    <span>Secured on the Internet Computer · End-to-end verified</span>
                </div>
            </div>
        </div>
    );
}
