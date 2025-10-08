"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "../../components/ui/tooltip";
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
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const tabs = [
    { id: "kyc-submissions", label: "KYC Submissions", icon: Users, to: "/admin/kyc-submissions" },
    { id: "upload", label: "Upload", icon: Upload, to: "/admin/upload" },
    { id: "ocr", label: "OCR Processor", icon: ScanText, to: "/admin/ocr" },
];
const ContentWrapper = ({ children }) => (<motion.div key={Math.random()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="bg-white dark:bg-slate-800 shadow-lg rounded-2xl p-6 transition-all min-h-[400px] text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700">
    {children}
  </motion.div>
);

export function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const location = useLocation();

  const currentTitle = (() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length <= 1
      ? "kyc submissions"
      : parts[parts.length - 1].replace("-", " ");
  })();

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex bg-gray-900 text-white font-inter">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } flex flex-col shadow-md transition-all duration-300 border-r border-border bg-gray-900`}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h1
              className={`font-bold text-lg transition-all ${
                sidebarOpen ? "block text-white" : "hidden"
              }`}
            >
              Admin Dashboard
            </h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
              className="p-2 rounded-lg hover:bg-gray-800"
            >
              <Menu className="w-5 h-5 text-indigo-500/90" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 mt-4">
            <TooltipProvider>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  location.pathname === tab.to ||
                  location.pathname.startsWith(tab.to + "/");

                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={tab.to}
                        className={`nav-item ${
                          isActive ? "nav-row-active" : ""
                        }`}
                      >
                        {/* Icon */}
                        <span
                          className={`flex items-center justify-center w-8 h-8 rounded-lg mr-3 ${
                            isActive ? "nav-icon-active" : ""
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </span>

                        {/* Text */}
                        {sidebarOpen && <span>{tab.label}</span>}
                      </NavLink>
                    </TooltipTrigger>

                    {!sidebarOpen && (
                      <TooltipContent side="right">{tab.label}</TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 flex justify-between items-center px-8 py-4 border-b border-border bg-gray-900 shadow-sm">
            <h2 className="text-xl font-semibold capitalize">{currentTitle}</h2>
            <div className="flex items-center gap-4">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle theme"
                className={`w-16 h-8 rounded-full flex items-center px-1 transition-colors duration-200 ${
                  darkMode ? "bg-indigo-600" : "bg-indigo-500 hover:bg-indigo-400"
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

          {/* Body */}
          <section className="flex-1 p-8 bg-gray-900 transition-colors">
            <ContentWrapper>
              <Outlet />
            </ContentWrapper>
          </section>
        </main>
      </div>
    </div>
  );
}
