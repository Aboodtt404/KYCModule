import { useState, useRef, useEffect } from "react";
import { sms_verification_backend } from "declarations/sms_verification_backend";

export default function OtpVerification({ phone, onVerified, onBack }) {
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [timer, setTimer] = useState(30); // 30-second timer
  const [resendEnabled, setResendEnabled] = useState(false);
  const inputsRef = useRef([]);

  // Countdown timer logic
  useEffect(() => {
    if (timer <= 0) {
      setResendEnabled(true);
      return;
    }
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < otp.length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setStatus("Enter a 6-digit code");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await sms_verification_backend.verify_otp(`${phone}`, code);
      if (response.success) {
        setStatus(" Verified successfully!");
        if (onVerified) onVerified();
      } else {
        setStatus(` ${response.message}`);
      }
    } catch (err) {
      console.error(err);
      setStatus("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setTimer(30);
      setResendEnabled(false);
      setStatus("Resending OTP...");
      await sms_verification_backend.send_sms(`${phone}`);
      setStatus("OTP resent!");
    } catch (err) {
      console.error(err);
      setStatus("Failed to resend OTP");
      setResendEnabled(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-100 shadow-lg rounded-[1.5rem] p-8 w-full max-w-md relative">

        {/* Back Button */}
        <div className="absolute top-4 left-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center border border-indigo-300 px-3 py-1.5 rounded-md text-gray-700 hover:bg-indigo-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span className="ml-2 font-bold text-lg">Back</span>
          </button>
        </div>

        {/* Title */}
        <h2 className="text-[1.8rem] font-bold text-center text-gray-700 mt-4 mb-3">Enter the code</h2>

        <p className="text-sm text-gray-500 text-center mb-8">
          We sent a 6-digit code to <span className="font-mono font-medium">{phone}</span>
        </p>

        {/* OTP Inputs */}
        <div className="flex justify-center gap-4 mb-6">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              type="text"
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="w-14 h-14 border border-gray-300 rounded-lg text-center text-lg font-medium focus:outline-none focus:border-blue-600 disabled:opacity-50"
            />
          ))}
        </div>

        {/* Timer and Resend */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">Resend in {timer}s</span>
          <button
            onClick={resendOtp}
            disabled={!resendEnabled}
            className={`text-blue-600 text-sm underline ${resendEnabled ? "hover:text-blue-800" : "text-gray-400 cursor-not-allowed"}`}
          >
            Resend OTP
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={verifyOtp}
          disabled={otp.join("").length < 6 || loading}
          className={`text-white w-full bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 flex items-center justify-center ${loading ? "bg-gray-400 cursor-not-allowed" : ""}`}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Verifying...
            </>
          ) : "Submit"}
        </button>

        {status && <p className="mt-4 text-sm text-center text-gray-600">{status}</p>}
      </div>
    </div>
  );
}
