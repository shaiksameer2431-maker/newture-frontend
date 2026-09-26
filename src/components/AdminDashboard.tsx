import React, { useState, useEffect } from 'react';
import { 
  Users, HelpCircle, Layers, Building2, Megaphone, Sliders, 
  RefreshCw, Terminal, Check, Copy, AlertTriangle, Play, Sparkles, LogOut, Code, Bell, Settings2, Moon, Sun
} from 'lucide-react';
import { Rule, Department, Faculty, ChatLog, SupportTicket, PortalItem, NoticeItem } from '../types';
import StudentManager from './admin/StudentManager';
import TicketManager from './admin/TicketManager';
import RuleManager from './admin/RuleManager';
import DatabaseManager from './admin/DatabaseManager';
import NoticeManager from './admin/NoticeManager';
import NotificationManager from './admin/NotificationManager';
import NotificationSettings from './admin/NotificationSettings';
import WebsiteKnowledgePanel from './admin/WebsiteKnowledgePanel';
import { ToastProvider, useToast } from './admin/Toast';
import { useTheme } from '../utils/ThemeContext';
import { apiFetch } from '../lib/api';
import { useAttribution } from './attribution/useAttribution';
import { AttributionMark } from './attribution/AttributionMark';

interface AdminDashboardProps {
  rules: Rule[];
  departments: Department[];
  faculty: Faculty[];
  chatLogs: ChatLog[];
  supportTickets: SupportTicket[];
  onUpdateRules: (newRules: Rule[]) => Promise<void> | void;
  onClearLogs: () => void;
  onUpdateSupportTickets: (updatedTickets: SupportTicket[]) => void;
  portalItems: PortalItem[];
  calendarItems: NoticeItem[];
  onUpdatePortalItems: (items: PortalItem[]) => void;
  onUpdateCalendarItems: (items: NoticeItem[]) => void;
  onResetAll: () => void;
  typingSpeed: number;
  setTypingSpeed: (speed: number) => void;
  onLogout?: () => void;
}

export default function AdminDashboard(props: AdminDashboardProps) {
  return (
    <ToastProvider>
      <AdminDashboardInner {...props} />
    </ToastProvider>
  );
}

