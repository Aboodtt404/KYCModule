import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import KYCPage from './KYCPage';
import { ShieldCheck } from 'lucide-react';
import { useVerifySession, useMarkVerificationInProgress } from '@/hooks/useQueries';

// Hosted verification for partner API sessions (/verify/:sessionId).
// Device-agnostic: works on both desktop and mobile, unlike the QR handoff page.
export default function HostedVerifyPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isValidSession, setIsValidSession] = useState(null);

  const verifySession = useVerifySession();
  const markInProgress = useMarkVerificationInProgress();

  useEffect(() => {
    const validate = async () => {
      try {
        const isValid = await verifySession.mutateAsync(sessionId);
        setIsValidSession(isValid);
        if (isValid) {
          await markInProgress.mutateAsync(sessionId);
        }
      } catch {
        setIsValidSession(false);
      }
    };
    if (sessionId) { validate(); } else { setIsValidSession(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-brand-400 mx-auto mb-4"></div>
          <p>Loading verification…</p>
        </div>
      </div>
    );
  }

  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg p-4">
        <div className="content-card max-w-md text-center">
          <div className="text-red-400 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Unavailable</h2>
          <p className="text-slate-400 mb-6">
            This verification link is invalid, already used, or expired (links are valid for 24 hours).
            Please return to the website that sent you here and start again.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary min-h-[44px]">
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-bg overflow-x-hidden pt-safe pb-safe">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-2xl">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-brand-300" />
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-xs sm:text-sm truncate">Identity Verification</h1>
              <p className="text-[10px] sm:text-xs text-white/70 truncate">
                Requested by a partner website · Powered by Mercatura KYC
              </p>
            </div>
          </div>
        </div>

        <KYCPage apiMode={true} sessionId={sessionId} />
      </div>
    </div>
  );
}
