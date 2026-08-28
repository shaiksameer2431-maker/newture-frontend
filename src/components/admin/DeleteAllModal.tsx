import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  moduleName: string;
  recordCount: number;
  isDeleting?: boolean;
}

export default function DeleteAllModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  moduleName,
  recordCount,
  isDeleting = false
}: DeleteAllModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const isConfirmed = confirmationInput.trim() === 'DELETE';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isDeleting) return;
    await onConfirm();
    setConfirmationInput('');
  };

  const handleClose = () => {
    setConfirmationInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-all-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-rose-500/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-inner">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 id="delete-all-title" className="text-lg font-bold text-slate-900 dark:text-white">
                {title || `Delete All ${moduleName}`}
              </h3>
              <p className="text-xs text-rose-500 font-bold uppercase tracking-wider font-mono">
                DANGER: PERMANENT DATA PURGE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-slate-700 dark:text-slate-300 text-sm space-y-2">
            <p className="font-semibold text-rose-900 dark:text-rose-200">
              You are about to permanently delete:
            </p>
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800/60 font-mono font-bold text-rose-600 dark:text-rose-400">
              <span>{moduleName} Records</span>
              <span className="text-base">{recordCount}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This action cannot be undone. All associated data in this module will be permanently removed from the SQLite database.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Type <span className="font-mono text-rose-600 dark:text-rose-400 select-all font-black">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="Type DELETE"
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmed || isDeleting}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white font-bold rounded-xl text-sm transition-all shadow-lg ${
                isConfirmed && !isDeleting
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30 active:scale-95'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Purging...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete All Records
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
