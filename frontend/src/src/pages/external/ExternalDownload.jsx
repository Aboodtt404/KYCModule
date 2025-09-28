import React, { useState } from "react";
import { Download, Loader2, CheckCircle, AlertCircle, FileText, Image as ImageIcon, File, } from "lucide-react";
const mockFiles = [
    {
        id: "1",
        name: "sample-document.pdf",
        size: "2.4 MB",
        type: "PDF Document",
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
    {
        id: "2",
        name: "sample-image.jpg",
        size: "1.2 MB",
        type: "JPEG Image",
        url: "https://picsum.photos/800/600",
    },
    {
        id: "3",
        name: "text-sample.txt",
        size: "15 KB",
        type: "Text File",
        url: "data:text/plain;charset=utf-8,This is a sample text file downloaded from an external source.",
    },
    {
        id: "4",
        name: "logo-sample.png",
        size: "45 KB",
        type: "PNG Image",
        url: "https://via.placeholder.com/400x200/4F46E5/FFFFFF?text=Sample+Logo",
    },
];
export function ExternalDownload() {
    const [downloadingFiles, setDownloadingFiles] = useState(new Set());
    const [downloadedFiles, setDownloadedFiles] = useState(new Set());
    const [failedFiles, setFailedFiles] = useState(new Set());
    const handleDownload = async (file) => {
        setDownloadingFiles((prev) => new Set(prev).add(file.id));
        setFailedFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(file.id);
            return newSet;
        });
        try {
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
            const response = await fetch(file.url);
            if (!response.ok)
                throw new Error(`HTTP error: ${response.status}`);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            setDownloadedFiles((prev) => new Set(prev).add(file.id));
        }
        catch (error) {
            console.error("Download failed:", error);
            setFailedFiles((prev) => new Set(prev).add(file.id));
        }
        finally {
            setDownloadingFiles((prev) => {
                const newSet = new Set(prev);
                newSet.delete(file.id);
                return newSet;
            });
        }
    };
    const getFileIcon = (type) => {
        if (type.includes("Image"))
            return <ImageIcon className="w-6 h-6 text-blue-500"/>;
        if (type.includes("PDF"))
            return <FileText className="w-6 h-6 text-red-500"/>;
        if (type.includes("Text"))
            return <FileText className="w-6 h-6 text-green-500"/>;
        return <File className="w-6 h-6 text-gray-400"/>;
    };
    const getStatus = (fileId) => {
        if (downloadingFiles.has(fileId)) {
            return { label: "Downloading", color: "bg-blue-500/20 text-blue-400", icon: <Loader2 className="w-4 h-4 animate-spin"/> };
        }
        if (downloadedFiles.has(fileId)) {
            return { label: "Downloaded", color: "bg-green-500/20 text-green-400", icon: <CheckCircle className="w-4 h-4"/> };
        }
        if (failedFiles.has(fileId)) {
            return { label: "Failed", color: "bg-red-500/20 text-red-400", icon: <AlertCircle className="w-4 h-4"/> };
        }
        return null;
    };
    return (<div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">External File Download</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Download files from external sources and mock endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockFiles.map((file) => {
            const status = getStatus(file.id);
            return (<div key={file.id} className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl shadow-sm p-5 flex flex-col justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">{getFileIcon(file.type)}</div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{file.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {file.type} • {file.size}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {status ? (<span className={`flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
                    {status.icon}
                    <span>{status.label}</span>
                  </span>) : (<span className="text-xs text-gray-500 dark:text-gray-400">Ready</span>)}

                <button onClick={() => handleDownload(file)} disabled={downloadingFiles.has(file.id)} className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${downloadingFiles.has(file.id)
                    ? "bg-gray-100 dark:bg-white/10 text-gray-400 cursor-not-allowed"
                    : failedFiles.has(file.id)
                        ? "bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-500"
                        : "bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500"}`}>
                  {downloadingFiles.has(file.id) ? (<Loader2 className="w-4 h-4 mr-2 animate-spin"/>) : (<Download className="w-4 h-4 mr-2"/>)}
                  {downloadingFiles.has(file.id)
                    ? "Downloading..."
                    : failedFiles.has(file.id)
                        ? "Retry"
                        : downloadedFiles.has(file.id)
                            ? "Download Again"
                            : "Download"}
                </button>
              </div>
            </div>);
        })}
      </div>
    </div>);
}
