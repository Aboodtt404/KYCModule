import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { useActor } from "@/hooks/useActor";

export default function DeleteMyData() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!confirmed) { setMessage("Please check the confirmation box first."); return; }
    if (!phone.trim()) { setMessage("Phone number is required."); return; }
    if (!actor)     { setMessage("Cannot connect to the blockchain. Please try again."); return; }
    setMessage("");
    setShowModal(true);
  };

  const handleDelete = async () => {
    setShowModal(false);
    setStatus("loading");
    setMessage("");
    try {
      const result = await actor.delete_my_kyc(nationalId.trim(), phone.trim());
      if (!result || !("Ok" in result)) {
        setStatus("error");
        setMessage(("Err" in result) ? result.Err : "Deletion failed. Please verify your National ID and phone number, then try again.");
      } else {
        setStatus("success");
        setMessage("Your KYC data has been permanently deleted from the blockchain.");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "An error occurred. Please try again.");
    }
  };

  return (
    <div className="dark min-h-screen app-bg text-white py-10 px-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-7 h-7 text-red-500" />
          <h1 className="text-2xl font-bold">Delete My KYC Data</h1>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 rounded-lg p-4 mb-6 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-300">
            <p className="font-semibold mb-1">This action is permanent and irreversible.</p>
            <p>Your submission, extracted ID data, and face verification result will be deleted from the ICP blockchain. This action is recorded in the audit log for compliance purposes.</p>
          </div>
        </div>

        {status === "success" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold">Data Deleted</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
            <button onClick={() => navigate("/")} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              Return Home
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">National ID Number</label>
              <input
                type="text"
                value={nationalId}
                onChange={e => setNationalId(e.target.value)}
                placeholder="14-digit Egyptian National ID"
                maxLength={14}
                pattern="\d{14}"
                required
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the 14-digit ID used during your KYC submission.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onBlur={e => { const v = e.target.value.trim(); if (/^0\d{10}$/.test(v)) setPhone('+20' + v.slice(1)); }}
                placeholder="+20 10 1234 5678"
                required
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <p className="text-xs text-gray-500 mt-1">Include country code — e.g. +201012345678 (Egypt: +20)</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I understand this will permanently delete all my KYC data and the action cannot be undone.
              </span>
            </label>

            {message && status === "error" && (
              <p className="text-sm text-red-500 font-medium">{message}</p>
            )}

            <button
 type="submit"
 disabled={status ==="loading" || !nationalId || !phone || !confirmed}
 className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
 >
              {status === "loading"
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                : <><Trash2 className="w-4 h-4" /> Permanently Delete My Data</>}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Questions? Contact <a href="mailto:privacy@mercaturaforum.com" className="underline">privacy@mercaturaforum.com</a>
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-label="Confirm permanent deletion" onKeyDown={e => e.key === 'Escape' && setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Final Confirmation</h2>
              </div>
              <button onClick={() => setShowModal(false)} aria-label="Cancel deletion" className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              You are about to <span className="font-semibold text-red-600">permanently delete</span> all KYC data associated with National ID ending in <span className="font-mono font-bold">…{nationalId.slice(-4)}</span>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                autoFocus
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
 onClick={handleDelete}
 className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
 >
                <Trash2 className="w-4 h-4" /> Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
