import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="dark min-h-screen app-bg text-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-7 h-7 text-purple-600" />
          <h1 className="text-2xl font-bold">Privacy Policy</h1>
        </div>

        <p className="text-sm text-gray-500 mb-6">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="font-semibold text-base mb-2">1. Data We Collect</h2>
            <p>To complete identity verification (KYC), we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>Your phone number (for OTP verification)</li>
              <li>A photo of your Egyptian National ID or passport</li>
              <li>A live selfie photo captured and processed on your device for face verification — this image is never uploaded to our servers</li>
              <li>Extracted data: full name, national ID number, date of birth, gender, governorate, and address</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">2. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>To verify your identity as required by applicable regulations</li>
              <li>To prevent duplicate or fraudulent submissions</li>
              <li>To display your verification status to you</li>
              <li>Your face image is processed locally to produce a verification result — the result (match/no-match) is stored, not the raw biometric</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">3. Data Storage</h2>
            <p>All submitted data is stored on the <strong>Internet Computer Protocol (ICP)</strong> blockchain inside a canister controlled by Mercatura Forum. On-chain data is encrypted at rest by ICP's node architecture.</p>
            <p className="mt-2">Your identity document image (National ID or passport) is uploaded to the ICP canister during OCR processing and stored until you delete it or your submission is removed.</p>
            <p className="mt-2">OCR processing is performed by a server operated by Mercatura Forum. A copy of the image is sent to this server and deleted immediately after text extraction is complete.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">4. Data Retention</h2>
            <p>KYC submission records are retained for a minimum of 5 years to comply with anti-money laundering (AML) regulations. You may request deletion after the mandatory retention period by contacting us.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">5. Your Rights</h2>
            <p>Under applicable data protection laws you have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700 dark:text-gray-300">
              <li>Access the data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion (subject to legal retention requirements) — use our <a href="/delete-my-data" className="text-indigo-600 dark:text-indigo-400 underline">Delete My Data</a> page to submit a request</li>
              <li>Object to processing for direct marketing</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">6. Contact</h2>
            <p>For any data protection enquiries, contact: <a href="mailto:privacy@mercaturaforum.com" className="text-indigo-600 dark:text-indigo-400 underline">privacy@mercaturaforum.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
