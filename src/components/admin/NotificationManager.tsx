import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, ShieldAlert, Sparkles, Calendar, Search } from 'lucide-react';
import { bulkDeleteNotifications, deleteAllNotifications } from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface NotificationItem {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export default function NotificationManager() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await apiFetch('/api/admin/notifications');
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data || []);
    } catch (err: any) {
      console.error(err);
      showToast("Error loading system notifications: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000); // Auto refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/notifications/read/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to update status");
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      );
      showToast("Notification marked as read.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete notification");
      setNotifications(prev => prev.filter(n => n.id !== id));
      showToast("Notification deleted.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete all system notifications?")) return;
    try {
      const res = await apiFetch('/api/admin/notifications', { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to clear notifications");
      setNotifications([]);
      showToast("All notifications cleared.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const filteredNotifications = notifications.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* Control Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/80 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">System Notifications Alert 🔔</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Monitor real-time student support ticket registrations, administrative updates, and chat interactions. Displaced all legacy SMTP configurations with this zero-latency SQLite notification ledger.
          </p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            className="self-start md:self-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-500/10 hover:-translate-y-0.5"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Alerts
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Search Bar & Stats */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-slate-850 dark:text-slate-100 placeholder-slate-500 font-sans"
            />
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg">
              Total: {notifications.length}
            </span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg animate-pulse">
                Unread: {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Alerts List */}
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-indigo-500" />
            LOADING NOTIFICATION LEDGER...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="text-xs font-bold font-sans uppercase">No notifications found</div>
            <p className="text-[11px] max-w-sm mx-auto">New student inquiries, ticket creations, or status adjustments will register logs instantly in this SQLite dashboard container.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 transition-all flex items-start gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-950/20 ${
                  !item.is_read ? 'bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] border-l-2 border-indigo-500' : ''
                }`}
              >
                {/* Alert Icon Indicator */}
                <div className={`p-2 rounded-xl mt-0.5 ${
                  item.type === 'ticket_created' 
                    ? 'bg-amber-500/10 text-amber-500' 
                    : item.type === 'ticket_update' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-indigo-500/10 text-indigo-500'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {item.title}
                      {!item.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed font-sans font-medium whitespace-pre-wrap">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-extrabold font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {item.type || 'info'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  {!item.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete alert"
                    className="p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple local spin loader replacement
function RefreshCw(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
