import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";

import { Login } from "./pages/auth/Login";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import KYCPage from "./pages/user/KYCPage";
import KYCStatusPage from "./pages/user/KYCStatusPage";
import MobileVerifyPage from "./pages/user/MobileVerifyPage";
import MobileSuccessPage from "./pages/user/MobileSuccessPage";
import { FileUpload } from "./pages/upload/FileUpload";
import { DocumentList } from "./pages/documents/DocumentList";
import { OCRProcessor } from "./pages/ocr/OCRProcessor";
import { KYCSubmissions } from "./pages/kyc/KYCSubmissions";
import { AuditLog } from "./pages/admin/AuditLog";
import { StatsPage } from "./pages/admin/StatsPage";
import { ApiClients } from "./pages/admin/ApiClients";
import DeveloperPortal from "./pages/developers/DeveloperPortal";
import HostedVerifyPage from "./pages/user/HostedVerifyPage";
import { ImageProcessor } from "./pages/processor/ImageProcessor";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import DeleteMyData from "./pages/legal/DeleteMyData";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import DemoBanner from "./components/DemoBanner";



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
        { index: true, element: <StatsPage /> },
        { path: "stats", element: <StatsPage /> },
        { path: "upload", element: <FileUpload /> },
        { path: "documents", element: <DocumentList /> },
        { path: "ocr", element: <OCRProcessor /> },
        { path: "kyc-submissions", element: <KYCSubmissions /> },
        { path: "audit-log", element: <AuditLog /> },
        { path: "api-clients", element: <ApiClients /> },
      ],
    },
    { path: "/user",   element: <KYCPage /> },
    { path: "/developers", element: <DeveloperPortal /> },
    { path: "/developer", element: <Navigate to="/developers" replace /> },
    { path: "/verify/:sessionId", element: <HostedVerifyPage /> },
    { path: "/status", element: <KYCStatusPage /> },
    { path: "/mobile-verify/:sessionId", element: <MobileVerifyPage /> },
    { path: "/mobile-verify/:sessionId/success", element: <MobileSuccessPage /> },
    { path: "/privacy",          element: <PrivacyPolicy /> },
    { path: "/terms",            element: <TermsOfService /> },
    { path: "/delete-my-data",  element: <DeleteMyData /> },
    { path: "*", element: <NotFound /> },
  ],
  
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <DemoBanner />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
