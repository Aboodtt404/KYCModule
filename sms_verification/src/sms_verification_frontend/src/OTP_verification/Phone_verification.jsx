import { useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import OtpVerification from "./OTP_verification"; 
import { sms_verification_backend } from "declarations/sms_verification_backend";

export default function Verification() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("");
  const [step, setStep] = useState("phone");

  const sendVerificationCode = async () => {
    if (!phone) {
      setStatus("Please enter a valid phone number");
      return;
    }

    try {
      const response = await sms_verification_backend.send_sms(`+${phone}`);
      console.log("Canister response:", response);

      
      const success = response === true || response?.success === true;

      if (success) {
        setStatus("");
        setStep("otp"); 
      } else {
        const message = response?.message || "Failed to send SMS";
        setStatus(` ${message}`);
      }
    } catch (error) {
      console.error("Error calling backend:", error);
      setStatus(" Error connecting to backend");
    }
  };


  if (step === "otp") {
    return (
      <OtpVerification
        phone={`+${phone}`}
        onVerified={() => { /* do nothing */ }}
        onBack={() => setStep("phone")}
      />
    );
  }

 
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-100 shadow-lg rounded-[1.5rem] p-8 w-full max-w-md">
        <h2 className="text-3xl font-semibold text-center text-gray-700 mb-6">
          Phone Verification
        </h2>

        <div className="flex justify-center mb-4">
          <PhoneInput
            country="us"
            value={phone}
            onChange={setPhone}
            containerClass="!w-auto"
            inputClass="!h-12 !text-lg !rounded-lg !pl-14 w-64"
          />
        </div>

        <p className="text-sm text-gray-500 text-center mb-4">
          We will send you an SMS with a verification code.
        </p>

        <button
          type="button"
          onClick={sendVerificationCode}
          className="text-white w-full bg-blue-700 hover:bg-blue-800 
                     focus:ring-4 focus:ring-blue-300 font-medium 
                     rounded-lg text-sm px-5 py-2.5"
        >
          Send verification code
        </button>

        {status && <p className="mt-4 text-sm text-center text-gray-600">{status}</p>}
      </div>
    </div>
  );
}
