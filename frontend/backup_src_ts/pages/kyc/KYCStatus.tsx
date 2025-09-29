import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  User,
  FileText,
  Phone,
  Download
} from "lucide-react";

interface KYCStatusProps {
  status: "pending" | "document_uploaded" | "document_verified" | "otp_verified" | "completed" | "rejected";
  onStartVerification: () => void;
  onContinueToOTP: () => void;
  onDownloadCertificate: () => void;
}

export function KYCStatus({
  status,
  onStartVerification,
  onContinueToOTP,
  onDownloadCertificate
}: KYCStatusProps) {
  const getStatusInfo = () => {
    switch (status) {
      case "pending":
        return {
          icon: Clock,
          title: "KYC Verification Pending",
          description: "Complete your identity verification to access all features",
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          borderColor: "border-yellow-200 dark:border-yellow-800",
          action: "Start Verification",
          onAction: onStartVerification
        };
      case "document_uploaded":
        return {
          icon: FileText,
          title: "Document Uploaded",
          description: "Your document has been uploaded and is being processed",
          color: "text-indigo-600 dark:text-indigo-400",
          bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
          borderColor: "border-indigo-200 dark:border-indigo-800",
          action: "Continue to OTP",
          onAction: onContinueToOTP
        };
      case "document_verified":
        return {
          icon: CheckCircle,
          title: "Document Verified",
          description: "Your document has been verified. Complete OTP verification to finish",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
          action: "Continue to OTP",
          onAction: onContinueToOTP
        };
      case "otp_verified":
        return {
          icon: Shield,
          title: "OTP Verified",
          description: "Your identity has been verified. Finalizing your KYC status",
          color: "text-purple-600 dark:text-purple-400",
          bgColor: "bg-purple-50 dark:bg-purple-900/20",
          borderColor: "border-purple-200 dark:border-purple-800",
          action: "Processing...",
          onAction: () => { }
        };
      case "completed":
        return {
          icon: CheckCircle,
          title: "KYC Completed",
          description: "Your identity verification is complete. You can now access all features",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
          action: "Download Certificate",
          onAction: onDownloadCertificate
        };
      case "rejected":
        return {
          icon: AlertCircle,
          title: "Verification Rejected",
          description: "Your verification was rejected. Please contact support for assistance",
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-800",
          action: "Start New Verification",
          onAction: onStartVerification
        };
      default:
        return {
          icon: Clock,
          title: "Unknown Status",
          description: "Please refresh the page",
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-50 dark:bg-gray-900/20",
          borderColor: "border-gray-200 dark:border-gray-800",
          action: "Refresh",
          onAction: () => window.location.reload()
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const steps = [
    { id: "document", label: "Upload Document", completed: ["document_uploaded", "document_verified", "otp_verified", "completed"].includes(status) },
    { id: "verification", label: "Document Verification", completed: ["document_verified", "otp_verified", "completed"].includes(status) },
    { id: "otp", label: "OTP Verification", completed: ["otp_verified", "completed"].includes(status) },
    { id: "complete", label: "KYC Complete", completed: status === "completed" }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          KYC Verification Status
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          Track your identity verification progress
        </p>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-2xl p-8 mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 ${statusInfo.bgColor} rounded-full flex items-center justify-center`}>
              <Icon className={`w-8 h-8 ${statusInfo.color}`} />
            </div>
            <div>
              <h3 className={`text-2xl font-bold ${statusInfo.color} mb-2`}>
                {statusInfo.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-lg">
                {statusInfo.description}
              </p>
            </div>
          </div>
          <button
            onClick={statusInfo.onAction}
            disabled={status === "otp_verified"}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${status === "otp_verified"
              ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500"
              }`}
          >
            {statusInfo.action}
          </button>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Verification Steps
        </h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center p-4 rounded-xl border-2 transition-all ${step.completed
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${step.completed
                ? "bg-green-600 text-white"
                : "bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400"
                }`}>
                {step.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className={`font-medium ${step.completed
                  ? "text-green-800 dark:text-green-400"
                  : "text-gray-900 dark:text-white"
                  }`}>
                  {step.label}
                </h4>
                {step.completed && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Completed
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Additional Info */}
      {status === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6"
        >
          <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">
            What's Next?
          </h4>
          <ul className="space-y-2 text-blue-700 dark:text-blue-300">
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Access to all document management features
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Upload and process documents securely
            </li>
            <li className="flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Download your verification certificate
            </li>
          </ul>
        </motion.div>
      )}

      {status === "rejected" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6"
        >
          <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-3">
            Need Help?
          </h4>
          <p className="text-red-700 dark:text-red-300 mb-4">
            If your verification was rejected, please contact our support team for assistance.
          </p>
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Contact Support
            </button>
            <button className="px-4 py-2 border border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              View Guidelines
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
