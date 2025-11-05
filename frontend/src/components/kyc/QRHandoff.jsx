import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, ArrowRight, CheckCircle, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVerificationStatus } from '@/hooks/useQueries';

export default function QRHandoff({ sessionId, onComplete }) {
  const [currentStatus, setCurrentStatus] = useState('waiting'); // 'waiting', 'in_progress', 'completed', 'cancelled'
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now());
  
  // useQuery now handles polling automatically
  const { data: sessionData, error } = useVerificationStatus(sessionId);

  const mobileUrl = `${window.location.origin}/mobile-verify/${sessionId}`;

  useEffect(() => {
    console.log('📊 Desktop polling status:', sessionData);

    if (sessionData) {
      if (sessionData.status === 'in_progress') {
        // Only update to in_progress if not already completed
        setCurrentStatus(prev => prev === 'completed' ? prev : 'in_progress');
        setLastHeartbeat(Date.now());
      } else if (sessionData.status === 'completed') {
        console.log('✅ Mobile verification completed, transferring to desktop...');
        setCurrentStatus('completed');
        setTimeout(() => {
          onComplete(sessionData);
        }, 1000);
      } else if (sessionData.status === 'cancelled') {
        // Only set to cancelled if not already completed
        setCurrentStatus(prev => prev === 'completed' ? prev : 'cancelled');
      }
    }
    
    if (error) {
        console.error('Error checking status:', error);
    }
  }, [sessionData, onComplete, error]);

  // Detect timeout (no heartbeat for 15 seconds)
  useEffect(() => {
    // Only check for timeout when in 'in_progress' state
    // Don't check if completed or already cancelled
    if (currentStatus !== 'in_progress') return;

    const timeoutCheck = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceLastHeartbeat > 15000) {
        console.log('⚠️ Heartbeat timeout detected - mobile may have disconnected');
        // Only set to cancelled if still in progress (not completed)
        setCurrentStatus(prev => prev === 'in_progress' ? 'cancelled' : prev);
      }
    }, 2000);

    return () => clearInterval(timeoutCheck);
  }, [currentStatus, lastHeartbeat]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Continue on Your Phone
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Scan the QR code below to complete verification on your mobile device
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            currentStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
            currentStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            currentStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
            'bg-green-100 text-green-800'
          }`}>
            {currentStatus === 'waiting' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium">Waiting for scan</span>
              </>
            )}
            {currentStatus === 'in_progress' && (
              <>
                <Smartphone className="w-4 h-4" />
                <span className="font-medium">Verification in progress</span>
              </>
            )}
            {currentStatus === 'completed' && (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Completed!</span>
              </>
            )}
            {currentStatus === 'cancelled' && (
              <>
                <X className="w-4 h-4" />
                <span className="font-medium">Session cancelled</span>
              </>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {formatTime(timeElapsed)}
          </div>
        </div>

        {/* Cancelled Message */}
        {currentStatus === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-center">
              <strong>Mobile session disconnected.</strong><br/>
              The user closed the browser or lost connection. Please start verification again.
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-12 mb-8">
          {/* Desktop Illustration */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeWidth="2"/>
                <line x1="8" y1="21" x2="16" y2="21" strokeWidth="2"/>
                <line x1="12" y1="17" x2="12" y2="21" strokeWidth="2"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Desktop</p>
          </motion.div>

          {/* QR Code */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="bg-white p-6 rounded-2xl shadow-lg border-4 border-blue-500">
              <QRCodeSVG
                value={mobileUrl}
                size={240}
                level="H"
                includeMargin={true}
              />
            </div>
            {currentStatus === 'completed' && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-green-500/90 rounded-2xl flex items-center justify-center"
              >
                <CheckCircle className="w-20 h-20 text-white" />
              </motion.div>
            )}
          </motion.div>

          {/* Arrow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <ArrowRight className="w-12 h-12 text-blue-500" />
          </motion.div>

          {/* Mobile Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <Smartphone className="w-12 h-12 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</p>
          </motion.div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            📱 How to continue:
          </h3>
          <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span>Open your phone's camera app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span>Point it at the QR code above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>Tap the notification to open the verification link</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <span>Complete the verification on your phone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
              <span>This page will automatically update when you're done</span>
            </li>
          </ol>
        </div>

        {/* Alternative Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Can't scan? Copy this link to your phone:
          </p>
          <div className="flex items-center gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={mobileUrl}
              readOnly
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(mobileUrl);
                alert('Link copied to clipboard!');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

