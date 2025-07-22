import React, { useState } from 'react';
import { Download, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface MockFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
}

const mockFiles: MockFile[] = [
  {
    id: '1',
    name: 'sample-document.pdf',
    size: '2.4 MB',
    type: 'PDF Document',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  },
  {
    id: '2',
    name: 'sample-image.jpg',
    size: '1.2 MB',
    type: 'JPEG Image',
    url: 'https://picsum.photos/800/600'
  },
  {
    id: '3',
    name: 'text-sample.txt',
    size: '15 KB',
    type: 'Text File',
    url: 'data:text/plain;charset=utf-8,This is a sample text file downloaded from an external source.%0A%0AThis demonstrates the external download functionality of the document management system.%0A%0AThe file contains sample text that could be used for OCR testing or document processing.'
  },
  {
    id: '4',
    name: 'logo-sample.png',
    size: '45 KB',
    type: 'PNG Image',
    url: 'https://via.placeholder.com/400x200/4F46E5/FFFFFF?text=Sample+Logo'
  }
];

export function ExternalDownload() {
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());

  const handleDownload = async (file: MockFile) => {
    setDownloadingFiles(prev => new Set(prev).add(file.id));
    setFailedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.id);
      return newSet;
    });

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(downloadUrl);

      setDownloadedFiles(prev => new Set(prev).add(file.id));
    } catch (error) {
      console.error('Download failed:', error);
      setFailedFiles(prev => new Set(prev).add(file.id));
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('Image')) {
      return '🖼️';
    } else if (type.includes('PDF')) {
      return '📄';
    } else if (type.includes('Text')) {
      return '📝';
    }
    return '📁';
  };

  const getStatusIcon = (fileId: string) => {
    if (downloadingFiles.has(fileId)) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    } else if (downloadedFiles.has(fileId)) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (failedFiles.has(fileId)) {
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

  const getStatusText = (fileId: string) => {
    if (downloadingFiles.has(fileId)) {
      return 'Downloading...';
    } else if (downloadedFiles.has(fileId)) {
      return 'Downloaded';
    } else if (failedFiles.has(fileId)) {
      return 'Failed';
    }
    return '';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">External File Download</h2>
        <p className="text-gray-600">Download files from external sources and mock endpoints</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="flex items-center">
            <ExternalLink className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-900">
              Mock External File Server
            </span>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Simulating downloads from external HTTP endpoints
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {mockFiles.map((file) => (
            <div key={file.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">{getFileIcon(file.type)}</div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{file.name}</h3>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-gray-500">{file.type}</span>
                      <span className="text-xs text-gray-500">{file.size}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getStatusIcon(file.id) && (
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(file.id)}
                      <span className="text-xs text-gray-600">
                        {getStatusText(file.id)}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => handleDownload(file)}
                    disabled={downloadingFiles.has(file.id)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      downloadingFiles.has(file.id)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : downloadedFiles.has(file.id)
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : failedFiles.has(file.id)
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloadingFiles.has(file.id)
                      ? 'Downloading...'
                      : downloadedFiles.has(file.id)
                      ? 'Download Again'
                      : failedFiles.has(file.id)
                      ? 'Retry Download'
                      : 'Download'
                    }
                  </button>
                </div>
              </div>

              {failedFiles.has(file.id) && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    Download failed. Please check your connection and try again.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-gray-50 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {downloadedFiles.size} of {mockFiles.length} files downloaded
            </span>
            <span>
              {downloadingFiles.size > 0 && `${downloadingFiles.size} downloading...`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Demo Notice</h4>
            <p className="text-sm text-yellow-700 mt-1">
              This is a demonstration of external file download functionality. In a production environment, 
              you would integrate with real external APIs and file servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
