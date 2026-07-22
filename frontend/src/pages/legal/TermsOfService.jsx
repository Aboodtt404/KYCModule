import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="dark min-h-screen app-bg text-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-7 h-7 text-indigo-600" />
          <h1 className="text-2xl font-bold">Terms of Service</h1>
        </div>

        <p className="text-sm text-gray-500 mb-6">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="font-semibold text-base mb-2">1. Acceptance</h2>
            <p>By using the KYC verification service provided by Mercatura Forum ("we", "us"), you agree to these Terms. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">2. Purpose</h2>
            <p>This service is used solely to verify your identity for the purpose of onboarding to Mercatura Forum's platform. You must provide accurate, complete, and current information.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">3. Prohibited Use</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
              <li>You must not submit false, stolen, or altered identity documents</li>
              <li>You must not attempt to bypass the face verification step</li>
              <li>You must not submit more than one verification per person</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">4. Biometric Data Consent</h2>
            <p>If you choose to complete face verification, you explicitly consent to the capture and processing of your facial biometric data for the sole purpose of identity verification. You may decline face verification; doing so may affect your access level.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">5. Verification Decisions</h2>
            <p>Mercatura Forum reserves the right to approve or reject any KYC submission at its sole discretion. We are not obligated to provide reasons for rejection.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">6. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Mercatura Forum is not liable for any indirect, incidental, or consequential damages arising from use of this service.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">7. Governing Law</h2>
            <p>These Terms are governed by the laws of the Arab Republic of Egypt. Any disputes shall be resolved in the courts of Cairo, Egypt.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">8. Contact</h2>
            <p>Questions about these Terms: <a href="mailto:legal@mercaturaforum.com" className="text-indigo-600 dark:text-indigo-400 underline">legal@mercaturaforum.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
