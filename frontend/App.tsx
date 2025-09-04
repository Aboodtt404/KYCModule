import React, { useState } from 'react';
import { FileUpload } from './FileUpload'; // Ensure this path is correct
import { DocumentList } from './DocumentList';
import { ImageProcessor } from './ImageProcessor';
import { OCRRating } from './OCRRating'; // Fixed casing to match actual filename
import { ExternalDownload } from './ExternalDownload'; // Ensure this path is correct
import { OCRProcessor } from './OCRProcessor';
import { FileText, Upload, Image, Star, Download, Heart, ScanText } from 'lucide-react';

type ActiveTab = 'upload' | 'documents' | 'processor' | 'rating' | 'external' | 'ocr';

// BEGIN: Fix imports
// Ensure the paths are correct or the components exist
// END: Fix imports

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');

  const tabs = [
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'upload' as const, label: 'Upload', icon: Upload },
    { id: 'processor' as const, label: 'Image Processor', icon: Image },
    { id: 'rating' as const, label: 'OCR Rating', icon: Star },
    { id: 'ocr' as const, label: 'OCR Processor', icon: ScanText },
    { id: 'external' as const, label: 'External Download', icon: Download },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <FileUpload />;
      case 'documents':
        return <DocumentList />;
      case 'processor':
        return <ImageProcessor />;
      case 'rating':
        return <OCRRating />;
      case 'ocr':
        return <OCRProcessor />;
      case 'external':
        return <ExternalDownload />;
      default:
        return <DocumentList />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-800">Document Manager</h1>
            <p className="text-sm text-gray-600 mt-1">Upload, process & manage files</p>
          </div>
          
          <nav className="mt-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
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
        </div>
      </div>
    </div>
  );
}

export default App;
