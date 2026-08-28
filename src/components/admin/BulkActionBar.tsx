import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Download, X, CheckSquare, Square } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onCancelSelection: () => void;
  label?: string;
  showExport?: boolean;
}

export default function BulkActionBar({
  selectedCount,
  onDeleteSelected,
  onExportSelected,
  onCancelSelection,
  label = 'records',
  showExport = true
}: BulkActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  // Auto-focus the delete button for accessibility
  useEffect(() => {
    const deleteBtn = barRef.current?.querySelector('[data-action="delete"]') as HTMLElement;
    deleteBtn?.focus();
  }, [selectedCount]);

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={barRef}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
        role="dialog"
        aria-label="Bulk actions"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Selected: <span className="text-blue-600 dark:text-blue-400 font-mono">{selectedCount}</span> {label}
              </span>
            </div>
            <button
              onClick={onCancelSelection}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              data-action="delete"
              onClick={onDeleteSelected}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>

            {showExport && (
              <button
                onClick={onExportSelected}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <Download className="w-4 h-4" />
                Export Selected
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center font-mono">
            Press Escape to cancel · Enter to confirm delete
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}