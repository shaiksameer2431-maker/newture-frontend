/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  fetchCollection, 
  subscribeToCollection, 
  saveSupportTicket,
  saveChatLog,
  clearChatLogs,
  seedDatabase,
  checkConnection
} from './data/sqliteService';
import { defaultRules, defaultDepartments, defaultCategories, defaultFaculty } from './data/defaultKnowledgeBase';
import { Rule, Department, Faculty, ChatLog, SupportTicket, PortalItem, NoticeItem, Student } from './types';
import CollegePortal from './components/CollegePortal';
import ChatbotWidget from './components/ChatbotWidget';
import AdminDashboard from './components/AdminDashboard';
import { Settings, ExternalLink, MessageSquareCode, Sparkles } from 'lucide-react';
import { speechService } from './utils/SpeechService';
import { apiFetch } from './lib/api';

export default function App() {
  // Navigation: 'portal' or 'admin'
  const [viewMode, setViewMode] = useState<'portal' | 'admin'>('portal');

  // External forces to open the Chatbot tracker
  const [forceOpenTrackerEmail, setForceOpenTrackerEmail] = useState<string | null>(null);
  const [typingSpeed, setTypingSpeed] = useState<number>(50); // ms per character
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Connection Status
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'missing_config'>('connecting');
  const [connectingMessage, setConnectingMessage] = useState<string>('Establishing a secure link to the NEXA server...');
  const [configChecked, setConfigChecked] = useState(false);

  // Database States
  const [rules, setRules] = useState<Rule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [portalItems, setPortalItems] = useState<PortalItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  // Load state on startup & listen to query params / keyboard backdoor
  useEffect(() => {
    const checkDatabase = async () => {
      const isConnected = await checkConnection((msg) => {
        if (msg) setConnectingMessage(msg);
      });
      if (isConnected) {
        setConnectionStatus('connected');
        // NOTE: We intentionally do NOT auto-seed here anymore.
        // Auto-seeding on empty tables silently re-inserted default
        // students/rules every time the app loaded, which made deleted
        // records (e.g. attendance rows) reappear as if deletion never
        // worked. Seeding is now only ever triggered explicitly via the
        // admin "Reset to Demo Data" action (handleResetAll below).
      } else {
        setConnectionStatus('error');
      }
      setConfigChecked(true);
    };

    checkDatabase();

    // Set up subscriptions
    const unsubRules = subscribeToCollection<Rule>('rules', (data) => {
      const parsedRules = data.map((r: any) => {
        let relatedQuestions = r.relatedQuestions || [];
        if (typeof relatedQuestions === 'string') {
          try {
            if (relatedQuestions.trim().startsWith('[') && relatedQuestions.trim().endsWith(']')) {
              relatedQuestions = JSON.parse(relatedQuestions);
            } else {
              relatedQuestions = relatedQuestions.split(/[,\n]/).map((q: string) => q.trim()).filter(Boolean);
            }
          } catch {
            relatedQuestions = [relatedQuestions];
          }
        }
        if (!Array.isArray(relatedQuestions)) {
          relatedQuestions = [];
        }
        return {
          ...r,
          relatedQuestions
        };
      });
      setRules(parsedRules);
    });
    const unsubDepartments = subscribeToCollection<Department>('departments', (data) => {
      setDepartments(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.contactNumber || d.code || '',
        hod: d.location || d.hod || ''
      })));
    });
    // categories collection deprecated in this deployment; subscription disabled
    const unsubFaculty = subscribeToCollection<Faculty>('faculty', (data) => {
      setFaculty(data.map((f: any) => ({
        id: f.id,
        name: f.name,
        role: f.designation || f.role || '',
        department: f.department || '',
        email: f.email || ''
      })));
    });
    const unsubTickets = subscribeToCollection<SupportTicket>('supportTickets', setSupportTickets);
    const unsubNotices = subscribeToCollection<NoticeItem>('notices', (data) => {
      console.log("[App] Received notices update:", data);
      setNotices(data.map((n: any) => {
        const textDesc = n.description || n.desc || '';
        const imgUrl = n.imageUrl || n.image_url || n.attachmentUrl || n.attachment_url || n.attachment || '';
        const isPinned = n.isPinned || n.is_pinned || n.pinned || false;
        return {
          id: n.id,
          title: n.title,
          description: textDesc,
          date: n.date,
          pinned: isPinned,
          type: n.type || 'General',
          attachment: imgUrl,
          imageUrl: imgUrl
        };
      }));
    });
    const unsubPortal = subscribeToCollection<PortalItem>('portalLinks', (data) => {
      setPortalItems(data.map((p: any) => ({
        id: p.id,
        title: p.title,
        url: p.link || p.url || '',
        category: p.category || 'General',
        description: p.description || ''
      })));
    });
    // Chat persistence disabled: do not subscribe to chatLogs collection to avoid loading/storing conversations
    setChatLogs([]);
    const unsubChatLogs = () => { /* no-op unsubscribe (chat logs disabled) */ };

    // Switch to admin if ?admin or ?admin=true is passed in URL
    const params = new URLSearchParams(window.location.search);
    if (params.has('admin')) {
      setViewMode('admin');
    }

    // Secret backdoor key combo: Ctrl+Shift+A / Cmd+Shift+A
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setViewMode(prev => prev === 'portal' ? 'admin' : 'portal');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubRules();
      unsubDepartments();
      // categories subscription removed
      unsubFaculty();
      unsubTickets();
      unsubNotices();
      unsubPortal();
      unsubChatLogs();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    speechService.stop();
  }, [viewMode]);

  const handleAddLog = (newLog: ChatLog) => {
    saveChatLog(newLog);
  };

  const handleClearLogs = () => {
    clearChatLogs();
  };

  const handleAddSupportTicket = async (newTicket: SupportTicket) => {
    try {
      console.log("Saving support ticket:", newTicket);
      setSupportTickets(prev => [newTicket, ...prev]);
      await saveSupportTicket(newTicket);
      console.log("Support ticket saved successfully");
    } catch (e) {
      console.error("Failed to save support ticket:", e);
    }
  };

  const handleUpdateSupportTickets = (updatedTickets: SupportTicket[]) => {
    // In the SQLite model, we update individual tickets.
    // This handler from AdminDashboard might need adjustment to save each one or we can just ignore it if AdminDashboard handles it itself.
    // For now, let's just update the local state which is fine since we have a subscription.
    setSupportTickets(updatedTickets);
  };

  const handleUpdateRules = async (newRules: Rule[]) => {
    try {
      console.log("[App] Bulk updating rules via API:", newRules.length);
      const res = await apiFetch('/api/admin/rules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRules)
      });
      
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("[App] Bulk update successful:", data);
      
      // Immediately fetch the updated collection from DB to reflect in UI
      const existingRules = await fetchCollection<Rule>('rules');
      setRules(existingRules);
    } catch (err) {
      console.error("[App] Failed to bulk update rules:", err);
      throw err;
    }
  };

  const handleResetAll = async () => {
    await seedDatabase(defaultRules, defaultDepartments, defaultCategories, defaultFaculty);
  };

  if (!configChecked || connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Connecting to Backend & Database</h1>
        <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
          {connectingMessage}
        </p>
      </div>
    );
  }

  if (connectionStatus === 'missing_config') {
    return null;
  }

  if (connectionStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 border border-red-500/20">
          <ExternalLink className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">Connection Error</h1>
        <p className="text-slate-400 text-base max-w-md mb-8 leading-relaxed">
          Unable to reach the NEXA backend. Please check your connection and try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Admin header - Only shown when explicitly in admin mode */}
      {viewMode === 'admin' && (
        <div className="bg-slate-900 border-b border-slate-800 text-white px-5 py-3 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="font-bold tracking-wider uppercase text-slate-200 font-mono text-sm animate-pulse">
              NARAYANA NEXA — ADMIN COMMAND CENTRE
            </span>
            <span className="text-slate-500 hidden md:inline">|</span>
            <span className="text-slate-400 hidden md:inline font-medium">Private Database Sync Mode</span>
          </div>
        </div>
      )}

      {/* Main Viewport Shell */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'portal' ? (
          <div className="flex-1 relative flex flex-col">
            {/* The College Home screen */}
            <CollegePortal 
              departments={departments} 
              faculty={faculty} 
              portalItems={portalItems}
            />
            {/* Floating widget mapped to synchronized db rules */}
            <ChatbotWidget 
              rules={rules} 
              departments={departments} 
              supportTickets={supportTickets}
              portalItems={portalItems}
              notices={notices}
              onAddLog={handleAddLog} 
              onAddSupportTicket={handleAddSupportTicket}
              forceOpenTrackerEmail={forceOpenTrackerEmail}
              onClearForceTrackerEmail={() => setForceOpenTrackerEmail(null)}
              typingSpeed={typingSpeed}
              isMaximized={isMaximized}
              setIsMaximized={setIsMaximized}
            />
          </div>
        ) : (
          <AdminDashboard
            rules={rules}
            departments={departments}
            faculty={faculty}
            chatLogs={chatLogs}
            supportTickets={supportTickets}
            portalItems={portalItems}
            calendarItems={notices}
            onUpdateRules={handleUpdateRules}
            onUpdatePortalItems={setPortalItems}
            onUpdateCalendarItems={setNotices}
            onClearLogs={handleClearLogs}
            onUpdateSupportTickets={handleUpdateSupportTickets}
            onResetAll={handleResetAll}
            typingSpeed={typingSpeed}
            setTypingSpeed={setTypingSpeed}
          />
        )}
      </main>
    </div>
  );
}
