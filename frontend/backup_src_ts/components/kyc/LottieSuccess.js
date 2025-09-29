"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import Lottie from "lottie-react";
/** Replace `successJson` with your imported JSON or prop */
import successJson from "../../lottie/success.json";
export default function LottieSuccess({ className = "w-36 h-36", }) {
    return (_jsx("div", { className: className, children: _jsx(Lottie, { animationData: successJson, loop: false }) }));
}
