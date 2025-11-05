import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Login } from "./pages/auth/Login";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import KYCPage from "./pages/user/KYCPage";
import MobileVerifyPage from "./pages/user/MobileVerifyPage";
import MobileSuccessPage from "./pages/user/MobileSuccessPage";
import { FileUpload } from "./pages/upload/FileUpload";
import { OCRProcessor } from "./pages/ocr/OCRProcessor";
import { KYCSubmissions } from "./pages/kyc/KYCSubmissions";
import { ImageProcessor } from "./pages/processor/ImageProcessor";
import { ExternalDownload } from "./pages/external/ExternalDownload";



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const router = createBrowserRouter(
  [
    { path: "/", element: <Login /> },
    {
      path: "/admin",
      element: <AdminDashboard />,
      children: [
        { index: true, element: <KYCSubmissions /> },
        { path: "upload", element: <FileUpload /> },
        { path: "ocr", element: <OCRProcessor /> },
        { path: "kyc-submissions", element: <KYCSubmissions /> },
      ],
    },
    { path: "/user", element: <KYCPage /> },
    { path: "/mobile-verify/:sessionId", element: <MobileVerifyPage /> },
    { path: "/mobile-verify/:sessionId/success", element: <MobileSuccessPage /> },
    { path: "*", element: <Login /> },
  ],
  
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
