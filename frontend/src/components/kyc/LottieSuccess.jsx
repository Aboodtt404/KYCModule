"use client";
import React from "react";
import Lottie from "lottie-react";
/** Replace `successJson` with your imported JSON or prop */
import successJson from "../../lottie/success.json";
export default function LottieSuccess({ className = "w-36 h-36", }) {
    return (<div className={className}>
      <Lottie animationData={successJson} loop={false}/>
    </div>);
}
