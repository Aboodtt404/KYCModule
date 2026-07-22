import React, { useState } from 'react';
import { Users, Trash2, Eye, CheckCircle, XCircle, Clock, Loader2, X, ChevronLeft, ChevronRight, Download, Mail, MailX } from 'lucide-react';
import { countryCodeToName } from '../../utils/countries';
import { useKYCSubmissionsPage, useDeleteKYCSubmission, useUpdateKYCStatus } from '../../hooks/useQueries';
import { useActor } from '../../hooks/useActor';

const PAGE_SIZE = 20;

export function KYCSubmissions() {
  const [page, setPage] = useState(0);
  const { data, isLoading, refetch } = useKYCSubmissionsPage(PAGE_SIZE, page * PAGE_SIZE);
  const submissions = data?.items ?? [];
  const totalCount  = data?.total ?? 0;
  const totalPages  = Math.ceil(totalCount / PAGE_SIZE);

  const { actor } = useActor();
  const [exporting, setExporting] = useState(false);
  const deleteSubmission = useDeleteKYCSubmission();
  const updateStatus = useUpdateKYCStatus();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [emailNotifyMap, setEmailNotifyMap] = useState({});

  const exportCSV = async () => {
    if (!actor || exporting) return;
    setExporting(true);
    try {
      const PAGE = 100n;
      let offset = 0n;
      let all = [];
      while (true) {
        const [, items] = await actor.get_kyc_submissions_page(PAGE, offset);
        if (!items || items.length === 0) break;
        all = all.concat(items);
        offset += PAGE;
        if (items.length < Number(PAGE)) break;
      }

      const rows = all.map(([id, json]) => {
        try {
          const d = JSON.parse(json);
          const kyc = d.kycData || d;
          const ocr = kyc.ocrData || {};
          return [
            id,
            kyc.timestamp || '',
            kyc.phone || '',
            ocr.full_name || '',
            ocr.national_id || '',
            ocr.birth_date || '',
            ocr.gender || '',
            ocr.governorate || '',
            ocr.address || '',
            ocr.serial_number || '',
            ocr.marital_status || '',
            ocr.occupation || '',
            ocr.issue_date || '',
            ocr.expiry_date || '',
            kyc.faceVerified ? 'Yes' : 'No',
            kyc.status || 'pending_review',
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        } catch { return `"${id}","parse error"`; }
      });

      const header = 'Submission ID,Timestamp,Phone,Full Name,National ID,Birth Date,Gender,Governorate,Address,Serial Number,Marital Status,Occupation,Issue Date,Expiry Date,Face Verified,Status';
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kyc-submissions-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = async (submissionId, status) => {
    try {
      setStatusError(null);
      const { emailSent } = await updateStatus.mutateAsync({ submissionId, status });
      setEmailNotifyMap(prev => ({ ...prev, [submissionId]: emailSent }));
      refetch();
      if (!emailSent) {
        setStatusError(
          `Status updated to "${status}" but the notification email could not be sent. ` +
          `Check that the email is configured (configure_email) and the user provided an email address.`
        );
      }
    } catch (error) {
      setStatusError(`Failed to update status: ${error.message}`);
    }
  };

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
      } catch (_e) {
        return { id, error: true, rawData: jsonData };
      }
    });
  };

  const handleDelete = async (submissionId) => {
    if (window.confirm('Are you sure you want to delete this KYC submission?')) {
      try {
        await deleteSubmission.mutateAsync(submissionId);
      } catch (_error) {
        // delete failure silently ignored — mutation error state handles retry
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading KYC submissions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {statusError && (
        <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 mb-4 text-sm text-red-700 dark:text-red-300">
          <span>{statusError}</span>
          <button onClick={() => setStatusError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-200">✕</button>
        </div>
      )}
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Users className="w-7 h-7" />
            KYC Submissions
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {totalCount} total submission{totalCount !== 1 ? 's' : ''}
            {totalPages > 1 && ` — page ${page + 1} of ${totalPages}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
 onClick={exportCSV}
 disabled={!actor || exporting || totalCount === 0}
 className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-500 transition-colors disabled:opacity-40 text-sm"
 >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            onClick={() => refetch()}
            className="bg-slate-800 text-slate-100 border border-slate-700 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
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
                    Review
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
                      {submission.phone || '—'}
                      {submission.phoneVerified === false && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                          unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {submission.ocrData?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
                      {submission.ocrData?.national_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(submission.status)}
                        {emailNotifyMap.hasOwnProperty(submission.submissionId || submission.id) && (
                          emailNotifyMap[submission.submissionId || submission.id]
                            ? <Mail className="w-3.5 h-3.5 text-green-400 flex-shrink-0" title="Notification email sent" />
                            : <MailX className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" title="Email not sent — user may have no email address" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {submission.timestamp ? new Date(submission.timestamp).toLocaleDateString() : 'N/A'}
                    </td>
                    {/* Approve / Reject */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleStatusChange(submission.submissionId || submission.id, 'approved')}
                          disabled={submission.status === 'approved' || updateStatus.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl bg-green-600/20 text-green-400 hover:bg-green-600/40 disabled:opacity-30 text-xs font-semibold"
                          title="Approve"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(submission.submissionId || submission.id, 'rejected')}
                          disabled={submission.status === 'rejected' || updateStatus.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/40 disabled:opacity-30 text-xs font-semibold"
                          title="Reject"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-sm text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 text-sm disabled:opacity-30 hover:bg-white/20"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-gray-400">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-sm disabled:opacity-30 hover:bg-white/20"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
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
                    {selectedSubmission.phone || '—'}
                    {selectedSubmission.phoneVerified === false && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                        unverified
                      </span>
                    )}
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
                            {key === 'nationality' && value
                              ? countryCodeToName(value)
                              : (value || 'N/A')}
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

