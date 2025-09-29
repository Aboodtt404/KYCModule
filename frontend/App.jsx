import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Login } from "./src/pages/auth/Login";
import { AdminDashboard } from "./src/pages/admin/AdminDashboard";
import KYCPage from "./src/pages/user/KYCPage";
import { DocumentList } from "./src/pages/documents/DocumentList";
import { FileUpload } from "./src/pages/upload/FileUpload";
import { ImageProcessor } from "./src/pages/processor/ImageProcessor";
import { OCRRating } from "./src/pages/rating/OCRRating";
import { OCRProcessor } from "./src/pages/ocr/OCRProcessor";
import { ExternalDownload } from "./src/pages/external/ExternalDownload";

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
        { index: true, element: <DocumentList /> },
        { path: "documents", element: <DocumentList /> },
        { path: "upload", element: <FileUpload /> },
        { path: "processor", element: <ImageProcessor /> },
        { path: "rating", element: <OCRRating /> },
        { path: "ocr", element: <OCRProcessor /> },
        { path: "external", element: <ExternalDownload /> },
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
