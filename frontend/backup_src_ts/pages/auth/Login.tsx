import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Shield, ArrowRight, Moon, Sun } from "lucide-react";

export function Login() {
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  const handleUserLogin = () => {
    navigate("/user");
  };

  const handleAdminLogin = () => {
    navigate("/admin");
  };

  return (
    <div className={`${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Document Manager
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Choose your access level to continue
            </p>
          </div>

          {/* Login Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* User Login Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-slate-700 hover:shadow-xl hover:border-indigo-300 dark:hover:border-slate-600 transition-all duration-300 cursor-pointer group"
              onClick={handleUserLogin}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  User Access
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Upload and manage your documents with basic features
                </p>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    Upload Documents
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    View Document Library
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    Download Files
                  </div>
                </div>
                <button className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors flex items-center justify-center group">
                  Continue as User
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>

            {/* Admin Login Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-slate-700 hover:shadow-xl hover:border-purple-300 dark:hover:border-slate-600 transition-all duration-300 cursor-pointer group"
              onClick={handleAdminLogin}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Admin Access
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Full access to all features including advanced processing tools
                </p>
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    All User Features
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    Image Processing
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    OCR Processing
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2"></span>
                    Advanced Analytics
                  </div>
                </div>
                <button className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 dark:hover:bg-purple-500 transition-colors flex items-center justify-center group">
                  Continue as Admin
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex justify-center mt-8">
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
        </div>
      </div>
    </div>
  );
}
