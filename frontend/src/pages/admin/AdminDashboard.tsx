import React, { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "../../components/ui/tooltip";

import { FileUpload } from "../upload/FileUpload";
import { DocumentList } from "../documents/DocumentList";
import { ImageProcessor } from "../processor/ImageProcessor";
import { OCRRating } from "../rating/OCRRating";
import { ExternalDownload } from "../external/ExternalDownload";
import { OCRProcessor } from "../ocr/OCRProcessor";

import {
  FileText,
  Upload,
  Image,
  Star,
  Download,
  ScanText,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

const tabs = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "processor", label: "Image Processor", icon: Image },
  { id: "rating", label: "OCR Rating", icon: Star },
  { id: "ocr", label: "OCR Processor", icon: ScanText },
  { id: "external", label: "External Download", icon: Download },
] as const;

type ActiveTab = (typeof tabs)[number]["id"];

const ContentWrapper = ({ children }: { children: ReactNode }) => (
  <motion.div
    key={Math.random()}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="bg-white dark:bg-slate-800 shadow-lg rounded-2xl p-6 transition-all min-h-[400px] text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700"
  >
    {children}
  </motion.div>
);

export function AdminDashboard() {
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex text-gray-900 dark:text-white">
        {/* Sidebar */}
        <div
          className={`${sidebarOpen ? "w-64" : "w-20"
            } bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-lg flex flex-col transition-all duration-300`}
        >
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h1
              className={`font-bold text-lg text-gray-900 dark:text-white transition-all ${sidebarOpen ? "block" : "hidden"
                }`}
            >
              Admin Dashboard
            </h1>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <nav className="mt-4 flex-1">
            <TooltipProvider>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center px-6 py-3 mb-1 rounded-r-full transition-colors border-l-4 ${activeTab === tab.id
                          ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-semibold"
                          : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                          }`}
                      >
                        <Icon className="w-5 h-5" />
                        {sidebarOpen && <span className="ml-3">{tab.label}</span>}
                      </button>
                    </TooltipTrigger>
                    {!sidebarOpen && (
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <header className="px-8 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center sticky top-0 z-10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
              {activeTab.replace("-", " ")}
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-16 h-8 rounded-full flex items-center px-1 transition-colors duration-200 ${darkMode ? "bg-indigo-900" : "bg-gray-300"
                  }`}
              >
                <motion.div
                  initial={false}
                  animate={{ x: darkMode ? 32 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"
                >
                  {darkMode ? (
                    <Moon className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Sun className="w-4 h-4 text-yellow-500" />
                  )}
                </motion.div>
              </button>
            </div>
          </header>

          <main className="flex-1 p-8 bg-gray-50 dark:bg-gray-900">
            <ContentWrapper>{renderContent()}</ContentWrapper>
          </main>
        </div>
      </div>
    </div>
  );
}
