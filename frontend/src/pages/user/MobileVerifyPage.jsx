import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import KYCPage from './KYCPage';
import { CheckCircle, Smartphone } from 'lucide-react';
import { useVerifySession, useMarkVerificationInProgress, useCompleteVerification } from '@/hooks/useQueries';

export default function MobileVerifyPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isValidSession, setIsValidSession] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
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
      } catch (error) {
        console.error('Error validating session:', error);
        setIsValidSession(false);
      }
    };

    if (sessionId) {
      validateSession();
    } else {
      setIsValidSession(false);
    }

    // Send heartbeat to keep session alive
    let heartbeatInterval;
    if (sessionId && isValidSession) {
      heartbeatInterval = setInterval(async () => {
        try {
          await markInProgress.mutateAsync(sessionId);
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }, 5000); // Send heartbeat every 5 seconds
    }

    // Detect when user closes/leaves the page
    const handleBeforeUnload = async (e) => {
      try {
        // Mark session as cancelled when user leaves
        await fetch(`${window.location.origin}/api/cancel-session/${sessionId}`, {
          method: 'POST',
          keepalive: true, // Ensures request completes even if page closes
        });
      } catch (error) {
        console.error('Failed to cancel session:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && sessionId && isValidSession) {
        // User switched away or closed tab
        navigator.sendBeacon(
          `${window.location.origin}/api/cancel-session/${sessionId}`,
          JSON.stringify({ cancelled: true })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId, isValidSession]);

  // Handle completion (after face verification on mobile)
  const handleVerificationComplete = async (data) => {
    try {
      console.log('📤 Sending mobile data to server:', data);
      
      // Update backend with completion status
      await completeVerification.mutateAsync({
        sessionId,
        kycData: data,
      });

      // Don't navigate - show a "transfer complete" message instead
      // The user should go back to desktop to complete review
    } catch (error) {
      console.error('Error completing verification:', error);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
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
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <Smartphone className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Mobile Device Required</h2>
          <p className="text-gray-600 mb-6">
            This verification process is designed for mobile devices. Please scan the QR code using your phone's camera.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 overflow-x-hidden pt-safe pb-safe">
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

