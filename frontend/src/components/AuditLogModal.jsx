import React, { useEffect, useState } from 'react';
import { backendApi } from '../services/api';

function getLogStyle(action = '') {
  const lower = String(action).toLowerCase();
  if (lower.includes('reject') || lower.includes('disapprov') || lower.includes('step')) {
    return {
      container: 'border-l-2 border-rose-500 bg-rose-50/40 border-y border-r border-rose-200/70',
      badge: 'text-rose-800 bg-rose-100 border-rose-200',
    };
  }
  if (lower.includes('re-upload') || lower.includes('resubmit') || lower.includes('re-submit')) {
    return {
      container: 'border-l-2 border-amber-500 bg-amber-50/40 border-y border-r border-amber-200/70',
      badge: 'text-amber-800 bg-amber-100 border-amber-200',
    };
  }
  return {
    container: 'border-l-2 border-sage-500 bg-sage-50/50 border-y border-r border-sage-200/70',
    badge: 'text-sage-800 bg-sage-100 border-sage-200',
  };
}

export default function AuditLogModal({ billId, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await backendApi.get(`/bills/${billId}/audit-logs`);
        setLogs(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Failed to fetch audit logs', error);
      } finally {
        setLoading(false);
      }
    };
    if (billId) fetchLogs();
  }, [billId]);

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-[60] font-sans">
      <div className="bg-white border border-sage-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-start px-6 py-5 border-b border-sage-100 bg-sage-50/60">
          <div>
            <h2 className="text-base font-semibold text-stone-900 tracking-tight">
              Audit History Trail
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Chronological ledger of approvals, step-back rejections, and resubmissions recorded for this bill.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-sage-100 rounded-md transition cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-xs text-stone-500">
              Loading audit history...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 px-4 text-center bg-sage-50/70 border border-sage-200/80 rounded-lg text-stone-500 text-xs">
              No audit history found for this invoice.
            </div>
          ) : (
            <div className="space-y-3.5">
              {logs.map((log, index) => {
                const style = getLogStyle(log.action);
                return (
                  <div
                    key={log.id || index}
                    className={`pl-4 pr-4 py-3.5 rounded-r-lg ${style.container}`}
                  >
                    <div className="flex justify-between items-center gap-2 mb-1.5">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${style.badge}`}
                      >
                        {log.role}
                      </span>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-stone-800 mt-1">
                      {log.action}
                    </p>

                    {log.remark && (
                      <p className="text-xs text-stone-700 mt-2 bg-white px-3 py-2 rounded-md border border-sage-200/70">
                        &ldquo;{log.remark}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}