function AdminDashboardInner({
  rules,
  departments,
  faculty,
  chatLogs,
  supportTickets,
  onUpdateRules,
  onClearLogs,
  onUpdateSupportTickets,
  onResetAll,
  calendarItems,
  typingSpeed,
  setTypingSpeed,
  onLogout
}: AdminDashboardProps) {
  const { showToast } = useToast();
  const { isDark, toggleTheme } = useTheme();
  const { attribution, isVerified } = useAttribution();

  // Navigation / Tabs state
  const [activeTab, setActiveTab] = useState<'attendance' | 'tickets' | 'rules' | 'notices' | 'databases' | 'notifications' | 'notification-settings'>('attendance');
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Embed script feature removed — function kept as no-op to avoid breaking callers
  const getEmbedScript = () => '<!-- Embed script feature removed in this deployment -->';
  const handleCopyEmbed = () => {
    void navigator.clipboard.writeText(getEmbedScript());
    setCopiedEmbed(true);
    window.setTimeout(() => setCopiedEmbed(false), 1500);
  };
  const handleSaveDomainSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast('Domain settings are managed by the server configuration.', 'info');
  };

  return (
    <div className={`${isDark ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-all`}>
      
      {/* Top Banner Control Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors">
        <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-500/10 text-sm tracking-tight">
              NECN
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Narayana Admin Control Panel 🛡️
              </h1>
              <p className="text-[10px] font-mono text-slate-400 font-medium flex items-center gap-1">
                <span>SQLITE DB CONNECTED</span>
                {isVerified && (
                  <>
                    <span>•</span>
                    <AttributionMark variant="subfooter" />
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 font-bold px-2.5 py-1 rounded-full uppercase items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Operational State Active
            </span>
            <button type="button" onClick={() => toggleTheme()} aria-label={isDark ? 'Switch admin dashboard to light mode' : 'Switch admin dashboard to dark mode'} className="nexa-focus flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="nexa-focus flex h-9 px-3.5 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition-all hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-xs font-bold gap-2 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 space-y-2 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase px-3 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              ADMINISTRATION MODULES
            </div>
            
            <button
              onClick={() => setActiveTab('attendance')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Student Academic Registry
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'tickets'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4" />
                Support Tickets Link
              </span>
              {supportTickets.filter(t => t.status === 'Open').length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md min-w-[16px] text-center">
                  {supportTickets.filter(t => t.status === 'Open').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Knowledge Base Engine
            </button>

            <button
              onClick={() => setActiveTab('notices')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'notices'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Notice Board & Portals
            </button>

             <button
              onClick={() => setActiveTab('databases')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'databases'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Static Databases Schemas
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-4 h-4" />
              System Notification Alerts
            </button>
            <button
              onClick={() => setActiveTab('notification-settings')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'notification-settings'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/15'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Notification Settings
            </button>
          </div>
        </aside>

        {/* Dynamic Tab Panel */}
        <main className="flex-1 min-w-0">
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Admin dashboard statistics">
            {[
              { label: 'Active Rules', value: rules.filter(rule => rule.status === 'Active').length, accent: 'text-blue-600 dark:text-blue-300' },
              { label: 'Open Tickets', value: supportTickets.filter(ticket => ticket.status === 'Open').length, accent: 'text-amber-600 dark:text-amber-300' },
              { label: 'Published Notices', value: calendarItems.length, accent: 'text-violet-600 dark:text-violet-300' },
              { label: 'Departments', value: departments.length, accent: 'text-emerald-600 dark:text-emerald-300' }
            ].map(stat => <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{stat.label}</p>
              <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${stat.accent}`}>{stat.value}</p>
            </article>)}
          </section>
          
          {activeTab === 'attendance' && (
            <StudentManager />
          )}

          {activeTab === 'tickets' && (
            <TicketManager />
          )}

          {activeTab === 'rules' && (
            <div className="space-y-6">
              <WebsiteKnowledgePanel isDark={isDark} />
              <RuleManager 
                rules={rules}
                onUpdateRules={onUpdateRules}
              />
            </div>
          )}

          {activeTab === 'notices' && (
            <NoticeManager />
          )}

          {activeTab === 'databases' && (
            <div className="space-y-6">
              <DatabaseManager />

              {/* API Domain Settings Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold">Whitelisted Web-Domain Configurations</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Connect your own custom backend database domain for whitelisting CORS access.
                  </p>
                </div>

                <form onSubmit={handleSaveDomainSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Whitelisted Web-Domain</label>
                    <input
                      type="text"
                      value={''}
                      onChange={() => {}}
                      placeholder="Feature removed in this deployment"
                      disabled
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-850 dark:text-slate-100 placeholder-slate-500 opacity-60"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/10 cursor-pointer text-xs"
                    >
                      Save Domain settings
                    </button>
                  </div>
                </form>
              </div>

              {/* Bot Client Settings */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold">Chatbot Simulation Configurations (Deprecated)</h3>
                  <p className="text-xs text-slate-400 mt-1">Typing latency & UI simulation options are deprecated in production. The rule-engine now responds instantly and deterministically from the server.</p>
                </div>
                <div className="flex items-center gap-4 py-2 text-xs">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-500">Typing Response Latency Speed:</span>
                      <span className="font-mono text-blue-500">{typingSpeed} ms/character</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      step={5}
                      value={typingSpeed}
                      onChange={(e) => setTypingSpeed(Number(e.target.value))}
                      disabled
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-not-allowed opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Client Embed Code Block */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Code className="w-5 h-5 text-blue-400" />
                      Client Embed Script
                    </h3>
                    <p className="text-xs text-slate-400">Paste this script in any HTML page to deploy the floating Narayana chatbot instantly.</p>
                  </div>
                  <button
                     onClick={handleCopyEmbed}
                     className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 cursor-pointer transition-all flex items-center gap-1 border border-slate-700"
                  >
                    {copiedEmbed ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied Code
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Script
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-blue-400 overflow-x-auto leading-relaxed max-w-full">
                  {getEmbedScript()}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationManager />
          )}

          {activeTab === 'notification-settings' && (
            <NotificationSettings />
          )}

        </main>
      </div>

      <footer className="mt-auto py-4 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/50 w-full">
        <div className="max-w-[1720px] mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>Narayana Engineering College, Nellore — Administrative Command Console</span>
          </div>
          {isVerified && (
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[11px] text-slate-400">System Architect:</span>
              <AttributionMark variant="footer" />
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
