import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/admin/AdminDashboard.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, } from "../../components/ui/tooltip";
import { FileText, Upload, Image, Star, Download, ScanText, Menu, Moon, Sun, } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
const tabs = [
    { id: "documents", label: "Documents", icon: FileText, to: "/admin/documents" },
    { id: "upload", label: "Upload", icon: Upload, to: "/admin/upload" },
    { id: "processor", label: "Image Processor", icon: Image, to: "/admin/processor" },
    { id: "rating", label: "OCR Rating", icon: Star, to: "/admin/rating" },
    { id: "ocr", label: "OCR Processor", icon: ScanText, to: "/admin/ocr" },
    { id: "external", label: "External Download", icon: Download, to: "/admin/external" },
];
const ContentWrapper = ({ children }) => (_jsx(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.3 }, className: "bg-white dark:bg-slate-800 shadow-lg rounded-2xl p-6 transition-all min-h-[400px] text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700", children: children }, Math.random()));
export function AdminDashboard() {
    // sidebar / theme local UI state kept
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const location = useLocation();
    const currentTitle = (() => {
        const parts = location.pathname.split("/").filter(Boolean);
        if (parts.length <= 1)
            return "documents";
        return parts[parts.length - 1].replace("-", " ");
    })();
    return (_jsx("div", { className: `${darkMode ? "dark" : ""}`, children: _jsxs("div", { className: "min-h-screen bg-gray-100 dark:bg-gray-900 flex text-gray-900 dark:text-white", children: [_jsxs("div", { className: `${sidebarOpen ? "w-64" : "w-20"} bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 shadow-lg flex flex-col transition-all duration-300`, children: [_jsxs("div", { className: "p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between", children: [_jsx("h1", { className: `font-bold text-lg text-gray-900 dark:text-white transition-all ${sidebarOpen ? "block" : "hidden"}`, children: "Admin Dashboard" }), _jsx("button", { className: "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700", onClick: () => setSidebarOpen(!sidebarOpen), "aria-label": "Toggle sidebar", children: _jsx(Menu, { className: "w-5 h-5 text-gray-600 dark:text-gray-300" }) })] }), _jsx("nav", { className: "mt-4 flex-1", children: _jsx(TooltipProvider, { children: tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(NavLink, { to: tab.to, className: ({ isActive }) => `w-full flex items-center px-6 py-3 mb-1 rounded-r-full transition-colors border-l-4 ${isActive
                                                        ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-semibold"
                                                        : "border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"}`, children: [_jsx(Icon, { className: "w-5 h-5" }), sidebarOpen && _jsx("span", { className: "ml-3", children: tab.label })] }) }), !sidebarOpen && _jsx(TooltipContent, { side: "right", children: tab.label })] }, tab.id));
                                }) }) })] }), _jsxs("div", { className: "flex-1 flex flex-col", children: [_jsxs("header", { className: "px-8 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center sticky top-0 z-10", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 dark:text-white capitalize", children: currentTitle }), _jsx("div", { className: "flex items-center gap-4", children: _jsx("button", { onClick: () => setDarkMode(!darkMode), className: `w-16 h-8 rounded-full flex items-center px-1 transition-colors duration-200 ${darkMode ? "bg-indigo-900" : "bg-gray-300"}`, "aria-label": "Toggle theme", children: _jsx(motion.div, { initial: false, animate: { x: darkMode ? 32 : 0 }, transition: { duration: 0.2, ease: "easeInOut" }, className: "w-6 h-6 rounded-full bg-white shadow flex items-center justify-center", children: darkMode ? _jsx(Moon, { className: "w-4 h-4 text-indigo-600" }) : _jsx(Sun, { className: "w-4 h-4 text-yellow-500" }) }) }) })] }), _jsx("main", { className: "flex-1 p-8 bg-gray-50 dark:bg-gray-900", children: _jsx(ContentWrapper, { children: _jsx(Outlet, {}) }) })] })] }) }));
}
