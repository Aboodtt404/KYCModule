import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from './App';
import Verification from './OTP_verification/otp_verification';
import PhoneVerification from './OTP_verification/phone_verification';
import OtpVerification from './OTP_verification/otp_verification';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/verification" element={<PhoneVerification />} />
  
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
