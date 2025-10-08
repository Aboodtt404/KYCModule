import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Login } from "./src/pages/auth/Login";
import { AdminDashboard } from "./src/pages/admin/AdminDashboard";
import KYCPage from "./src/pages/user/KYCPage";
import { FileUpload } from "./src/pages/upload/FileUpload";
import { OCRProcessor } from "./src/pages/ocr/OCRProcessor";
import { KYCSubmissions } from "./src/pages/kyc/KYCSubmissions";

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
        { index: true, element: <FileUpload /> },
        { path: "upload", element: <FileUpload /> },
        { path: "ocr", element: <OCRProcessor /> },
        { path: "kyc-submissions", element: <KYCSubmissions /> },
      ],
    },
    { path: "/user", element: <KYCPage /> },
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
