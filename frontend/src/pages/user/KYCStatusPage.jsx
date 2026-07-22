import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, Search, CheckCircle, XCircle, Clock, Loader2, ArrowLeft } from "lucide-react";
import { useActor } from "@/hooks/useActor";

const STATUS_CONFIG = {
  approved:      { icon: CheckCircle, color: "text-green-400",  bg: "bg-green-500/10  border-green-500/30",  label: "Approved",      message: "Your identity has been verified. You have full access to Mercatura Forum." },
  rejected:      { icon: XCircle,     color: "text-red-400",    bg: "bg-red-500/10    border-red-500/30",    label: "Rejected",      message: "Your verification could not be approved. Please contact support@mercaturaforum.com." },
  pending_review:{ icon: Clock,       color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "Under Review",  message: "Your submission is being reviewed. You will be notified once a decision is made." },
};

export default function KYCStatusPage() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);   // null | { status, submission_id, face_verified }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!actor) { setError("Cannot connect to the blockchain. Please try again."); return; }

    const id = nationalId.trim();
    if (!/^[23]\d{13}$/.test(id)) {
      setError("Please enter a valid 14-digit Egyptian National ID.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter the phone number used during verification.");
      return;
    }

    setLoading(true); setError(""); setResult(null);
    try {
      const raw = await actor.get_my_kyc_status(id, phone.trim());
      // Candid optional: [] = None, [value] = Some(value)
      if (!raw || raw.length === 0) {
        setError("No submission found. Check that your National ID and phone number match what you entered during verification.");
      } else {
        setResult(JSON.parse(raw[0]));
      }
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG.pending_review) : null;

  return (
    <div className="min-h-screen app-bg text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold">Check KYC Status</h1>
          <p className="text-gray-400 text-sm">Enter your National ID and phone number to see your verification status</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleCheck} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">National ID Number</label>
            <input
              type="text"
              value={nationalId}
              onChange={e => { setNationalId(e.target.value); setError(""); setResult(null); }}
              placeholder="14-digit National ID"
              maxLength={14}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(""); setResult(null); }}
              onBlur={e => { const v = e.target.value.trim(); if (/^0\d{10}$/.test(v)) setPhone('+20' + v.slice(1)); }}
              placeholder="+20 10 1234 5678"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Include country code — e.g. +201012345678 (Egypt: +20)</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
 type="submit"
 disabled={loading || nationalId.length < 14 || !phone.trim()}
 className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
 >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
              : <><Search className="w-4 h-4" /> Check Status</>}
          </button>
        </form>

        {/* Result card */}
        {result && cfg && (
          <div className={`border rounded-2xl p-6 space-y-4 ${cfg.bg}`}>
            <div className="flex items-center gap-3">
              <cfg.icon className={`w-8 h-8 ${cfg.color}`} />
              <div>
                <p className="font-bold text-lg">{cfg.label}</p>
                <p className="text-xs text-gray-400 font-mono">ID: {result.submission_id?.slice(0, 24)}…</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">{cfg.message}</p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Face verified:</span>
              <span className={result.face_verified ? "text-green-400" : "text-yellow-400"}>
                {result.face_verified ? "✓ Yes" : "✗ No"}
              </span>
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-gray-300">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <Link to="/user" className="hover:text-gray-300">Start Verification</Link>
          <Link to="/delete-my-data" className="hover:text-gray-300">Delete My Data</Link>
        </div>

      </div>
    </div>
  );
}
