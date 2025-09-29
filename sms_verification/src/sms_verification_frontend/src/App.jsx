import { useState } from 'react';
 
import PhoneVerification from "./OTP_verification/phone_verification";
import OtpVerification from "./OTP_verification/OTP_verification";

export default function App() {
  const [step, setStep] = useState("phone");  
  const [phone, setPhone] = useState("");

  return (
    <>
      {step === "phone" && (
        <PhoneVerification onCodeSent={(p) => { setPhone(p); setStep("otp"); }} />
      )}
      {step === "otp" && (
        <OtpVerification phone={phone} onVerified={() => setStep("done")} />
      )}
      {step === "done" && (
        <div className="flex items-center justify-center min-h-screen">
          <h1 className="text-xl font-bold text-green-600">🎉 Phone Verified!</h1>
        </div>
      )}
    </>
  );
}
