import React, { useState } from 'react';
import { useActor } from '@/hooks/useActor';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, RefreshCw, Trash2, Loader2, ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react';

const PAGE_SIZE = 100;

function useAuditLogPage(limit, offset) {
  const { actor } = useActor();
  return useQuery({
    queryKey: ['auditLogPage', limit, offset],
    queryFn: async () => {
      if (!actor) return { total: 0, entries: [] };
      const [total, entries] = await actor.get_audit_log_page(BigInt(limit), BigInt(offset));
      return { total: Number(total), entries };
    },
    enabled: !!actor,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}

function useCleanupSessions() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const result = await actor.cleanup_expired_sessions();
      if ('Err' in result) throw new Error(result.Err);
      return Number(result.Ok);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditLog'] }),
  });
}

export function AuditLog() {
  const [page, setPage] = useState(0);
  const { data = { total: 0, entries: [] }, isLoading, refetch } = useAuditLogPage(PAGE_SIZE, page * PAGE_SIZE);
  const { total: totalCount, entries = [] } = data;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const cleanup = useCleanupSessions();
  const [cleanupMsg, setCleanupMsg] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const { actor } = useActor();

  const handleExportRange = async () => {
    if (!actor || !exportFrom || !exportTo) return;
    setExportLoading(true);
    setExportError('');
    try {
      if (exportFrom > exportTo) {
        setExportError('"From" date must be before or equal to "To" date.');
        setExportLoading(false);
        return;
      }
      const fromMs = new Date(exportFrom + 'T00:00:00Z').getTime();
      const toMs   = new Date(exportTo   + 'T23:59:59Z').getTime();
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        setExportError('Invalid date range. Please enter valid dates.');
        setExportLoading(false);
        return;
      }
      const fromNs = BigInt(fromMs) * 1_000_000n;
      const toNs   = BigInt(toMs)   * 1_000_000n;
      const entries = await actor.export_audit_log_range(fromNs, toNs);
      if (entries.length === 0) {
        setExportError('No audit log entries found in the selected date range.');
        setExportLoading(false);
        return;
      }
      const rows = entries.map(([k, v]) => {
        try { return { key: k, ...JSON.parse(v) }; } catch { return { key: k, raw: v }; }
      });
      const blob = new Blob([
        '// WARNING: This file contains sensitive audit data. Store and transmit securely.\n',
        JSON.stringify(rows, null, 2),
      ], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `audit-log-${exportFrom}-to-${exportTo}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(`Export failed: ${e.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      const count = await cleanup.mutateAsync();
      setCleanupMsg(`✓ Deleted ${count} expired session${count !== 1 ? 's' : ''}.`);
      setTimeout(() => setCleanupMsg(''), 4000);
    } catch (e) {
      setCleanupMsg(`Error: ${e.message}`);
    }
  };

  const parsed = entries.map(([key, val]) => {
    try { return { key, ...JSON.parse(val) }; }
    catch { return { key, action: '?', principal: '?', target: '?', ts: 0 }; }
  });

  const allActions = [...new Set(parsed.map(r => r.action).filter(Boolean))].sort();

  const filtered = parsed.filter(row => {
    if (actionFilter !== 'all' && row.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        row.action?.toLowerCase().includes(q) ||
        row.principal?.toLowerCase().includes(q) ||
        row.target?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7" />
            Audit Log
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {filtered.length !== parsed.length
              ? `${filtered.length} of ${parsed.length} shown`
              : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}`} entries (most recent first)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cleanup sessions button */}
          <button
 onClick={handleCleanup}
 disabled={cleanup.isPending}
 className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-600/40 hover:bg-orange-600/30 text-sm font-medium disabled:opacity-50"
 >
            {cleanup.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            Cleanup Expired Sessions
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search action, principal, or target…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300"
        >
          <option value="all">All actions</option>
          {allActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(search || actionFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setActionFilter('all'); }}
            className="px-3 py-2 rounded-xl bg-white/10 text-gray-400 text-sm hover:bg-white/20"
          >
            Clear
          </button>
        )}
      </div>

      {/* Date-range export */}
      <div className="mb-4 flex flex-wrap items-end gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mb-2" />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={exportFrom}
            onChange={e => setExportFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={exportTo}
            onChange={e => setExportTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
 onClick={handleExportRange}
 disabled={exportLoading || !exportFrom || !exportTo || !actor}
 className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-600/40 hover:bg-brand-600/30 text-sm font-medium disabled:opacity-40 mb-0.5"
 >
          {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export JSON
        </button>
        {exportError && <p className="w-full text-xs text-red-400 mt-1">{exportError}</p>}
      </div>

      {/* Cleanup feedback */}
      {cleanupMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-orange-600/10 border border-orange-600/30 text-orange-300 text-sm">
          {cleanupMsg}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 text-sm disabled:opacity-30 hover:bg-white/20"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <span className="ml-2 text-gray-400">Loading audit log…</span>
        </div>
      ) : parsed.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No audit entries yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No entries match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                {['Time', 'Action', 'Principal', 'Target'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((row) => (
                <tr key={row.key} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                    {row.ts ? new Date(Number(row.ts) / 1e6).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      row.action === 'submit_kyc'          ? 'bg-brand-600/20 text-brand-400'
                      : row.action === 'update_kyc_status' ? 'bg-green-600/20 text-green-400'
                      : row.action === 'delete_kyc_submission' ? 'bg-red-600/20 text-red-400'
                      : 'bg-white/10 text-gray-300'
                    }`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono max-w-[200px] truncate" title={row.principal}>
                    {row.principal?.slice(0, 20)}…
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-300 max-w-[240px] truncate" title={row.target}>
                    {row.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
