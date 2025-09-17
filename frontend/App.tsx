// src/App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Login } from "./src/pages/auth/Login";
import { AdminDashboard } from "./src/pages/admin/AdminDashboard";
import { KYCPage } from "./src/pages/user/KYCPage";

// admin child pages
import { DocumentList } from "./src/pages/documents/DocumentList";
import { FileUpload } from "./src/pages/upload/FileUpload";
import { ImageProcessor } from "./src/pages/processor/ImageProcessor";
import { OCRRating } from "./src/pages/rating/OCRRating";
import { OCRProcessor } from "./src/pages/ocr/OCRProcessor";
import { ExternalDownload } from "./src/pages/external/ExternalDownload";

// Create Query client (keep your previous config)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Admin area with nested routes */}
            <Route path="/admin" element={<AdminDashboard />}>
              {/* index -> /admin renders documents */}
              <Route index element={<DocumentList />} />
              <Route path="documents" element={<DocumentList />} />
              <Route path="upload" element={<FileUpload />} />
              <Route path="processor" element={<ImageProcessor />} />
              <Route path="rating" element={<OCRRating />} />
              <Route path="ocr" element={<OCRProcessor />} />
              <Route path="external" element={<ExternalDownload />} />
            </Route>

            {/* User area */}
            <Route path="/user" element={<KYCPage />} />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
