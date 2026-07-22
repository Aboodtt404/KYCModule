import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '@/hooks/useActor';
import { Loader2, Users, CheckCircle, XCircle, Clock, FileText, Shield } from 'lucide-react';

function useStats() {
  const { actor } = useActor();
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      if (!actor) return null;
      const [count, statusCounts, auditEntries] = await Promise.all([
        actor.get_kyc_submissions_count(),
        actor.get_kyc_status_counts(),
        actor.get_audit_log(BigInt(500)),
      ]);

      const total    = Number(count);
      const approved = Number(statusCounts[0]);
      const rejected = Number(statusCounts[1]);
      const pending  = Number(statusCounts[2]);

      // Activity in last 24h from audit log
      const now = Date.now() * 1_000_000; // nanoseconds
      const day = 24 * 60 * 60 * 1_000_000_000;
      const recentActions = (auditEntries || []).filter(([, v]) => {
        try { return (now - JSON.parse(v).ts) < day; } catch { return false; }
      }).length;

      return { total, approved, rejected, pending, recentActions };
    },
    enabled: !!actor,
    refetchInterval: 30000,
  });
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export function StatsPage() {
  const { data, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Loading stats…</span>
      </div>
    );
  }

  const approvalRate = data?.total
    ? Math.round((data.approved / data.total) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7" /> Dashboard
        </h2>
        <p className="text-gray-400 text-sm mt-1">Live stats from the ICP canister</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Users}       label="Total Submissions"  value={data?.total}         color="bg-brand-600" />
        <StatCard icon={Clock}       label="Pending Review"     value={data?.pending}        color="bg-yellow-600" />
        <StatCard icon={CheckCircle} label="Approved"           value={data?.approved}       color="bg-green-600" />
        <StatCard icon={XCircle}     label="Rejected"           value={data?.rejected}       color="bg-red-600" />
        <StatCard icon={FileText}    label="Actions (24h)"      value={data?.recentActions}  color="bg-brand-600" />
        <StatCard icon={Shield}      label="Approval Rate"      value={`${approvalRate}%`}   color="bg-indigo-600" />
      </div>

      {/* Approval rate bar */}
      {data?.total > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-3">Submission outcomes</p>
          <div className="flex rounded-full overflow-hidden h-4">
            {data.approved > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(data.approved / data.total) * 100}%` }}
                title={`Approved: ${data.approved}`}
              />
            )}
            {data.rejected > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(data.rejected / data.total) * 100}%` }}
                title={`Rejected: ${data.rejected}`}
              />
            )}
            {data.pending > 0 && (
              <div
                className="bg-yellow-500 transition-all flex-1"
                title={`Pending: ${data.pending}`}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Approved</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Rejected</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> Pending</span>
          </div>
        </div>
      )}
    </div>
  );
}
