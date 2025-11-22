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

// Card wrapper
const ContentWrapper = ({ children }) => (
  <motion.div
    key={Math.random()}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="content-card"
  >
    {children}
  </motion.div>
);

export function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: closed by default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const location = useLocation();

  const currentTitle = (() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length <= 1
      ? "kyc submissions"
      : parts[parts.length - 1].replace("-", " ");
  })();

  // Close mobile menu when route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Auto-open sidebar on desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
        setMobileMenuOpen(false);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex bg-gray-900 text-white font-inter">
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-20"
          } ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } fixed md:static inset-y-0 left-0 z-50 flex flex-col shadow-md transition-all duration-300 border-r border-border bg-gray-900`}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
            <h1
              className={`font-bold text-base sm:text-lg transition-all ${
                sidebarOpen ? "block text-white" : "hidden"
              }`}
            >
              Admin Dashboard
            </h1>
            <button
              onClick={() => {
                setSidebarOpen(!sidebarOpen);
                setMobileMenuOpen(false);
              }}
              aria-label="Toggle sidebar"
              className="p-2 rounded-lg hover:bg-gray-800 active:bg-gray-700 touch-manipulation"
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
                        className={`nav-item touch-manipulation ${
                          isActive ? "nav-row-active" : ""
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
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
        <main className="flex-1 flex flex-col md:ml-0">
          {/* Header */}
          <header className="sticky top-0 z-30 flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-border bg-gray-900 shadow-sm">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
                className="md:hidden p-2 rounded-lg hover:bg-gray-800 active:bg-gray-700 touch-manipulation"
              >
                <Menu className="w-5 h-5 text-indigo-500/90" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold capitalize">{currentTitle}</h2>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle theme"
                className={`w-14 sm:w-16 h-7 sm:h-8 rounded-full flex items-center px-1 transition-colors duration-200 touch-manipulation ${
                  darkMode ? "bg-indigo-600" : "bg-indigo-500 hover:bg-indigo-400"
                }`}
              >
                <motion.div
                  initial={false}
                  animate={{ x: darkMode ? 28 : 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white shadow flex items-center justify-center"
                >
                  {darkMode ? (
                    <Moon className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" />
                  ) : (
                    <Sun className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
                  )}
                </motion.div>
              </button>
            </div>
          </header>

          {/* Body */}
          <section className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-900 transition-colors overflow-x-hidden">
            <ContentWrapper>
              <Outlet />
            </ContentWrapper>
          </section>
        </main>
      </div>
    </div>
  );
}
