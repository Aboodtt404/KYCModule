import React from 'react';
import { CheckCircle, Monitor } from 'lucide-react';
import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

export default function MobileTransferComplete() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-[60vh] flex items-center justify-center"
    >
      <GlassCard className="text-center space-y-6 max-w-md">
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="flex justify-center"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute -bottom-2 -right-2 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-900"
            >
              <Monitor className="w-6 h-6 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Mobile Verification Complete!
          </h2>
          <p className="text-sm sm:text-base text-gray-300">
            Your photos and documents have been captured successfully.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              1
            </div>
            <div className="text-left">
              <p className="text-sm text-white font-medium">Return to your desktop</p>
              <p className="text-xs text-gray-400">Go back to your computer</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              2
            </div>
            <div className="text-left">
              <p className="text-sm text-white font-medium">Review your information</p>
              <p className="text-xs text-gray-400">Complete the final review step on desktop</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              3
            </div>
            <div className="text-left">
              <p className="text-sm text-white font-medium">Submit for verification</p>
              <p className="text-xs text-gray-400">Your application will be processed</p>
            </div>
          </div>
        </div>

        {/* Status message */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-emerald-400">
            ✓ You can close this page now
          </p>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-500 italic">
          Note: This session cannot be reused. If you need to make changes, please start a new verification from your desktop.
        </p>
      </GlassCard>
    </motion.div>
  );
}

