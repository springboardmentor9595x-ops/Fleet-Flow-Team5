import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, ShieldCheck, Clock, CheckCircle2, X, RefreshCw, Sparkles } from "lucide-react";

const EmailLogsModal = ({ isOpen, onClose }) => {
  const { fetchEmailLogs } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchEmailLogs();
      setLogs(data);
      if (data.length > 0 && !selectedLog) {
        setSelectedLog(data[0]);
      }
    } catch (err) {
      console.error("Failed to load email logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Dispatched Email Audit Logs
                <span className="text-xs bg-sky-500/20 text-sky-300 font-normal px-2.5 py-0.5 rounded-full border border-sky-500/30">
                  {logs.length} Sent
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Real-time record of welcome emails & admin account provisioning notifications
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[400px]">
          {/* Left Column: Email List */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/40">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No emails sent yet in this session.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedLog?.id === log.id
                      ? "bg-sky-500/10 border-l-4 border-sky-400"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                      {log.role}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.sent_at.split(" ")[1]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 truncate">{log.recipient_name}</p>
                  <p className="text-xs text-slate-400 truncate">{log.recipient}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      {log.status}
                    </span>
                    {log.added_by_admin && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                        Admin Created
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Email Preview */}
          <div className="md:col-span-7 p-6 overflow-y-auto bg-slate-900/60 flex flex-col">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-100">{selectedLog.subject}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {selectedLog.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-700/60">
                    <div>
                      <span className="text-slate-400">To:</span> {selectedLog.recipient_name} ({selectedLog.recipient})
                    </div>
                    <div>
                      <span className="text-slate-400">Time:</span> {selectedLog.sent_at}
                    </div>
                  </div>
                </div>

                {/* Email Body Card Mock */}
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-4 shadow-inner">
                  <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
                    <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg">
                      FF
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">FleetFlow Logistics Notification</h4>
                      <p className="text-xs text-sky-400">Automated Dispatch System</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="text-slate-200 font-medium">Hello {selectedLog.recipient_name},</p>
                    <p>{selectedLog.body_preview}</p>
                    {selectedLog.added_by_admin && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
                        🔑 <strong>Account Provisioned by Admin</strong>: Welcome email contains temporary access pass and link to the FleetFlow Portal.
                      </div>
                    )}
                    <p className="text-xs text-slate-400 pt-4 border-t border-slate-800">
                      This is a real-time email dispatch confirmation logged by the FleetFlow Backend Service.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                <Sparkles className="w-10 h-10 mb-2 opacity-30" />
                <p>Select an email from the left list to view full details.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>FastAPI Background Tasks + SMTP Logger Enabled</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailLogsModal;
