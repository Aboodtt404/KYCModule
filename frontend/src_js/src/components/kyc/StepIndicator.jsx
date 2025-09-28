"use client";
import React from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
export default function StepIndicator({ step, total, }) {
    return (<div className="mt-8">
      {/* Step Dots */}
      <div className="flex items-center justify-center space-x-3 mb-4">
        {Array.from({ length: total }, (_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < step;
            const isCurrent = stepNumber === step;
            return (<div key={stepNumber} className="flex items-center">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: isCurrent ? 1.1 : 1 }} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${isCompleted
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                {isCompleted ? (<CheckCircle className="w-5 h-5"/>) : (<span className="text-sm font-semibold">{stepNumber}</span>)}
              </motion.div>
              
              {/* Connector Line */}
              {index < total - 1 && (<div className={`w-8 h-0.5 mx-2 ${stepNumber < step
                        ? "bg-emerald-500"
                        : "bg-gray-200 dark:bg-gray-700"}`}/>)}
            </div>);
        })}
      </div>
      
      {/* Step Text */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Step {step} of {total}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {step === 1 && "Phone Verification"}
          {step === 2 && "Document Upload"}
          {step === 3 && "Review Information"}
          {step === 4 && "Selfie Capture"}
          {step === 5 && "Final Review"}
          {step === 6 && "Verification Complete"}
        </p>
      </div>
    </div>);
}
