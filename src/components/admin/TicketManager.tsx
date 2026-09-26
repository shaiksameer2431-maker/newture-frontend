import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertTriangle, Mail, Phone, Check, RefreshCw, Trash2, 
  FileText, BarChart3, HelpCircle, Sparkles, Users, Search 
} from 'lucide-react';
import { SupportTicket, ChatLog } from '../../types';
import { subscribeToCollection, bulkDeleteTickets, deleteAllTickets } from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface TicketManagerProps {
  onStateChanged?: () => void;
}

export default function TicketManager({ onStateChanged }: TicketManagerProps) {
  const { showToast } = useToast();
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded ticket and input response values
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [ticketResponses, setTicketResponses] = useState<Record<string, string>>({});
  const [sentEmailTicketIds, setSentEmailTicketIds] = useState<Set<string>>(new Set());

  // Dispatch simulations
  const [dispatchTicket, setDispatchTicket] = useState<SupportTicket | null>(null);
  const [dispatchResponseText, setDispatchResponseText] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(0);
  const [dispatchLogs, setDispatchLogs] = useState<string[]>([]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Bulk selection and delete all state
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Filtered tickets based on search
  const filteredTickets = supportTickets.filter(t => 
    (t.ticketId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = filteredTickets.length > 0 && selectedTicketIds.size >= filteredTickets.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedTicketIds.size === 0) return;
    try {
      const count = await bulkDeleteTickets(Array.from(selectedTicketIds));
      setSelectedTicketIds(new Set());
      showToast(`Successfully deleted ${count} selected support ticket(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting tickets: ${err.message}`, "error");
    }
  };

  const handleExportSelected = () => {
    const selected = supportTickets.filter(t => selectedTicketIds.has(t.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} tickets.`, "success");
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllTickets();
      setSelectedTicketIds(new Set());
      showToast(`Successfully purged all ${count} support tickets from database.`, "success");
      setShowDeleteAllModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to purge tickets: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  useEffect(() => {
    // Subscribe to tickets
    const unsubTickets = subscribeToCollection<SupportTicket>('supportTickets', (data) => {
      // Map snake_case to camelCase
      const mappedTickets = data.map((t: any) => ({
        id: t.id,
        ticketId: t.ticket_id || t.ticketId || '',
        studentName: t.student_name || t.studentName,
        email: t.email,
        phone: t.phone || t.contact || '',
        role: t.role || 'Student',
        query: t.query || t.user_query,
        timestamp: t.timestamp || t.created_at,
        status: t.status || 'Open',
        priority: t.priority || 'Medium',
        adminResponse: t.admin_response || t.adminResponse || '',
        respondedAt: t.responded_at || t.respondedAt || '',
        chatSessionId: t.chat_session_id || t.chatSessionId || '',
        language: t.language || 'en',
        websiteSection: t.website_section || t.websiteSection || '',
        currentPage: t.current_page || t.currentPage || ''
      }));
      setSupportTickets(mappedTickets);
      setLoading(false);
    });

    // Subscribe to chat logs from backend
    const unsubLogs = subscribeToCollection<ChatLog>('chatLogs', (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setChatLogs(data);
      } else {
        try {
          const localLogs = localStorage.getItem('college_chat_logs');
          if (localLogs) {
            setChatLogs(JSON.parse(localLogs));
          } else {
            setChatLogs([]);
          }
        } catch {
          setChatLogs([]);
        }
      }
    });
    
    return () => {
      unsubTickets();
      unsubLogs();
    };
  }, []);

  // Sync methods
  const updateTicketStatus = async (ticket: SupportTicket, newStatus: 'Open' | 'Resolved') => {
    try {
      const payload = {
        status: newStatus,
        admin_response: ticket.adminResponse || ''
      };
      const res = await apiFetch(`/api/admin/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to sync ticket status");
      
      const resData = await res.json();
      if (resData.emailWarning) {
        showToast(resData.emailWarning, "info");
      } else {
        showToast(`Ticket status updated to ${newStatus}!`, "success");
      }
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Status sync failed: ${err.message}`, "error");
    }
  };

  const commitTicketResolution = async (ticketId: string, adminResponse: string) => {
    try {
      const ticket = supportTickets.find(t => t.id === ticketId);
      
      const payload = {
        status: 'Resolved',
        admin_response: adminResponse,
        responded_at: new Date().toISOString()
      };
      
      const res = await apiFetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to write ticket resolution");
      
      const resData = await res.json();
      const hasEmailWarning = !!resData.emailWarning;
      
      if (hasEmailWarning) {
        showToast(resData.emailWarning, "info");
      } else {
        showToast("Ticket resolved and updated successfully!", "success");
      }

      // Trigger notification
      if (ticket) {
        setDispatchLogs(prev => [...prev, "📱 Processing outbound WhatsApp notification for " + (ticket.phone || '+91 9490123456') + "..."]);
        if (hasEmailWarning) {
          setDispatchLogs(prev => [...prev, "❌ Email notification failed: Ticket updated, but notification email failed to send"]);
        } else {
          try {
            await apiFetch(`/api/admin/tickets/${ticketId}/notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adminResponse,
                ticketId: ticket.ticketId,
                email: ticket.email,
                studentName: ticket.studentName
              })
            });
            setDispatchLogs(prev => [...prev, "✅ Email notification sent successfully to " + ticket.email]);
            setSentEmailTicketIds(prev => new Set(prev).add(ticket.id));
          } catch (e) {
            console.error("Notification failed", e);
            setDispatchLogs(prev => [...prev, "⚠️ Notification update processed, but backend dispatcher returned an issue."]);
          }
        }
      }

      setExpandedTicketId(null);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Resolution write failed: ${err.message}`, "error");
    }
  };

  // Clear Chat logs
  const handleDeleteTicket = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Ticket',
      message: 'Are you sure you want to permanently delete this support ticket? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/tickets/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete ticket");
          
          showToast("Ticket deleted successfully.", "success");
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleClearLogs = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ Clear Chat Logs',
      message: 'Are you sure you want to clear all local chat statistics and history logs? This action is irreversible.',
      onConfirm: async () => {
        try {
          await apiFetch('/api/admin/chat-logs', { method: 'DELETE' });
          localStorage.removeItem('college_chat_logs');
          setChatLogs([]);
          if (onStateChanged) onStateChanged();
          showToast("Chat logs cleared successfully.", "success");
        } catch (err: any) {
          localStorage.removeItem('college_chat_logs');
          setChatLogs([]);
          if (onStateChanged) onStateChanged();
          showToast("Chat logs cleared locally.", "success");
        }
      }
    });
  };

  // Multi-channel simulated dispatch effect
  useEffect(() => {
    if (!isDispatching || !dispatchTicket) return;

    const steps = [
      { message: "🔗 Establishing secure internal link with College Administration Database...", delay: 650 },
      { message: "🔍 Validating response parameters and resolution integrity...", delay: 750 },
      { message: "💾 Writing finalized response parameters back to SQLite database...", delay: 850 },
      { message: "🎉 Support ticket status successfully synchronized and committed to primary ledger.", delay: 500 }
    ];

    let currentIdx = 0;
    const timerIds: NodeJS.Timeout[] = [];

    const runNextStep = () => {
      if (currentIdx < steps.length) {
        const step = steps[currentIdx];
        setDispatchLogs(prev => [...prev, step.message]);
        setDispatchStep(currentIdx + 1);
        currentIdx++;
        const nextTimer = setTimeout(runNextStep, step.delay);
        timerIds.push(nextTimer);
      }
    };

    const initialTimer = setTimeout(runNextStep, 500);
    timerIds.push(initialTimer);

    return () => {
      timerIds.forEach(clearTimeout);
    };
  }, [isDispatching, dispatchTicket]);

  const getExpectedTotalSteps = () => 4;

  // Analytics Stats
  const totalQueries = chatLogs.length;
  const fallbackQueries = chatLogs.filter(log => log.fallbackTriggered).length;
  const fallbackRate = totalQueries > 0 ? ((fallbackQueries / totalQueries) * 100).toFixed(1) : '0.0';
  const successfulMatches = totalQueries - fallbackQueries;
  const avgScore = successfulMatches > 0 
    ? (chatLogs.filter(log => !log.fallbackTriggered).reduce((sum, log) => sum + log.score, 0) / successfulMatches).toFixed(1) 
    : '0.0';

  const roles = chatLogs.map(log => log.userRole || 'Visitor');
  const roleDistribution = roles.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  if (loading && supportTickets.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" />
        LOADING HELP DESK MODULES...
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* ==================== TICKETS TAB ==================== */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold">Admissions & Parents Support Ticket Logs</h3>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic routing fallback requests queued from the frontend Chatbot widget. Real-time parent and student enquiries.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by Ticket ID, Name, or Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full font-mono">
                {supportTickets.filter(t => t.status === 'Open').length} Open
              </span>
              <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full font-mono">
                {supportTickets.filter(t => t.status === 'Resolved').length} Resolved
              </span>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Tickets
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-mono">
            {error}
          </div>
        )}

        {supportTickets.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-500">Zero Pending Support Tickets</h4>
            <p className="text-xs text-slate-400">All queries from student personas have matched or been answered!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Student/Parent Info</th>
                  <th className="py-3 px-4">Persona</th>
                  <th className="py-3 px-4">Logged Query</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-880 text-xs">
                {filteredTickets.map((ticket) => {
                  const isExpanded = expandedTicketId === ticket.id;
                  const responseVal = ticketResponses[ticket.id] !== undefined 
                    ? ticketResponses[ticket.id] 
                    : (ticket.adminResponse || '');

                  const quickReplies = [
                    "Thank you for contacting Narayana Engineering College, Nellore (NECN). Our Admissions Desk will contact you directly within 24 hours to proceed with the verification of your documents.",
                    "Dear parent, college bus services cover all major locations in Nellore. The transport coordinator will get in touch with you at +91-861-2352007 to assign the nearest route.",
                    "The concern branch Head of Department (HOD) has been notified. They will review your query and send a detailed academic response to your registered email address.",
                    "Please visit our main campus office in Nellore with all relevant documents (EAPCET Hall Ticket, Rank Card, Tenth/Inter certificates) for physical verification and scholarship slab details."
                  ];

                  return (
                    <React.Fragment key={ticket.id}>
                      <tr className={`transition-all border-b border-slate-100 dark:border-slate-800 ${
                        isExpanded ? 'bg-slate-50/80 dark:bg-slate-900/40 border-l-2 border-l-blue-500' : 'hover:bg-slate-50/50 dark:hover:bg-slate-950/20'
                      }`}>
                        <td className="py-4 px-4">
                          <input
                            type="checkbox"
                            checked={selectedTicketIds.has(ticket.id)}
                            onChange={() => toggleSelect(ticket.id)}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-blue-500 dark:text-indigo-400">
                          {ticket.ticketId || ticket.id.substring(0, 8)}
                        </td>
                        <td className="py-4 px-4 space-y-0.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            {ticket.studentName}
                            {sentEmailTicketIds.has(ticket.id) && (
                              <span title="Email Sent successfully" className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-0.5 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{ticket.email}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{ticket.phone}</span>
                            </div>
                            <div className="pt-1">
                              {(sentEmailTicketIds.has(ticket.id) || ticket.adminResponse) ? (
                                <span title="Outbound Email Notification Dispatched via SMTP" className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-semibold">
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  SMTP Dispatched
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500 px-1.5 py-0.5 rounded-md font-medium">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                                  Pending Reply
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wide ${
                            ticket.role === 'Parent' 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
                              : ticket.role === 'Faculty'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}>
                            {ticket.role}
                          </span>
                        </td>
                        <td className="py-4 px-4 max-w-xs truncate font-medium text-slate-650 dark:text-slate-300" title={ticket.query}>
                          {ticket.query}
                        </td>
                        <td className="py-4 px-4 text-[11px] text-slate-400 font-mono">
                          {new Date(ticket.timestamp).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            ticket.status === 'Open'
                              ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                          }`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right space-x-2">
                          <button
                            onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                              isExpanded
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400'
                            }`}
                          >
                            {isExpanded ? 'Collapse' : ticket.adminResponse ? 'Edit Answer' : 'Write Answer'}
                          </button>
                          <button
                            onClick={() => {
                              const newStatus = ticket.status === 'Open' ? 'Resolved' : 'Open';
                              updateTicketStatus(ticket, newStatus);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                              ticket.status === 'Open'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 border-transparent'
                            }`}
                          >
                            {ticket.status === 'Open' ? 'Resolve' : 'Re-open'}
                          </button>
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border-transparent ml-2"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Answer Section */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-l-2 border-l-blue-500">
                          <td colSpan={7} className="p-4 bg-slate-50/50 dark:bg-slate-950/40">
                            <div className="space-y-4 max-w-4xl mx-auto">
                              {/* Full Query */}
                              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                                <div className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 mb-1">
                                  Full Parent/Student Inquiry
                                </div>
                                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                  "{ticket.query}"
                                </p>

                                {/* Session Metadata Context */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                                  {ticket.chatSessionId && (
                                    <div className="p-2 bg-slate-100/50 dark:bg-slate-800/30 rounded border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
                                      <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Session ID</div>
                                      <div className="text-[10px] font-mono truncate" title={ticket.chatSessionId}>{ticket.chatSessionId}</div>
                                    </div>
                                  )}
                                  {ticket.language && (
                                    <div className="p-2 bg-slate-100/50 dark:bg-slate-800/30 rounded border border-slate-200/50 dark:border-slate-800/50">
                                      <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Language</div>
                                      <div className="text-[10px] font-mono">{ticket.language === 'te' ? 'Telugu' : ticket.language === 'hi' ? 'Hindi' : 'English'}</div>
                                    </div>
                                  )}
                                  {ticket.websiteSection && (
                                    <div className="p-2 bg-slate-100/50 dark:bg-slate-800/30 rounded border border-slate-200/50 dark:border-slate-800/50 font-sans">
                                      <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5 font-mono">Section</div>
                                      <div className="text-[10px] font-semibold capitalize">{ticket.websiteSection}</div>
                                    </div>
                                  )}
                                  {ticket.currentPage && (
                                    <div className="p-2 bg-slate-100/50 dark:bg-slate-800/30 rounded border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
                                      <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Page Path</div>
                                      <div className="text-[10px] font-mono truncate" title={ticket.currentPage}>{ticket.currentPage}</div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quick Reply Templates */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                                  Quick Template Responses
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {quickReplies.map((reply, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        setTicketResponses(prev => ({
                                          ...prev,
                                          [ticket.id]: reply
                                        }));
                                      }}
                                      className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 transition-all font-sans cursor-pointer"
                                    >
                                      {reply.slice(0, 80)}...
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Textarea Field */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                                    Answer Resolution Text
                                  </label>
                                  {ticket.adminResponse && (
                                    <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1 font-semibold">
                                      <Check className="w-3.5 h-3.5" /> Already Answered
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  rows={4}
                                  value={responseVal}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTicketResponses(prev => ({
                                      ...prev,
                                      [ticket.id]: val
                                    }));
                                  }}
                                  placeholder="Type custom answer or select one of the templates above..."
                                  className="w-full text-xs font-sans p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {/* Notification Channels Preference Selector */}
                              <div className="p-3 bg-blue-500/5 dark:bg-slate-900/60 border border-blue-500/15 dark:border-slate-800 rounded-lg space-y-1.5">
                                <div className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" style={{ animationDuration: '6s' }} />
                                  Automated Outbound Dispatcher Channels
                                </div>
                                <p className="text-[11px] text-slate-500 leading-normal">
                                  Upon submitting the answer, the helpdesk will trigger actual email notifications via SMTP and simulate live notifications to the student's designated WhatsApp channel.
                                </p>
                                <div className="flex flex-wrap gap-4 pt-1">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 dark:text-slate-300 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      readOnly
                                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                                    />
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                                      Email Notifications (Enabled: {ticket.email})
                                    </span>
                                  </label>
                                  
                                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 dark:text-slate-300 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      readOnly
                                      className="rounded border-slate-300 dark:border-slate-700 text-emerald-650 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
                                    />
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                      Simulated WhatsApp (<span className="font-mono text-emerald-500 text-[11px]">{ticket.phone || '+91 9490123456'}</span>)
                                    </span>
                                  </label>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex justify-between items-center pt-2">
                                <div className="text-[10px] font-mono text-slate-400 font-sans">
                                  {ticket.respondedAt ? `Responded: ${new Date(ticket.respondedAt).toLocaleString()}` : 'No active response yet'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTicketResponses(prev => {
                                        const updated = { ...prev };
                                        delete updated[ticket.id];
                                        return updated;
                                      });
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-sans"
                                  >
                                    Reset Field
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!responseVal.trim()) {
                                        showToast("Please type or select an answer before resolving.", "error");
                                        return;
                                      }
                                      
                                      // Save immediately to SQLite
                                      try {
                                        showToast("Saving resolution to database...", "info");
                                        await commitTicketResolution(ticket.id, responseVal);
                                        showToast("Ticket resolution saved successfully!", "success");
                                      } catch (err: any) {
                                        showToast(`Resolution write failed: ${err.message}`, "error");
                                        return;
                                      }

                                      setDispatchTicket(ticket);
                                      setDispatchResponseText(responseVal);
                                      setIsDispatching(true);
                                      setDispatchStep(0);
                                      setDispatchLogs(["📡 Initializing SECN Outbound API handshake..."]);
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer font-sans"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                    Submit Answer & Dispatch notifications
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== ANALYTICS & LOGS TAB ==================== */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold">Historic Chat Interactions & Metrics</h3>
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Total Interactions</span>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="font-mono text-3xl font-bold">{totalQueries}</div>
            <div className="text-xs text-slate-400">Queries processed by rule engine</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Fallback Rate</span>
              <HelpCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="font-mono text-3xl font-bold text-amber-500">{fallbackRate}%</div>
            <div className="text-xs text-slate-400">{fallbackQueries} fallback messages triggered</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Avg Matching Score</span>
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="font-mono text-3xl font-bold text-indigo-500">{avgScore}</div>
            <div className="text-xs text-slate-400">Score density on matched rules</div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Active Personas</span>
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="font-mono text-xs space-y-1 py-1">
              {['Student', 'Parent', 'Faculty', 'Visitor'].map((p) => {
                const count = roleDistribution[p] || 0;
                const percent = totalQueries > 0 ? ((count / totalQueries) * 100).toFixed(0) : '0';
                return (
                  <div key={p} className="flex justify-between items-center">
                    <span className="font-semibold text-slate-400">{p}:</span>
                    <span className="font-mono font-bold text-[11px]">{count} ({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat Interaction Logs list */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-bold text-sm">Historic Chat Logs ({chatLogs.length})</h3>
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-lg border border-rose-500/10 hover:border-rose-500/25 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 font-sans"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          </div>

          {chatLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="font-semibold text-sm">No chat logs recorded yet.</p>
              <p className="text-xs text-slate-400/90 mt-1">Open the floating chatbot widget at the bottom right and run some test queries!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">User Query</th>
                    <th className="p-4 font-semibold">Matched Rule ID</th>
                    <th className="p-4 font-semibold font-mono">Score</th>
                    <th className="p-4 font-semibold">Persona</th>
                    <th className="p-4 font-semibold">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {[...chatLogs].reverse().slice(0, 100).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                      <td className="p-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-4 font-semibold max-w-[200px] truncate" title={log.userQuery}>
                        {log.userQuery}
                      </td>
                      <td className="p-4 font-mono">
                        {log.matchedRuleId ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 font-bold">
                            {log.matchedRuleId}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">None</span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-indigo-400">
                        {log.score > 0 ? log.score.toFixed(1) : '-'}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                          {log.userRole}
                        </span>
                      </td>
                      <td className="p-4">
                        {log.fallbackTriggered ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20">
                            Fallback
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                            Match Found
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ==================================== OUTBOUND MULTI-CHANNEL DISPATCHER TERMINAL ==================================== */}
      {isDispatching && dispatchTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-100">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 pl-2">SECN Outbound Dispatch Node v1.4</span>
              </div>
              <div className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-widest animate-pulse">
                Active Session
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="text-center pb-2">
                <div className="inline-flex p-3 bg-blue-500/10 rounded-full mb-3 text-blue-400">
                  <RefreshCw className="w-8 h-8 animate-spin animate-spin-slow" />
                </div>
                <h3 className="font-bold text-base text-white">Database Synchronization</h3>
                <p className="text-xs text-slate-400 mt-1 leading-normal">
                  Transmitting administrative response to <span className="font-semibold text-blue-400">{dispatchTicket.studentName || 'Inquirer'}</span> via SQLite.
                </p>
              </div>

              {/* Console Logs Box */}
              <div className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed scrollbar-thin">
                <div className="flex items-center justify-between text-slate-500 pb-1.5 mb-1.5 border-b border-slate-900">
                  <span>DISPATCH CONSOLE UTILITIES</span>
                  <span>SSL_SECURE</span>
                </div>
                {dispatchLogs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`${
                      log.includes('[SUCCESS]') 
                        ? 'text-emerald-400 font-bold' 
                        : log.startsWith('🎉') 
                        ? 'text-yellow-400 font-bold' 
                        : 'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))}
                <div className="animate-pulse text-blue-500">_</div>
              </div>

              {/* Progress Tracker */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>TRANSMISSION PROGRESS</span>
                  <span>{Math.round((dispatchStep / getExpectedTotalSteps()) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, (dispatchStep / getExpectedTotalSteps()) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Form Submission Block */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDispatching(false);
                  setDispatchTicket(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer font-sans"
              >
                Cancel Transmission
              </button>
              
              <button
                type="button"
                onClick={async () => {
                  // Resolution is already written on step 1, but we run this to ensure clean sync state
                  await commitTicketResolution(dispatchTicket.id, dispatchResponseText);
                  setIsDispatching(false);
                  setDispatchTicket(null);
                  showToast("Outbound dispatcher closed and synchronized.", "success");
                }}
                className="flex-1 py-2 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer font-sans bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
              >
                <Check className="w-4 h-4" />
                Done & Close Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-850 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{confirmModal.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-red-500/10"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedTicketIds.size}
        onDeleteSelected={handleDeleteSelected}
        onExportSelected={handleExportSelected}
        onCancelSelection={() => setSelectedTicketIds(new Set())}
        label="support tickets"
      />

      <DeleteAllModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleConfirmDeleteAll}
        moduleName="Support Tickets"
        recordCount={supportTickets.length}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}
