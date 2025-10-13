import React, { useState } from "react";
import {
  FileText,
  Image,
  Download,
  Trash2,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import { useDocuments, useDeleteDocument } from "../../hooks/useQueries";
import { useFileList } from "../../components/shared/FileList";
import { formatFileSize } from "../../utils/formatFileSize";

const getFileIcon = (mimeType) =>
  mimeType.startsWith("image/") ? (
    <Image className="w-5 h-5 text-indigo-400" />
  ) : (
    <FileText className="w-5 h-5 text-gray-400" />
  );

const isImage = (mimeType) => mimeType.startsWith("image/");

export function DocumentList() {
  const {
    data: documents,
    isLoading,
    isFetching,
    refetch,
  } = useDocuments();

  const { getFileUrl } = useFileList();
  const deleteDocumentMutation = useDeleteDocument();

  const [selectedFile, setSelectedFile] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());

  // Preview
  const handlePreview = async (file) => {
    if (!isImage(file.mimeType)) return;
    setLoadingPreview(true);
    try {
      const url = await getFileUrl(file);
      setPreviewUrl(url);
      setSelectedFile(file);
    } catch (error) {
      console.error("Failed to load preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Download
  const handleDownload = async (file) => {
    setDownloadingFiles((prev) => new Set(prev).add(file.path));
    try {
      const url = await getFileUrl(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.path;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download file:", error);
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  };

  // Delete
  const handleDelete = async (file) => {
    if (window.confirm(`Are you sure you want to delete "${file.path}"?`)) {
      try {
        await deleteDocumentMutation.mutateAsync(file.path);
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    }
  };

  const closePreview = () => {
    setSelectedFile(null);
    setPreviewUrl("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-300">Loading documents...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto font-inter px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Document Library
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            {documents?.length || 0} documents in your collection
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center text-sm sm:text-base ${
            isFetching
              ? "bg-indigo-300 text-white cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-500 to-indigo-700 text-white hover:shadow-lg"
          }`}
        >
          {isFetching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Refreshing...
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {/* Empty State */}
      {!documents || documents.length === 0 ? (
        <div className="bg-slate-800/60 backdrop-blur-md rounded-lg shadow-lg border border-white/10 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No documents yet
          </h3>
          <p className="text-gray-400 text-sm">
            Upload your first document to get started
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-slate-800/60 backdrop-blur-md rounded-lg shadow-lg border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {documents.map((file, index) => (
                    <tr
                      key={`${file.path}-${index}`}
                      className="hover:bg-slate-900/40"
                    >
                      <td className="px-6 py-4 whitespace-nowrap flex items-center text-white">
                        {getFileIcon(file.mimeType)}
                        <span className="ml-3 text-sm font-medium">
                          {file.path}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {file.mimeType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex space-x-2">
                        {isImage(file.mimeType) && (
                          <button
                            onClick={() => handlePreview(file)}
                            disabled={loadingPreview}
                            className="p-2 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/50 disabled:opacity-50 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={downloadingFiles.has(file.path)}
                          className="px-3 py-1.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all flex items-center"
                        >
                          {downloadingFiles.has(file.path) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span className="ml-1 text-xs">Download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(file)}
                          disabled={deleteDocumentMutation.isPending}
                          className="p-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-slate-700/50 disabled:opacity-50 transition-all"
                        >
                          {deleteDocumentMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="grid gap-4 md:hidden">
            {documents.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                className="bg-slate-800/60 backdrop-blur-md rounded-lg p-4 border border-white/10 shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getFileIcon(file.mimeType)}
                    <span className="ml-3 text-white text-sm font-medium">
                      {file.path}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>{file.mimeType}</span>
                  <div className="flex space-x-2">
                    {isImage(file.mimeType) && (
                      <button
                        onClick={() => handlePreview(file)}
                        disabled={loadingPreview}
                        className="p-2 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/50 disabled:opacity-50 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={downloadingFiles.has(file.path)}
                      className="p-2 rounded-lg text-indigo-500 hover:text-indigo-400 hover:bg-slate-700/50 disabled:opacity-50 transition-all"
                    >
                      {downloadingFiles.has(file.path) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={deleteDocumentMutation.isPending}
                      className="p-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-slate-700/50 disabled:opacity-50 transition-all"
                    >
                      {deleteDocumentMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {selectedFile && previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/80 backdrop-blur-md rounded-xl max-w-4xl w-full max-h-full overflow-auto border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm sm:text-lg font-medium text-white">
                {selectedFile.path}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  disabled={downloadingFiles.has(selectedFile.path)}
                  className="px-3 py-1.5 rounded-xl text-xs sm:text-sm text-white bg-gradient-to-r from-indigo-500 to-indigo-700 hover:shadow-lg disabled:opacity-50 transition-all flex items-center"
                >
                  {downloadingFiles.has(selectedFile.path) ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-slate-700/50 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <img
                src={previewUrl}
                alt={selectedFile.path}
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
