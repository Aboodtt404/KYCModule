import React, { useState } from 'react';
import { Users, Trash2, Eye, CheckCircle, XCircle, Clock, Loader2, X } from 'lucide-react';
import { useKYCSubmissions, useDeleteKYCSubmission } from '../../hooks/useQueries';

export function KYCSubmissions() {
  const { data: submissions, isLoading, refetch } = useKYCSubmissions();
  const deleteSubmission = useDeleteKYCSubmission();
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const parseSubmissions = () => {
    if (!submissions || submissions.length === 0) return [];
    
    return submissions.map(([id, jsonData]) => {
      try {
        const data = JSON.parse(jsonData);
        // The backend stores data wrapped in { kycData: {...} }, so unwrap it
        if (data.kycData) {
          return { id, submissionId: id, ...data.kycData };
        }
        // Fallback for old format (if any)
        return { id, submissionId: id, ...data };
      } catch (e) {
        console.error('Failed to parse submission:', e);
        return { id, error: true, rawData: jsonData };
      }
    });
  };

  const handleDelete = async (submissionId) => {
    if (window.confirm('Are you sure you want to delete this KYC submission?')) {
      try {
        await deleteSubmission.mutateAsync(submissionId);
      } catch (error) {
        console.error('Failed to delete submission:', error);
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending_review': { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500', icon: Clock },
      'approved': { color: 'bg-green-500/20 text-green-300 border-green-500', icon: CheckCircle },
      'rejected': { color: 'bg-red-500/20 text-red-300 border-red-500', icon: XCircle },
    };

    const badge = badges[status] || badges['pending_review'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {status?.replace('_', ' ').toUpperCase() || 'PENDING'}
      </span>
    );
  };

  const parsedSubmissions = parseSubmissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading KYC submissions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Users className="w-7 h-7" />
            KYC Submissions
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {parsedSubmissions.length} total submission{parsedSubmissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Submissions List */}
      {parsedSubmissions.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No KYC submissions yet</h3>
          <p className="text-gray-400">Submissions will appear here once users complete verification</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y dark:divide-white/10">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Submission ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    National ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/10">
                {parsedSubmissions.map((submission, index) => (
                  <tr
                    key={submission.id || index}
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono truncate max-w-[150px] block">
                        {submission.submissionId || submission.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {submission.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.ocrData?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
                      {submission.ocrData?.national_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(submission.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {submission.timestamp ? new Date(submission.timestamp).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedSubmission(submission)}
                          className="text-blue-400 hover:text-blue-300"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(submission.submissionId || submission.id)}
                          disabled={deleteSubmission.isPending}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          title="Delete"
                        >
                          {deleteSubmission.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                KYC Submission Details
              </h3>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Submission ID</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {selectedSubmission.submissionId || selectedSubmission.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {selectedSubmission.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Submission Date</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {selectedSubmission.timestamp
                      ? new Date(selectedSubmission.timestamp).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Face Verified</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {selectedSubmission.faceVerified ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Document File</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {selectedSubmission.documentFile || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Extracted Data */}
              {selectedSubmission.ocrData && (
                <div className="border-t border-gray-200 dark:border-white/10 pt-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Extracted ID Data
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedSubmission.ocrData)
                      .filter(([key]) => key !== 'face_image')
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                            {value || 'N/A'}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

