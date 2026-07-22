import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MobileSuccessPage() {
  const { sessionId } = useParams();

  useEffect(() => {
    // Notify backend of completion
    const notifyCompletion = async () => {
      try {
        await fetch(`/api/verification-notify/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notified: true }),
        });
      } catch (_error) {
      }
    };

    notifyCompletion();
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
      >
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-6"
        >
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
        </motion.div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Verification Complete!
          </h2>
          <p className="text-gray-600 mb-8">
            Your identity verification has been successfully submitted. You can now return to your desktop.
          </p>
        </motion.div>

        {/* Return Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-blue-50 rounded-xl p-6"
        >
          <Monitor className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Return to Desktop</h3>
          <p className="text-sm text-gray-600">
            Your desktop browser has been notified and will automatically continue to the next step.
          </p>
        </motion.div>

        {/* Confetti Effect */}
        <div className="fixed inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-green-500 rounded-full"
              initial={{
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                scale: 0,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                scale: [1, 1.5, 0],
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: i * 0.1,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

