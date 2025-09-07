import React, { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "./src/components/ui/tooltip";
 // shadcn/ui tooltip
// If the above import still fails, try updating the path to:
//
// } from "./components/ui/tooltip";
// or
// } from "../components/ui/tooltip";
//
// Make sure the tooltip.tsx file exists at the specified location.

import { FileUpload } from "./FileUpload";
import { DocumentList } from "./DocumentList";
import { ImageProcessor } from "./ImageProcessor";
import { OCRRating } from "./OCRRating";
import { ExternalDownload } from "./ExternalDownload";
import { OCRProcessor } from "./OCRProcessor";

import {
  FileText,
  Upload,
  Image,
  Star,
  Download,
  Heart,
  ScanText,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

// Sidebar tabs definition
const tabs = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "processor", label: "Image Processor", icon: Image },
  { id: "rating", label: "OCR Rating", icon: Star },
  { id: "ocr", label: "OCR Processor", icon: ScanText },
  { id: "external", label: "External Download", icon: Download },
] as const;

type ActiveTab = (typeof tabs)[number]["id"];

// Wrapper with animation
const ContentWrapper = ({ children }: { children: ReactNode }) => (
  <motion.div
    key={Math.random()} // ensures animation on tab change
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="bg-white dark:bg-gray-800 shadow-md rounded-2xl p-6 transition-all min-h-[400px]"
  >
    {children}
  </motion.div>
);

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("documents");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case "upload":
        return <FileUpload />;
      case "documents":
        return <DocumentList />;
      case "processor":
        return <ImageProcessor />;
      case "rating":
        return <OCRRating />;
      case "ocr":
        return <OCRProcessor />;
      case "external":
        return <ExternalDownload />;
      default:
        return <DocumentList />;
    }
  };

  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-all duration-300`}
        >
          {/* Logo / Title */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h1
              className={`font-bold text-lg text-gray-800 dark:text-gray-100 transition-all ${
                sidebarOpen ? "block" : "hidden"
              }`}
            >
              Document Manager
            </h1>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

<<<<<<< HEAD
          {/* Tabs */}
          <nav className="mt-4 flex-1">
            <TooltipProvider>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center px-6 py-3 mb-1 rounded-r-full transition-colors border-l-4 ${
                          activeTab === tab.id
                            ? "bg-blue-50 dark:bg-blue-900 border-blue-600 text-blue-700 dark:text-blue-200 font-semibold"
                            : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {sidebarOpen && <span className="ml-3">{tab.label}</span>}
                      </button>
                    </TooltipTrigger>
                    {!sidebarOpen && (
                      <TooltipContent side="right">
                        {tab.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
=======
          <nav className="mt-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-6 py-3 text-left transition-colors ${activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {tab.label}
                </button>
              );
            })}
>>>>>>> 6676e97842cd940129cd9e4f127d2536cb428636
          </nav>
        </div>

        {/* Main Content */}
<<<<<<< HEAD
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="px-8 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center sticky top-0 z-10">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 capitalize">
              {activeTab.replace("-", " ")}
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Search..."
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              />
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </header>

          {/* Dynamic Page */}
          <main className="flex-1 p-8 bg-gray-50 dark:bg-gray-900">
            <ContentWrapper>{renderContent()}</ContentWrapper>
          </main>

=======
        <div className="flex-1">
          <div className="p-8">
            {renderContent()}
          </div>

          {/* Footer */}
          <footer className="mt-auto p-6 text-center text-sm text-gray-500 border-t border-gray-200">
            © 2025. Built with <Heart className="inline w-4 h-4 text-red-500" /> using{' '}
            <a
              href="https://caffeine.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800"
            >
              caffeine.ai
            </a>
          </footer>
>>>>>>> 6676e97842cd940129cd9e4f127d2536cb428636
        </div>
      </div>
    </div>
  );
}

export default App;
