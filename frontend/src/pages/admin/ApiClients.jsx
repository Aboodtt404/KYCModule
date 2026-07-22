import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RefreshCw, Trash2, Loader2, CheckCircle, PauseCircle } from "lucide-react";
import { useActor } from "@/hooks/useActor";

function useApiClients() {
  const { actor } = useActor();
  return useQuery({
    queryKey: ["apiClients"],
    queryFn: async () => {
      if (!actor) return [];
      const rows = await actor.list_api_clients();
      return rows.map(([id, json]) => {
        try { return { id, ...JSON.parse(json) }; }
        catch { return { id, name: "(corrupt record)", status: "unknown" }; }
      });
    },
    enabled: !!actor,
    refetchOnWindowFocus: false,
  });
}

const STATUS_BADGE = {
  pending:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  active:    "bg-green-500/15 text-green-400 border-green-500/30",
  suspended: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function ApiClients() {
  const { actor } = useActor();
  const qc = useQueryClient();
  const { data: clients = [], isLoading, refetch } = useApiClients();
  const [error, setError] = useState("");

  const setStatus = useMutation({
    mutationFn: async ({ clientId, status }) => {
      const r = await actor.set_api_client_status(clientId, status);
      if (r && "Err" in r) throw new Error(r.Err);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apiClients"] }),
    onError: (e) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (clientId) => {
      const r = await actor.delete_api_client(clientId);
      if (r && "Err" in r) throw new Error(r.Err);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apiClients"] }),
    onError: (e) => setError(e.message),
  });

  const handleDelete = (clientId, name) => {
    if (window.confirm(`Permanently delete API client "${name}"? Their key stops working immediately.`)) {
      remove.mutate(clientId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="w-7 h-7" />
            API Clients
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Partner websites using the KYC API — approve, suspend, or revoke access
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
      ) : clients.length === 0 ? (
        <div className="content-card text-center text-slate-400 text-sm">
          No API clients yet. Partners register at <code className="text-brand-300">/developers</code>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-[11px] font-mono text-gray-500">{c.id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="hover:text-brand-300 underline-offset-2 hover:underline">
                      {c.website}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.contact_email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[c.status] || "bg-white/10 text-gray-300 border-white/10"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.request_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.created_at ? new Date(Number(c.created_at) / 1e6).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {c.status !== "active" && (
                        <button
                          onClick={() => setStatus.mutate({ clientId: c.id, status: "active" })}
                          disabled={setStatus.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30 text-xs font-medium"
                          title="Activate"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}
                      {c.status === "active" && (
                        <button
                          onClick={() => setStatus.mutate({ clientId: c.id, status: "suspended" })}
                          disabled={setStatus.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-yellow-600/20 text-yellow-400 border border-yellow-600/40 hover:bg-yellow-600/30 text-xs font-medium"
                          title="Suspend"
                        >
                          <PauseCircle className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={remove.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-600/40 hover:bg-red-600/30 text-xs font-medium"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
