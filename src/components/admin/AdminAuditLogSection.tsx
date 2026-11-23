import React, { useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Search,
  Lock,
} from 'lucide-react';
import { AdminAuditLogEntry } from '../../types';
import { fetchAdminAuditLogs } from '../../services/adminAudit';

export default function AdminAuditLogSection() {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'warning' | 'failure'>('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const entries = await fetchAdminAuditLogs(60);
      setLogs(entries);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((entry) => {
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    const matchesSearch =
      !searchTerm.trim() ||
      `${entry.action} ${entry.details} ${entry.actorEmail || ''} ${entry.authMethod || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <Activity className="text-amber-500" size={22} />
            <span>System Activity & Security Audit Log</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Immutable chronological record of administrator sign-ins, credential updates, inventory modifications, and blocked access attempts.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-amber-400' : 'text-amber-400'} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by action, details, or method..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 min-h-[44px] text-xs text-slate-800 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
          {(['all', 'success', 'warning', 'failure'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Log Stream */}
      {loading && logs.length === 0 ? (
        <div className="py-14 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw size={22} className="animate-spin text-amber-500" />
          <span>Loading immutable audit records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <Lock size={28} className="mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">No audit events match this filter</p>
          <p className="text-xs text-slate-500">
            Security and inventory actions recorded during active sessions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden">
          {filtered.map((entry) => {
            const isWarning = entry.status === 'warning';
            const isFailure = entry.status === 'failure';

            return (
              <div
                key={entry.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isFailure
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : isWarning
                        ? 'bg-amber-50 border-amber-200 text-amber-600'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    }`}
                  >
                    {isFailure ? (
                      <ShieldAlert size={16} />
                    ) : isWarning ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {entry.action}
                      </span>
                      {entry.authMethod && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {entry.authMethod}
                        </span>
                      )}
                      {entry.source === 'security-server' && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Network Security Monitor
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{entry.details}</p>
                    {entry.actorEmail && (
                      <p className="text-[11px] font-mono text-slate-400">
                        Account: {entry.actorEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0 sm:text-right">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
