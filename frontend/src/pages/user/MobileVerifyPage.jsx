import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import KYCPage from './KYCPage';
import { CheckCircle, Smartphone, Check } from 'lucide-react';
import { useVerifySession, useMarkVerificationInProgress, useCompleteVerification } from '@/hooks/useQueries';

export default function MobileVerifyPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isValidSession, setIsValidSession] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  
  const verifySession = useVerifySession();
  const markInProgress = useMarkVerificationInProgress();
  const completeVerification = useCompleteVerification();

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    };
    setIsMobile(checkMobile());

    // Validate session
    const validateSession = async () => {
      try {
        const isValid = await verifySession.mutateAsync(sessionId);
        setIsValidSession(isValid);
        
        // Mark as in progress if valid
        if (isValid) {
          await markInProgress.mutateAsync(sessionId);
        }
      } catch (_error) {
        setIsValidSession(false);
      }
    };

    if (sessionId) {
      validateSession();
    } else {
      setIsValidSession(false);
    }

    // Send heartbeat every 5 seconds to keep the session alive on the desktop polling side
    let heartbeatInterval;
    if (sessionId && isValidSession) {
      heartbeatInterval = setInterval(async () => {
        try {
          await markInProgress.mutateAsync(sessionId);
        } catch (_error) {
        }
      }, 5000);
    }

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [sessionId, isValidSession]);

  // Handle completion (after face verification on mobile)
  const handleVerificationComplete = async (data) => {
    setTransferError(null);
    try {
      await completeVerification.mutateAsync({
        sessionId,
        kycData: data,
      });
      setTransferSuccess(true);
    } catch (err) {
      setTransferError(err?.message || 'Failed to transfer data to desktop. Please try again.');
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mx-auto mb-4"></div>
          <p>Loading verification...</p>
        </div>
      </div>
    );
  }

  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-600 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Unavailable</h2>
          <p className="text-gray-600 mb-4">
            This verification session is no longer available. It may have been:
          </p>
          <ul className="text-left text-gray-600 mb-6 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Already completed by another device</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Currently being used on another phone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Expired (sessions are valid for 24 hours)</span>
            </li>
          </ul>
          <p className="text-sm text-gray-500 mb-6">
            Please return to your desktop and generate a new QR code.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg p-4">
        <div className="content-card max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-brand-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Mobile Device Required</h2>
          <p className="text-slate-400 mb-2">
            This verification process is designed for mobile devices. Please scan the QR code using your phone's camera.
          </p>
        </div>
      </div>
    );
  }

  if (transferSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Sent!</h2>
          <p className="text-gray-600 text-sm">
            Your information has been securely transferred to your desktop session. You can close this tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-bg overflow-x-hidden pt-safe pb-safe">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 max-w-2xl">
        {/* Mobile Header - Compact */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3 text-white sticky top-0 z-10 shadow-lg" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-xs sm:text-sm truncate">Mobile Verification</h1>
              <p className="text-[10px] sm:text-xs text-white/80 truncate">Complete KYC on your phone</p>
            </div>
          </div>
        </div>

        {transferError && (
          <div className="bg-red-500/90 text-white text-sm rounded-lg px-4 py-3 mb-3">
            {transferError}
            <button className="ml-3 underline text-white/80 text-xs" onClick={() => setTransferError(null)}>Dismiss</button>
          </div>
        )}

        {/* KYC Flow - Optimized spacing */}
        <div className="mobile-kyc-container pb-2 sm:pb-4">
        <KYCPage
          mobileMode={true}
          sessionId={sessionId}
          onComplete={handleVerificationComplete}
        />
        </div>
      </div>
    </div>
  );
}

