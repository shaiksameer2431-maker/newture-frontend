/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, X, Send, Trash2, RefreshCw, Copy, Check, 
  Phone, Mail, MapPin, User, ChevronRight, HelpCircle, 
  Sparkles, Award, GraduationCap, Building2, BookOpen,
  Volume2, VolumeX, LayoutGrid, Mic, MicOff, Ticket, UserCheck, FileSpreadsheet,
  Minus, ChevronDown, ChevronUp, Bell, Search, ThumbsUp, ThumbsDown, Maximize2, Minimize2,
  Cpu, Activity, Wifi, ShieldAlert, Database, Receipt, 
  ArrowRight, Play, Sliders, BarChart2, CheckCircle2,
  AlertCircle, DollarSign, Flame, BadgeCheck, Network, ExternalLink,
  Pause, RotateCcw
} from 'lucide-react';
import { Rule, Department, Message, ChatLog, SupportTicket, PortalItem, NoticeItem } from '../types';
import { speechService } from '../utils/SpeechService';
import { useTheme } from '../utils/ThemeContext';
import { RichResponseRenderer } from './RichResponseRenderer';
import { RobotLogo } from './RobotLogo';
import { apiFetch } from '../lib/api';
import TicketForm from './TicketForm';

interface ChatbotWidgetProps {
  rules: Rule[];
  departments: Department[];
  supportTickets: SupportTicket[];
  portalItems: PortalItem[];
  notices: NoticeItem[];
  onAddLog: (log: ChatLog) => void;
  onAddSupportTicket: (ticket: SupportTicket) => void;
  forceOpenTrackerEmail?: string | null;
  onClearForceTrackerEmail?: () => void;
  typingSpeed: number;
  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;
}

const formatBoldText = (text: string, isDark = false) => {
  if (!text) return "";
  // The widget owns its color-mode state, so don't rely on Tailwind's
  // system-level `dark:` media query for text injected into chat messages.
  const linkTextClass = isDark ? 'text-indigo-400' : 'text-indigo-600';
  const blueTextClass = isDark ? 'text-blue-400' : 'text-blue-600';
  const emeraldTextClass = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const fieldKeyClass = isDark ? 'text-slate-300' : 'text-slate-600';
  const fieldValueClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const fieldNameClass = isDark ? 'text-indigo-400' : 'text-indigo-700';
  // Separate contact records before they are converted into mail/phone chips.
  // Directory data is often stored on one line with separators, which otherwise
  // causes the next person's name to wrap into the previous contact details.
  const normalizedText = text
    .replace(/\r\n?/g, '\n')
    .replace(/([.!?])\s+(?=(?:[A-Z][A-Za-z ]{2,42}:))/g, '$1\n\n')
    .replace(/\s*;\s*(?=(?:[A-Z][A-Za-z ]{2,42}:))/g, '\n')
    .replace(/\s*(?:;|:)\s*(?=(?:Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s)/g, '\n\n')
    .replace(/\s*[-–]\s*(?=(?:[^\p{L}\p{N}\s]+\s*)?(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d{7,}))/gu, '\n');

  // Escape HTML tags to prevent XSS
  let escaped = normalizedText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // Apply predictable emphasis to facts that are useful when scanning a chat
  // response. Authors can still mark any additional content with **bold**.
  escaped = escaped.replace(
    /\b(?:Narayana Engineering College|NECN|B\.?\s?Tech|M\.?\s?Tech|MBA|MCA|CSE|ECE|EEE|AIML|AIDS|CGPA|\d{6}|[0-9]{1,2}:[0-9]{2}\s?(?:AM|PM)|[0-9]+(?:\.[0-9]+)?%|[0-9]+\s+(?:days?|weeks?|months?|years?))\b/gi,
    '**$&**'
  );

  // Keep only symbols for mail/phone
  escaped = escaped
    .replace(/(https?:\/\/[^\s<>]+)/gi, (match) => {
      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 ${linkTextClass} px-2 py-0.5 rounded-lg text-xs font-bold transition-all shadow-sm my-0.5" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Open Link</a>`;
    })
    .replace(/mailto:([^\s<>]+)/gi, (match, email) => {
      return `<a href="mailto:${email}" class="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 ${blueTextClass} px-2 py-0.5 rounded-lg text-xs font-bold transition-all shadow-sm my-0.5" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>${email}</a>`;
    })
    .replace(/tel:([^\s<>]+)/gi, (match, phone) => {
      return `<a href="tel:${phone}" class="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 ${emeraldTextClass} px-2 py-0.5 rounded-lg text-xs font-bold transition-all shadow-sm my-0.5" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${phone}</a>`;
    })
    .replace(/email:/gi, "📧 ")
    .replace(/mail:/gi, "📧 ")
    .replace(/phone:/gi, "📞 ");

  // 1. Detect and parse plain emails that are not already in a mailto link
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  escaped = escaped.replace(emailRegex, (email) => {
    return `<a href="mailto:${email}" class="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg text-xs font-bold transition-all shadow-sm my-0.5" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span>${email}</span></a>`;
  });

  // 2. Detect and parse typical phone numbers that are not already in a tel link
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;
  escaped = escaped.replace(phoneRegex, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      const cleanPhone = match.trim();
      return `<a href="tel:${digits}" class="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-xs font-bold transition-all shadow-sm my-0.5" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${cleanPhone}</span></a>`;
    }
    return match;
  });

  // 3. Detect and bold professional names/titles of contact persons
  // Supports abbreviated initials as well as full names, e.g. Dr. V. Ravi
  // Prasad and Mr. B.V. Sridhar, so every contact name gets the same style.
  const titleRegex = /\b(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.|Dean|HOD|Director|Registrar|Coordinator|Counselor|Couselor)\s+((?:(?:[A-Z]\.\s*){0,3})?[A-Z][A-Za-z']+(?:\s+(?:(?:[A-Z]\.\s*){0,3})?[A-Z][A-Za-z']+){0,3})/g;
  escaped = escaped.replace(titleRegex, (match, title, restOfName) => {
    return `<span class="inline-flex max-w-full shrink-0 items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold font-sans text-xs sm:text-sm my-0.5 shadow-sm break-words"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="inline mr-0.5 shrink-0"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${title} ${restOfName}</span>`;
  });

  // Support Markdown links: [Anchor Text](URL)
  let formatted = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, anchorText, url) => {
    let href = url.trim();
    // Auto-prepend https:// if protocol is missing
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !/^tel:/i.test(href) && !/^\//.test(href)) {
      href = 'https://' + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-semibold underline inline-flex items-center gap-0.5">${anchorText}</a>`;
  });

  // Support plain URLs (e.g. https://example.com or www.example.com) that are not already inside an href attribute of our <a> tag
  const urlRegex = /(?<!href=")(https?:\/\/[^\s<>\"]+|www\.[^\s<>\"]+)/gi;
  formatted = formatted.replace(urlRegex, (match) => {
    let href = match.trim();
    if (href.toLowerCase().startsWith('www.')) {
      href = 'https://' + href;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-semibold underline inline-flex items-center gap-0.5">${match}</a>`;
  });

  // Helper to stylize specific keys inside profile details, and make names extra bold
  const formatContactFields = (lineText: string): string => {
    const keyRegex = /^(Faculty\s+(?:Member|Name)|Name|Student\s+Profile|Student\s+Name|Role|Designation|Department|Dept|Email|Mail|Phone|Contact|Mobile|HOD|Code|Category|Details|Title|Date|Attendance|Cumulative\s+GPA\s+\(CGPA\)|Mid\s+1\s+Marks|Mid\s+2\s+Marks|Hall\s+Ticket\s+\/\s+Reg\s+No|Branch|Office|Location|Counselor|Advisor|Room|Floor|Block):\s*(.*)$/i;
    
    const match = lineText.trim().match(keyRegex);
    if (match) {
      const key = match[1];
      const val = match[2];
      
      // If the field is a Name, make the name extra bold and beautiful
      if (key.toLowerCase().includes("name")) {
        return `<div class="my-2 flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-1"><strong class="${fieldKeyClass} shrink-0 font-bold">${key}:</strong><strong class="${fieldNameClass} break-words font-extrabold text-sm sm:text-base font-sans tracking-tight">${val}</strong></div>`;
      } else {
        return `<div class="my-2 flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-1"><strong class="${fieldKeyClass} shrink-0 font-bold">${key}:</strong><span class="${fieldValueClass} break-words font-bold">${val}</span></div>`;
      }
    }
    const withBoldMarkdown = lineText.replace(/\*\*(.*?)\*\*/g, "<strong class=\"font-extrabold\">$1</strong>");
    // Keep response prose readable while making field-like lead-ins prominent.
    return withBoldMarkdown.replace(/(^|[.!?]\s+)([^:\n]{2,64}):\s*/g, `$1<strong class="${fieldKeyClass} font-extrabold">$2:</strong> `);
  };

  // Promote only clearly labelled comma-separated data into a real list.
  // Ordinary conversational prose remains a paragraph.
  formatted = formatted.replace(
    /(^|\n)((?:Departments?|Branches|Courses?|Program(?:me)?s|Subjects?|Documents?|Requirements?|Facilities|Specializations?)\s*:\s*)([^\n]+(?:,\s*[^\n]+){2,})/gim,
    (_match, prefix, label, items) => {
      const values = String(items).split(/,\s*/).map((item) => item.trim()).filter(Boolean);
      return `${prefix}${label}\n${values.map((item) => `- ${item}`).join('\n')}`;
    }
  );

  const lines = formatted.split("\n");
  let output = "";
  let inList = false;
  let listTag = "";
  let hasPreviousBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let trimmed = line.trim();
    
    let isBullet = trimmed.startsWith("* ") || trimmed.startsWith("- ");
    let isNumbered = /^\d+\.\s/.test(trimmed);
    
    // Check if this line starts a new person/faculty or department block
    let lineToCheck = trimmed;
    if (isBullet) {
      lineToCheck = trimmed.substring(2).trim();
    } else if (isNumbered) {
      lineToCheck = trimmed.replace(/^\d+\.\s/, '').trim();
    }
    
    const lowerLine = lineToCheck.toLowerCase();
    const isNewBlock = lowerLine.startsWith("faculty name:") || 
                       lowerLine.startsWith("name:") ||
                       lowerLine.startsWith("student name:") ||
                       lowerLine.startsWith("student profile:") ||
                       lowerLine.startsWith("department:");
    
    if (isNewBlock) {
      if (hasPreviousBlock) {
        if (inList) {
          output += `</${listTag}>`;
          inList = false;
        }
        // Beautiful elegant visual separator between people/entities with nice spacing
        output += `<div class="my-4 border-t border-slate-200/50 dark:border-slate-800/50 pt-3"></div>`;
      }
      hasPreviousBlock = true;
    }
    
    if (isBullet || isNumbered) {
        let currentTag = isBullet ? "ul" : "ol";
        if (!inList) {
          listTag = currentTag;
          output += `<${listTag} class="list-${isBullet ? 'disc' : 'decimal'} pl-5 my-2">`;
          inList = true;
        } else if (listTag !== currentTag) {
          output += `</${listTag}>`;
          listTag = currentTag;
          output += `<${listTag} class="list-${isBullet ? 'disc' : 'decimal'} pl-5 my-2">`;
        }
        
        const rest = isBullet ? trimmed.substring(2) : trimmed.replace(/^\d+\.\s/, '');
        const formattedRest = formatContactFields(rest);
        output += `<li class="my-1">${formattedRest}</li>`;
    } else {
        if (inList) {
          output += `</${listTag}>`;
          inList = false;
        }
        if (trimmed) {
            const formattedLine = formatContactFields(line);
            output += formattedLine.startsWith('<div')
              ? formattedLine
              : `<p class="my-1.5 break-words">${formattedLine}</p>`;
        }
    }
  }
  if (inList) output += `</${listTag}>`;
  return output;
};

// Notice authors enter plain line breaks in the admin editor. Markdown only
// treats blank lines as paragraph breaks, so convert single line breaks to
// explicit Markdown breaks while preserving blank-line paragraph spacing.
const formatNoticeMarkdown = (text: string) =>
  text
    .trim()
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, '  \n'))
    .join('\n\n');

const TypingText = ({ text, speed, isDark, onComplete }: { text: string; speed: number; isDark: boolean; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => text.slice(0, prev.length + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  const formattedHtml = formatMarkdown(displayedText, isDark);
  return <span dangerouslySetInnerHTML={{ __html: formattedHtml }} />;
};

const TypingIndicator = () => (
  <div className="flex gap-1 px-2 py-1 items-center">
    <motion.span
      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
    />
    <motion.span
      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
    />
    <motion.span
      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
    />
  </div>
);

export default function ChatbotWidget({ 
  rules, 
  departments, 
  supportTickets, 
  portalItems,
  notices,
  onAddLog, 
  onAddSupportTicket,
  forceOpenTrackerEmail,
  onClearForceTrackerEmail,
  typingSpeed,
  isMaximized,
  setIsMaximized
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFirstVisitPopup, setShowFirstVisitPopup] = useState(true);
  const { isDark, toggleTheme } = useTheme();
  const [inputText, setInputText] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [recentQuestions, setRecentQuestions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nexa_recent_questions') || '[]').slice(0, 5); }
    catch { return []; }
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trackingStep, setTrackingStep] = useState<'none' | 'awaiting_identifier'>('none');
  useEffect(() => {
    // Component cleanup
    return () => {
      speechService.stop();
      if (typeof window !== 'undefined') {
        speechService.clearCache();
      }
    };
  }, []);

  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };
    
    updateVoices();
    
    // Listen for voiceschanged event
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Active Tab/View state
  // Modes: 'chat' | 'tracker' | 'student-portal' | 'notices' | 'ticketForm'
  const [activeTab, setActiveTab] = useState<'chat' | 'tracker' | 'student-portal' | 'notices' | 'ticketForm'>('chat');
  const [selectedNoticeImage, setSelectedNoticeImage] = useState<{ url: string; title: string } | null>(null);
  
  // Track last unanswered query for ticket form pre-fill
  const [lastUnansweredQuery, setLastUnansweredQuery] = useState<string>('');

  const startScrollDrag = (axis: 'x' | 'y') => (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch devices retain their native swipe behaviour. This adds a familiar
    // click-and-drag interaction for desktop users after hiding scrollbar tracks.
    if (event.pointerType === 'touch' || event.button !== 0) return;
    const element = event.currentTarget;
    const startPosition = axis === 'x' ? event.clientX : event.clientY;
    const startScroll = axis === 'x' ? element.scrollLeft : element.scrollTop;
    const onMove = (moveEvent: PointerEvent) => {
      const currentPosition = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPosition - startPosition;
      if (axis === 'x') element.scrollLeft = startScroll - delta;
      else element.scrollTop = startScroll - delta;
    };

    const onEnd = () => {
      element.classList.remove('select-none');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };

    element.classList.add('select-none');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
  };

  const [language, setLanguage] = useState<'en' | 'hi' | 'te'>('en');

  useEffect(() => {
    // Stop speech when switching tabs, language, or closing the widget
    speechService.stop();
  }, [activeTab, isOpen, language]);

  // Translated Rules for Multilingual Display
  const [translatedRules, setTranslatedRules] = useState<Rule[]>([]);
  const [isTranslatingRules, setIsTranslatingRules] = useState(false);

  const displayRules = translatedRules.length > 0 ? translatedRules : rules;

  // Window Resize & Speech & Support Ticket States
  type ResizeDirection = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number, y: number, startWidth: number, startHeight: number, direction: ResizeDirection } | null>(null);
  const [customSize, setCustomSize] = useState<{ width: number, height: number }>({ width: 380, height: 600 });
  const [trackerEmail, setTrackerEmailState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexa_tracker_email') || '';
    }
    return '';
  });

  const setTrackerEmail = (email: string) => {
    setTrackerEmailState(email);
    if (typeof window !== 'undefined') {
      if (email) {
        localStorage.setItem('nexa_tracker_email', email);
      } else {
        localStorage.removeItem('nexa_tracker_email');
      }
    }
  };
  useEffect(() => {
    if (!isOpen) {
        handleStopSpeech();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
        handleStopSpeech();
    };
  }, []);

  useEffect(() => {
    handleStopSpeech();
  }, [activeTab]);

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [hasSearchedPortal, setHasSearchedPortal] = useState(false);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);

  const [viewedTicketIds, setViewedTicketIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('college_viewed_ticket_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('college_viewed_ticket_ids', JSON.stringify(viewedTicketIds));
    } catch (e) {}
  }, [viewedTicketIds]);



  useEffect(() => {
    if (activeTab === 'tracker' && trackerEmail) {
      const searchClean = trackerEmail.trim().toLowerCase();
      if (searchClean) {
        const matchedResolvedIds = supportTickets
          .filter(t => t.email.toLowerCase() === searchClean && t.status === 'Resolved')
          .map(t => t.id);
        if (matchedResolvedIds.length > 0) {
          setViewedTicketIds(prev => {
            const next = [...prev];
            let updated = false;
            matchedResolvedIds.forEach(id => {
              if (!next.includes(id)) {
                next.push(id);
                updated = true;
              }
            });
            return updated ? next : prev;
          });
        }
      }
    }
  }, [activeTab, trackerEmail, supportTickets]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speechText, setSpeechText] = useState('');

  const handleStopSpeech = () => {
    speechService.stop();
    setSpeakingId(null);
    setIsSpeechPaused(false);
    // Also stop any active speech recognition session
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch (e) {
      console.warn('Error stopping recognition:', e);
    }
  };

  /*
  const LanguageSelector = () => (
    <div className="relative">
      <button
        onClick={() => setShowLanguageMenu(!showLanguageMenu)}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600 transition-colors"
      >
        <span>{language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Telugu'}</span>
        <ChevronDown size={14} />
      </button>
      {showLanguageMenu && (
        <div className="absolute right-0 bottom-full mb-2 bg-white dark:bg-slate-800 shadow-lg rounded-lg border border-slate-200 dark:border-slate-700 py-1 w-24 z-50">
          {(['en', 'hi', 'te'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang);
                setShowLanguageMenu(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 ${language === lang ? 'text-emerald-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Telugu'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  */

  const translations = {
    en: {
      chat: "Chat",
      portal: "Attendance and Portals",
      tracker: "Tracker",
      notices: "Notices",
      online: "Online",
      inputPlaceholder: "Type your query here...",
      submitTicket: "Submit ticket form",
      backToChat: "Back to Chat",
      nameLabel: "Full Name",
      emailLabel: "Email Address",
      phoneLabel: "Contact Number",
      queryLabel: "Your Message",
      submitButton: "Submit Ticket",
      submitting: "Submitting...",
      ticketSuccess: "Ticket Submitted!",
      quickActions: "Quick Actions",
      suggestions: "Suggestions",
      attendanceTracker: "Narayana Student Portal",
      enterRegNo: "Enter Hall Ticket Number...",
      searchButton: "Query Database",
      searching: "Querying...",
      regNo: "Reg No",
      name: "Name",
      branch: "Branch",
      attendance: "Attendance",
      cgpa: "CGPA",
      mid1: "Mid-1 Marks",
      mid2: "Mid-2 Marks",
      soundOn: "Sound On",
      soundOff: "Sound Off",
      ticketIntro: "Need direct human evaluation? Fill out your details below and a Narayana Admissions Advisor will review your query. Our alert systems will notify you the exact second an answer gets posted.",
      ticketBroadcast: "Broadcasting notification listeners...",
      fullNameLabel: "Your Full Name",
      detailedQueryLabel: "Detailed Query",
      cancel: "Cancel",
      portalTitle: "Attendance & Hall Ticket Status",
      portalIntro: "Query the Narayana Central Attendance Server (E-Cap sync active). Enter a registered B.Tech hall ticket code (e.g. 26911A0501 to 26911A0510) to check attendance percentage, internal marks, and condonation status.",
      searchPlaceholder: "e.g. 26911A0501",
      searchBtnText: "Search",
      safeStatus: "✅ SAFE",
      riskStatus: "⚠️ CONDONATION RISK",
      academicMetrics: "Academic Metrics:",
      gpaLabel: "Cumulative GPA:",
      internalExamsLabel: "Internal Exams:",
      safeTip: "Excellent attendance record. You meet the AICTE minimum criteria.",
      riskTip: "Warning: Your percentage is below 75%. Submit a medical certificate to your CSE/ECE advisor immediately.",
      noDataFound: "No records found for this Hall Ticket number. Please verify the code or log a support ticket.",
      fileTicketBtn: "File Support Ticket",
      portalLinksTitle: "Portal Links",
      dataSyncLabel: "ECAP Data Sync Date:",
      trackTitle: "Track Support Ticket",
      trackIntro: "Enter your registered Email Address to track the status, counselor replies, and dispatch logs of your submitted support queries in real time.",
      trackPlaceholder: "yourname@gmail.com",
      trackSearchBtn: "Track Tickets",
      noTicketsFound: "No active support tickets found for this email address.",
      ticketDetails: "Ticket Details",
      unassigned: "Unassigned",
      resolved: "Resolved",
      openStatus: "Open / In Queue",
      replyLabel: "Counselor Reply",
      noticesTitle: "Narayana NEXA | College Notice Board",
      noticesIntro: "Real-time notice board and administrative circulars synced from the college register. Stay updated with upcoming schedules, placement drives, and examination deadlines.",
      noNotices: "No active notices posted on the board.",
      chatHeading: "Narayana NEXA",
      chatSubheading: "Official AI Admissions & Counseling Helpdesk",
      footerCopyright: "Narayana Educational Institutions",
      suggestedTopicsHeader: "Suggested Topics:"
    },
    hi: {
      chat: "चैट",
      portal: "उपस्थिति और पोर्टल",
      tracker: "ट्रैकर",
      notices: "नोटिस",
      online: "ऑनलाइन",
      inputPlaceholder: "अपना प्रश्न यहाँ लिखें...",
      submitTicket: "Submit ticket form",
      backToChat: "चैट पर वापस जाएं",
      nameLabel: "पूरा नाम",
      emailLabel: "ईमेल पता",
      phoneLabel: "संपर्क नंबर",
      queryLabel: "आपका संदेश",
      submitButton: "टिकट जमा करें",
      submitting: "जमा किया जा रहा है...",
      ticketSuccess: "टिकट जमा हो गया!",
      quickActions: "त्वरित कार्रवाई",
      suggestions: "सुझाव",
      attendanceTracker: "नारायणा छात्र पोर्टल",
      enterRegNo: "हॉल टिकट नंबर दर्ज करें...",
      searchButton: "डेटाबेस खोजें",
      searching: "खोज की जा रही है...",
      regNo: "पंजीकरण संख्या",
      name: "नाम",
      branch: "शाखा",
      attendance: "उपस्थिति",
      cgpa: "सीजीपीए",
      mid1: "मिड-1 अंक",
      mid2: "मिड-2 अंक",
      soundOn: "ध्वनि चालू",
      soundOff: "ध्वनि बंद",
      ticketIntro: "क्या आपको सीधे मानव मूल्यांकन की आवश्यकता है? नीचे अपना विवरण भरें और नारायणा प्रवेश सलाहकार आपके प्रश्न की समीक्षा करेंगे। जैसे ही कोई उत्तर पोस्ट किया जाएगा, हमारी अलर्ट प्रणाली आपको सूचित कर देगी।",
      ticketBroadcast: "अधिसूचना श्रोताओं को प्रसारित किया जा रहा है...",
      fullNameLabel: "आपका पूरा नाम",
      detailedQueryLabel: "विस्तृत प्रश्न",
      cancel: "रद्द करें",
      portalTitle: "उपस्थिति और हॉल टिकट की स्थिति",
      portalIntro: "नारायणा केंद्रीय उपस्थिति सर्वर खोजें (ई-कैप सिंक सक्रिय)। उपस्थिति प्रतिशत, आंतरिक अंक और चिकित्सा छूट पात्रता की जांच करने के लिए पंजीकृत बी.टेक हॉल टिकट कोड (जैसे 26911A0501 से 26911A0510) दर्ज करें।",
      searchPlaceholder: "जैसे 26911A0501",
      searchBtnText: "खोजें",
      safeStatus: "✅ सुरक्षित",
      riskStatus: "⚠️ कम उपस्थिति जोखिम",
      academicMetrics: "शैक्षणिक मेट्रिक्स:",
      gpaLabel: "संचयी जीपीए:",
      internalExamsLabel: "आंतरिक परीक्षा:",
      safeTip: "उत्कृष्ट उपस्थिति रिकॉर्ड। आप एआईसीटीई के न्यूनतम मानदंडों को पूरा करते हैं।",
      riskTip: "चेतावनी: आपका प्रतिशत 75% से कम है। अपने सीएसई/ईसीई सलाहकार को तुरंत मेडिकल सर्टिफिकेट जमा करें।",
      noDataFound: "इस हॉल टिकट नंबर के लिए कोई रिकॉर्ड नहीं मिला। कृपया कोड सत्यापित करें या सपोर्ट टिकट दर्ज करें।",
      fileTicketBtn: "सपोर्ट टिकट दर्ज करें",
      portalLinksTitle: "पोर्टल लिंक",
      dataSyncLabel: "ई-कैप डेटा सिंक तिथि:",
      trackTitle: "सपोर्ट टिकट ट्रैक करें",
      trackIntro: "अपने सबमिट किए गए प्रश्नों की स्थिति, सलाहकार के उत्तर और वास्तविक समय में भेजे गए लॉग को ट्रैक करने के लिए अपना पंजीकृत ईमेल पता दर्ज करें।",
      trackPlaceholder: "अपना ईमेल यहाँ दर्ज करें...",
      trackSearchBtn: "टिकट ट्रैक करें",
      noTicketsFound: "इस ईमेल पते के लिए कोई सक्रिय सपोर्ट टिकट नहीं मिला।",
      ticketDetails: "टिकट विवरण",
      unassigned: "अनिर्धारित",
      resolved: "हल हो गया",
      openStatus: "खुला / कतार में",
      replyLabel: "सलाहकार का जवाब",
      noticesTitle: "नारायणा नेक्సా | कॉलेज नोटिस बोर्ड",
      noticesIntro: "कॉलेज रजिस्टर से सिंक किए गए वास्तविक समय के नोटिस बोर्ड और प्रशासनिक परिपत्र। आगामी कार्यक्रमों, प्लेसमेंट ड्राइव और परीक्षा की समय सीमा से अपडेट रहें।",
      noNotices: "बोर्ड पर कोई सक्रिय नोटिस नहीं है।",
      chatHeading: "नारायणा नेक्सा",
      chatSubheading: "आधिकारिक एआई प्रवेश और परामर्श सहायता डेस्क",
      footerCopyright: "नारायणा शैक्षणिक संस्थान",
      suggestedTopicsHeader: "सुझाए गए विषय:"
    },
    te: {
      chat: "చాట్",
      portal: "హాజరు మరియు పోర్టల్స్",
      tracker: "ట్రాకర్",
      notices: "నోటీసులు",
      online: "ఆన్‌లైన్",
      inputPlaceholder: "మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి...",
      submitTicket: "Submit ticket form",
      backToChat: "చాట్‌కు తిరిగి వెళ్ళండి",
      nameLabel: "పూర్తి పేరు",
      emailLabel: "ఈమెయిల్ చిరునామా",
      phoneLabel: "సంప్రదింపు సంఖ్య",
      queryLabel: "మీ సందేశం",
      submitButton: "టికెట్ సమర్పించండి",
      submitting: "సమర్పిస్తోంది...",
      ticketSuccess: "టికెట్ సమర్పించబడింది!",
      quickActions: "త్వరిత చర్యలు",
      suggestions: "సూచనలు",
      attendanceTracker: "నారాయణ విద్యార్థి పోర్టల్",
      enterRegNo: "హాల్ టికెట్ నంబర్ నమోదు చేయండి...",
      searchButton: "డేటాబేస్ శోధించండి",
      searching: "శోధిస్తోంది...",
      regNo: "నమోదు సంఖ్య",
      name: "పేరు",
      branch: "శాఖ",
      attendance: "హాజరు",
      cgpa: "సిజిపిఎ",
      mid1: "మిడ్-1 మార్కులు",
      mid2: "మిడ్-2 మార్కులు",
      soundOn: "ధ్వని ఆన్",
      soundOff: "ధ్వని ఆఫ్",
      ticketIntro: "ప్రత్యక్ష మానవ మూల్యాంకనం కావాలా? మీ వివరాలను దిగువన పూరించండి మరియు నారాయణ అడ్మిషన్ల సలహాదారు మీ ప్రశ్నను సమీక్షిస్తారు. సమాధానం పోస్ట్ చేసిన సెకనులోనే మా అలర్ట్ సిస్టమ్స్ మీకు తెలియజేస్తాయి.",
      ticketBroadcast: "నోటిఫికేషన్ అలర్ట్‌లు సిద్ధం చేస్తున్నాము...",
      fullNameLabel: "మీ పూర్తి పేరు",
      detailedQueryLabel: "వివరణాత్మక ప్రశ్న",
      cancel: "రద్దు చేయి",
      portalTitle: "హాజరు & హాల్ టికెట్ స్థితి",
      portalIntro: "నారాయణ సెంట్రల్ అటెండెన్స్ సర్వర్‌ను శోధించండి (ఈ-క్యాప్ సింక్ యాక్టివ్). హాజరు శాతం, అంతర్గత మార్కులు మరియు కండోనేషన్ స్థితిని తనిఖీ చేయడానికి నమోదిత బి.టెక్ హాల్ టికెట్ కోడ్‌ను (ఉదా. 26911A0501 నుండి 26911A0510 వరకు) నమోదు చేయండి.",
      searchPlaceholder: "ఉదా. 26911A0501",
      searchBtnText: "శోధించండి",
      safeStatus: "✅ క్షేమంగా ఉంది",
      riskStatus: "⚠️ కండోనేషన్ ప్రమాదం",
      academicMetrics: "విద్యా ప్రమాణాలు:",
      gpaLabel: "మొత్తం జీపీఏ:",
      internalExamsLabel: "అంతర్గత పరీక్షలు:",
      safeTip: "అద్భుతమైన హాజరు రికార్డు. మీరు AICTE కనీస ప్రమాణాలను అందుకున్నారు.",
      riskTip: "హెచ్చరిక: మీ హాజరు శాతం 75% కంటే తక్కువగా ఉంది. వెంటనే మీ సీఎస్ఈ/ఈసీఈ సలహాదారునికి మెడికల్ సర్టిఫికెట్ సమర్పించండి.",
      noDataFound: "ఈ హాల్ టికెట్ నంబర్‌కు ఎటువంటి రికార్డులు కనుగొనబడలేదు. దయచేసి కోడ్‌ను ధృవీకరించండి లేదా మద్దతు టికెట్‌ను నమోదు చేయండి.",
      fileTicketBtn: "మద్దతు టికెట్ నమోదు చేయండి",
      portalLinksTitle: "పోర్టల్ లింకులు",
      dataSyncLabel: "ECAP డేటా సింక్ తేదీ:",
      trackTitle: "మద్దతు టికెట్ ట్రాక్ చేయండి",
      trackIntro: "మీరు సమర్పించిన ప్రశ్నల స్థితిని, సలహాదారు సమాధానాలను మరియు డిస్పాచ్ లాగ్‌లను నిజ సమయంలో ట్రాక్ చేయడానికి మీ నమోదిత ఈమెయిల్ చిరునామాను నమోదు చేయండి.",
      trackPlaceholder: "మీ ఈమెయిల్ ఇక్కడ నమోదు చేయండి...",
      trackSearchBtn: "టికెట్లను ట్రాక్ చేయండి",
      noTicketsFound: "ఈ ఈమెయిల్ చిరునామాపై ఎటువంటి సక్రియ మద్దతు టికెట్లు కనుగొనబడలేదు.",
      ticketDetails: "టికెట్ వివరాలు",
      unassigned: "కేటాయించబడలేదు",
      resolved: "పరిష్కరించబడింది",
      openStatus: "ఓపెన్ / క్యూలో ఉంది",
      replyLabel: "సలహాదారు సమాధానం",
      noticesTitle: "నారాయణ NEXA | కాలేజీ నోటీసు బోర్డు",
      noticesIntro: "కళాశాల రిజిస్టర్ నుండి సమకాలీకరించబడిన నిజ-సమయ నోటీసు బోర్డు మరియు పరిపాలనా సర్క్యులర్లు. రాబోయే షెడ్యూల్‌లు, ప్లేస్‌మెంట్ డ్రైవ్‌లు మరియు పరీక్షల గడువులతో అప్‌డేట్ అవ్వండి.",
      noNotices: "బోర్డుపై ఎటువంటి సక్రియ నోటీసులు లేవు.",
      chatHeading: "నారాయణ నెక్సా",
      chatSubheading: "అధికారిక AI అడ్మిషన్ల & కౌన్సిలింగ్ హెల్ప్‌డెస్క్",
      footerCopyright: "నారాయణ విద్యా సంస్థలు",
      suggestedTopicsHeader: "సూచించబడిన అంశాలు:"
    }
  };

  type TranslationKey = keyof typeof translations.en;
  const t = (key: TranslationKey): string => translations[language][key] || key;

  // Sound States and player
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchRegNo, setSearchRegNo] = useState('');
  const [studentPortalResult, setStudentPortalResult] = useState<any | null>(null);
  const [isSearchingPortal, setIsSearchingPortal] = useState(false);

  const playNotificationSound = (type: 'send' | 'receive') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'send') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        const playChime = (freq: number, startTime: number, duration: number, volume: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(volume, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        playChime(600, ctx.currentTime, 0.1, 0.2);
        playChime(800, ctx.currentTime + 0.1, 0.15, 0.15);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll helpers: container ref, user position detection, and smooth adaptive scroll behavior
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userAtBottomRef = useRef<boolean>(true);
  const SCROLL_THRESHOLD = 160; // px — consider user 'at bottom' when within this distance

  const handleScroll = () => {
    const c = containerRef.current;
    if (!c) return;
    const distanceFromBottom = c.scrollHeight - (c.scrollTop + c.clientHeight);
    userAtBottomRef.current = distanceFromBottom <= SCROLL_THRESHOLD;
  };

  const scrollToBottom = (opts: ScrollIntoViewOptions = { behavior: 'smooth', block: 'end', inline: 'nearest' }) => {
    const endEl = messagesEndRef.current;
    const c = containerRef.current;
    try {
      if (endEl && (userAtBottomRef.current || !c)) {
        endEl.scrollIntoView(opts);
        return;
      }
      if (c && userAtBottomRef.current) {
        // Smooth scroll the container to its bottom
        c.scrollTo({ top: c.scrollHeight, behavior: (opts && (opts as any).behavior) === 'smooth' ? 'smooth' : 'auto' } as ScrollToOptions);
      }
    } catch (e) {
      if (endEl) endEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Keep userAtBottomRef in sync with manual scrolls
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    handleScroll();
    const onScroll = () => handleScroll();
    c.addEventListener('scroll', onScroll, { passive: true });
    return () => c.removeEventListener('scroll', onScroll);
  }, []);

  // When messages change or typing state changes, adaptively scroll
  // If user just asked a question, force scroll to the latest content
  useEffect(() => {
    if (userJustAskedRef.current) {
      userJustAskedRef.current = false;
      forceScrollToBottom();
      const c = containerRef.current;
      if (!c) return;
      const ro = new ResizeObserver(() => { forceScrollToBottom(); });
      ro.observe(c);
      const imgs = Array.from(c.querySelectorAll('img')) as HTMLImageElement[];
      imgs.forEach(img => img.addEventListener('load', forceScrollToBottom));
      const interval = setInterval(forceScrollToBottom, 200);
      const timeout = setTimeout(() => { clearInterval(interval); ro.disconnect(); imgs.forEach(img => img.removeEventListener('load', forceScrollToBottom)); }, 1400);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        try { ro.disconnect(); } catch (e) {}
        imgs.forEach(img => img.removeEventListener('load', forceScrollToBottom));
      };
    }

    if (!userAtBottomRef.current) return;

    scrollToBottom();
    const c = containerRef.current;
    if (!c) return;

    const ro = new ResizeObserver(() => {
      if (userAtBottomRef.current) scrollToBottom();
    });
    ro.observe(c);

    const imgs = Array.from(c.querySelectorAll('img')) as HTMLImageElement[];
    const onImgLoad = () => { if (userAtBottomRef.current) scrollToBottom(); };
    imgs.forEach(img => img.addEventListener('load', onImgLoad));

    const interval = setInterval(() => { if (userAtBottomRef.current) scrollToBottom(); }, 200);
    const timeout = setTimeout(() => { clearInterval(interval); ro.disconnect(); imgs.forEach(img => img.removeEventListener('load', onImgLoad)); }, 1400);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      try { ro.disconnect(); } catch (e) {}
      imgs.forEach(img => img.removeEventListener('load', onImgLoad));
    };
  }, [messages, isTyping]);

  // Quick reply buttons suited for a professional college/admissions chatbot
  const getDynamicQuickReplies = () => {
    const base = [
      'Admissions',
      'Placements',
      'Fee Structure',
      'Courses',
      'Hostel',
      'Transport',
      'Scholarships',
      'Departments',
      'CSE HOD',
      'My Attendance'
    ];

    return base;
  };

  // Autocomplete instant suggestion matching active rules (language-aware)
  const fuzzySimilarity = (source: string, target: string) => {
    const a = source.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const b = target.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (!a || !b) return 0;
    if (b.includes(a) || a.includes(b)) return 1;
    const maxLength = Math.max(a.length, b.length);
    if (maxLength > 42) return 0;
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const saved = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = saved;
      }
    }
    return 1 - row[b.length] / maxLength;
  };

  const getAutocompleteSuggestions = (): Rule[] => {
    if (!inputText.trim()) return [];
    const query = inputText.toLowerCase();
    return displayRules
      .filter(r => r.status === 'Active')
      .map(rule => {
        const searchable = [rule.question, rule.keywords || '', rule.synonyms || '', ...(Array.isArray(rule.relatedQuestions) ? rule.relatedQuestions : [])].join(' ');
        const direct = searchable.toLowerCase().includes(query) ? 1 : 0;
        return { rule, score: Math.max(direct, fuzzySimilarity(query, rule.question), fuzzySimilarity(query, rule.keywords || ''), fuzzySimilarity(query, rule.synonyms || '')) };
      })
      .filter(item => item.score >= 0.46)
      .sort((a, b) => b.score - a.score || a.rule.question.localeCompare(b.rule.question))
      .map(item => item.rule)
      .slice(0, 4);
  };

  const getRelatedQuestions = (rule: Rule) => displayRules
    .filter(candidate => candidate.status === 'Active' && candidate.id !== rule.id)
    .filter(candidate => candidate.category === rule.category || candidate.relatedDepartment === rule.relatedDepartment)
    .slice(0, 3)
    .map(candidate => candidate.question);

  // Welcome configuration helpers
  const getWelcomeText = () => {
    if (language === 'hi') {
      return "👋 नारायणा नेक्सा में आपका स्वागत है\nनारायणा इंजीनियरिंग कॉलेज का आधिकारिक डिजिटल सहायक।";
    }
    if (language === 'te') {
      return "👋 నారాయణ నెక్సాకు స్వాగతం\nనారాయణ ఇంజనీరింగ్ కాలేజ్ అధికారిక డిజిటల్ అసిస్టెంట్.";
    }
    return "👋 Welcome to Narayana NEXA\nThe Official Digital Assistant of Narayana Engineering College.";
  };

  const getClearedText = () => {
    if (language === 'hi') {
      return "चैट इतिहास हटा दिया गया है। नारायणा इंजीनियरिंग कॉलेज के बारे में मैं आपकी क्या सहायता कर सकता हूँ?";
    }
    if (language === 'te') {
      return "చాట్ చరిత్ర క్లియర్ చేయబడింది. నారాయణ ఇంజనీరింగ్ కాలేజీ సమాచారంతో నేను మీకు ఎలా సహాయపడగలను?";
    }
    return "Chat history cleared. How else can I assist you with Narayana Engineering College information?";
  };

  const getSuggestions = () => {
    if (language === 'hi') {
      return [
        'प्रवेश प्रक्रिया क्या है?',
        'बी.टेक के लिए शुल्क संरचना क्या है?',
        'सीएसई विभाग के अध्यक्ष कौन हैं?',
        'प्लेसमेंट आँकड़े क्या हैं?'
      ];
    }
    if (language === 'te') {
      return [
        'అడ్మిషన్ల ప్రక్రియ ఏమిటి?',
        'బి.టెక్ ఫీజుల వివరాలు ఏమిటి?',
        'CSE హెచ్‌ఓడీ ఎవరు?',
        'ప్లేస్‌మెంట్ గణాంకాలు ఏమిటి?'
      ];
    }
    return [
      'What is the admission process?',
      'What is the fee structure for B.Tech?',
      'Who is CSE HOD?',
      'What are the placement statistics?'
    ];
  };

  const welcomeMessage = "👋 Welcome to Narayana NEXA\nThe Official Digital Assistant of Narayana Engineering College.";
  const defaultSuggestions = [
    'Where is the college located?',
    'What courses are offered?',
    'What is the admission process?',
    'Who can I contact for admissions?',
    'What are the college working hours?'
  ];

  // Translation states for active chat history
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const originalMessagesRef = useRef<Record<string, string>>({});

  // Capture original messages for dynamic switching
  useEffect(() => {
    messages.forEach(msg => {
      if (!originalMessagesRef.current[msg.id]) {
        originalMessagesRef.current[msg.id] = msg.text;
      }
    });
  }, [messages]);

  // Dynamically fetch translations for any untranslated messages in the background
  useEffect(() => {
    const translateHistory = async () => {
      if (language === 'en') return;

      // 1. Check local storage
      const cached = JSON.parse(localStorage.getItem('nexa_translations') || '{}');
      
      const missing = messages.filter(m => {
        // Skip welcome messages as they have native instant translation
        if (m.id === 'welcome' || m.id === 'cleared-welcome') return false;
        // Check if already in state OR local storage
        return !translatedMessages[`${m.id}_${language}`] && !cached[`${m.id}_${language}`];
      });

      // Hydrate state from cache
      if (Object.keys(cached).length > 0) {
        setTranslatedMessages(prev => ({ ...cached, ...prev }));
      }

      if (missing.length === 0) return;

      setIsTranslatingRules(true);
      try {
        const response = await apiFetch('/api/translate-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: missing.map(m => ({ id: m.id, text: originalMessagesRef.current[m.id] || m.text })),
            targetLanguage: language
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.translatedMessages) {
            const newTranslations: Record<string, string> = {};
            data.translatedMessages.forEach((t: any) => {
              newTranslations[`${t.id}_${language}`] = t.text;
            });

            setTranslatedMessages(prev => ({ ...prev, ...newTranslations }));
            
            // Update localStorage
            const updatedCache = { ...cached, ...newTranslations };
            localStorage.setItem('nexa_translations', JSON.stringify(updatedCache));
          }
        }
      } catch (err) {
        console.error("Failed to translate history:", err);
      } finally {
        setIsTranslatingRules(false);
      }
    };

    translateHistory();
  }, [messages, language]);

  // Initialize conversations
  useEffect(() => {
    if (messages.length === 0) {
      resetChat();
    }
  }, [rules]);

  // Optimize dependency checking for rule translations to prevent redundant requests
  const rulesFingerprint = JSON.stringify(
    rules
      .filter(r => r.status === 'Active')
      .map(r => ({ id: r.id, q: r.question, a: r.answer }))
  );

  // Synchronize rules translation when rules or language changed
  useEffect(() => {
    const syncTranslatedRules = async () => {
      if (language === 'en') {
        setTranslatedRules([]);
        return;
      }
      setIsTranslatingRules(true);
      try {
        const response = await apiFetch('/api/translate-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules, language })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.translatedRules) {
            const merged = rules.map(orig => {
              const trans = data.translatedRules.find((t: any) => t.id === orig.id);
              if (trans) {
                return {
                  ...orig,
                  question: trans.question,
                  answer: trans.answer
                };
              }
              return orig;
            });
            setTranslatedRules(merged);
          }
        }
      } catch (err) {
        console.error("Rule translation synchronization failed:", err);
      } finally {
        setIsTranslatingRules(false);
      }
    };

    syncTranslatedRules();
  }, [rulesFingerprint, language]);

  // Reusable 360-degree resize behavior. Dimensions are clamped to the
  // viewport so the floating assistant can never leave usable screen space.
  const beginResize = (direction: ResizeDirection) => (event: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(max-width: 639px)').matches) return;
    event.preventDefault();
    const element = document.getElementById('necn-chatbot-widget-container');
    if (!element) return;
    setIsMaximized(false);
    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      startWidth: element.offsetWidth,
      startHeight: element.offsetHeight,
      direction
    };
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current) return;
      const start = resizeStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const growsLeft = start.direction.includes('left');
      const growsRight = start.direction.includes('right');
      const growsTop = start.direction.includes('top');
      const growsBottom = start.direction.includes('bottom');
      const requestedWidth = start.startWidth + (growsLeft ? -dx : growsRight ? dx : 0);
      const requestedHeight = start.startHeight + (growsTop ? -dy : growsBottom ? dy : 0);
      const maxWidth = Math.max(320, window.innerWidth - 32);
      const maxHeight = Math.max(420, window.innerHeight - 32);
      setCustomSize({
        width: Math.min(maxWidth, Math.max(320, requestedWidth)),
        height: Math.min(maxHeight, Math.max(420, requestedHeight))
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Auto-focus tracking: when user submits a new question, force scroll to the answer
  const userJustAskedRef = useRef<boolean>(false);
  const forceScrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const endEl = messagesEndRef.current;
      const c = containerRef.current;
      if (endEl) {
        endEl.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      }
      if (c) {
        c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
      }
    });
  }, []);

  // Session management: clear chat when minimized and inactive for 60 seconds
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasMinimizedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      wasMinimizedRef.current = false;
    } else {
      if (!wasMinimizedRef.current) {
        wasMinimizedRef.current = true;
        inactivityTimerRef.current = setTimeout(() => {
          if (messages.length > 0) {
            setMessages([]);
            setTimeout(() => {
              const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setMessages([{
                id: 'cleared-welcome',
                sender: 'bot',
                text: getClearedText(),
                timestamp: time,
                suggestedQuestions: defaultSuggestions
              }]);
            }, 100);
          }
        }, 60000);
      }
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isOpen, messages.length]);

  // (Replaced) Adaptive auto-scroll is implemented above using containerRef and userAtBottomRef
  // The legacy effect is removed in favor of the adaptive observer-driven implementation.

  // Handle external triggers to open tracker with predefined email search
  useEffect(() => {
    if (forceOpenTrackerEmail) {
      setIsOpen(true);
      setActiveTab('tracker');
      setTrackerEmail(forceOpenTrackerEmail);
      if (onClearForceTrackerEmail) {
        onClearForceTrackerEmail();
      }
    }
  }, [forceOpenTrackerEmail]);



  const resetChat = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: welcomeMessage,
        timestamp: time,
        suggestedQuestions: defaultSuggestions
      }
    ]);
  };

  const clearChat = () => {
    setMessages([]);
    setTimeout(() => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([
        {
          id: 'cleared-welcome',
          sender: 'bot',
          text: getClearedText(),
          timestamp: time,
          suggestedQuestions: defaultSuggestions
        }
      ]);
    }, 100);
  };

  // Speech Synthesis (Read Aloud)
  useEffect(() => {
    if (!isOpen) {
      speechService.stop();
      setSpeakingId(null);
      setIsSpeechPaused(false);
    }
  }, [isOpen]);

  // AI Instant Suggestions
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (inputText.length > 2) {
        try {
          const response = await apiFetch(`/api/kb/suggest?q=${encodeURIComponent(inputText)}`);
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        } catch (error) {
          console.error("Error fetching suggestions:", error);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [inputText]);

  // Update language when it changes
  useEffect(() => {
    speechService.setLanguage(language);
    handleStopSpeech();
  }, [language]);

  const handlePauseSpeech = () => {
    speechService.pause();
    setIsSpeechPaused(true);
  };

  const handleResumeSpeech = () => {
    speechService.resume();
    setIsSpeechPaused(false);
  };

  const handleReplaySpeech = (text: string, messageId: string) => {
    handleStopSpeech();
    setTimeout(() => {
      handleSpeak(text, messageId);
    }, 100);
  };

  const handleSpeak = (text: string, messageId: string) => {
    if (speakingId === messageId) {
      if (isSpeechPaused) {
        handleResumeSpeech();
      } else {
        handlePauseSpeech();
      }
      return;
    }

    // Stop existing speech
    handleStopSpeech();
    setSpeechText(text);

    // Clean text of markdown and emojis
    const cleanText = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]|\*|_/g, '').trim();
    if (!cleanText) return;

    setSpeakingId(messageId);
    setIsSpeechPaused(false);
    speechService.setLanguage(language);
    speechService.speak(cleanText, () => {
      setSpeakingId((current) => current === messageId ? null : current);
    });
  };


  // Speech Recognition (Dictation)
  const isListeningRef = useRef<boolean>(false);
  const restartAttemptsRef = useRef<number>(0);

  const lastSentSpeechRef = useRef<string>('');
  const handleListen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Friendly in-UI alert to avoid blocking UX
      alert("Speech recognition is not supported in this browser. Please try using a modern browser such as Chrome or Edge.");
      return;
    }

    // Toggle off if currently listening
    if (isListening) {
      isListeningRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.warn('Error stopping recognition', e);
      }
      setIsListening(false);
      return;
    }

    // Build recognition instance
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    // Use short continuous segments for better cross-browser reliability
    recognition.continuous = false;
    // Pick a forgiving language fallback set for broader browsers
    recognition.lang = language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : (navigator.language || 'en-US');
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    console.log('[VOICE INPUT] Starting recognition with language:', recognition.lang);
    console.log('[VOICE INPUT] UI language:', language);

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      restartAttemptsRef.current = 0;
    };

    recognition.onresult = (event: any) => {
      try {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcript = (res[0] && res[0].transcript) ? String(res[0].transcript) : '';
          if (res.isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript + ' ';
          }
        }

        finalTranscript = finalTranscript.trim();
        interimTranscript = interimTranscript.trim();

        if (finalTranscript) {
          // Deduplicate to avoid repeated submissions caused by restarts
          const cleaned = finalTranscript.replace(/\s+/g, ' ').trim();
          if (cleaned && lastSentSpeechRef.current !== cleaned) {
            lastSentSpeechRef.current = cleaned;
            setInputText(cleaned);
            // Stop listening after receiving final transcript to avoid duplicates
            try { recognition.stop(); } catch (e) {}
            setIsListening(false);
            isListeningRef.current = false;
            // Submit message
            handleSendMessage(cleaned);
          } else {
            // No-op duplicated final transcript
            setIsListening(false);
            isListeningRef.current = false;
            try { recognition.stop(); } catch (e) {}
          }
        } else if (interimTranscript) {
          // Show interim transcript but do not submit
          setInputText(interimTranscript);
        }
      } catch (err) {
        console.error('onresult processing failed', err);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("[VOICE INPUT] Speech recognition error:", event?.error || event);
      setIsListening(false);
      isListeningRef.current = false;
      // Friendly guidance for permissions
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        alert("Microphone permission denied. Please enable microphone access in your browser settings and reload the page.");
      } else if (event?.error === 'no-speech') {
        // Prompt user silently; don't spam alerts
        console.warn("[VOICE INPUT] No speech detected — try speaking clearly or adjusting microphone volume.");
      } else {
        console.warn('[VOICE INPUT] Speech recognition error:', event?.error || event);
      }
    };

    recognition.onend = () => {
      // If user still expects the mic, attempt gentle automatic restart a few times
      if (isListeningRef.current && restartAttemptsRef.current < 5) {
        restartAttemptsRef.current += 1;
        const delay = 250 + restartAttemptsRef.current * 150;
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Recognition restart failed:', e);
            setIsListening(false);
            isListeningRef.current = false;
            recognitionRef.current = null;
          }
        }, delay);
      } else {
        setIsListening(false);
        isListeningRef.current = false;
        recognitionRef.current = null;
      }
    };

    try {
      restartAttemptsRef.current = 0;
      lastSentSpeechRef.current = lastSentSpeechRef.current || '';
      recognition.start();
    } catch (startErr) {
      console.error('Speech recognition start failed', startErr);
      setIsListening(false);
      isListeningRef.current = false;
      recognitionRef.current = null;
      if (startErr && (startErr as any).message && (startErr as any).message.includes('permission')) {
        alert('Microphone permission denied. Please enable microphone access in your browser settings.');
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const queryLower = text.trim().toLowerCase();
    const recentQuestion = text.trim();
    setRecentQuestions(previous => {
      const next = [recentQuestion, ...previous.filter(question => question.toLocaleLowerCase() !== recentQuestion.toLocaleLowerCase())].slice(0, 5);
      localStorage.setItem('nexa_recent_questions', JSON.stringify(next));
      return next;
    });

    // Play "send" notification sound
    playNotificationSound('send');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: text,
      timestamp: time
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    userJustAskedRef.current = true;

    // Always use the backend authoritative search pipeline. Frontend local matching has been disabled
    // to enforce a single source of truth and strict selection rules.
    try {
      const payload = { message: text, language };
      const resp = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const fallbackText = "I couldn't find this information in the Knowledge Base.";

      if (!resp.ok) {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-bot`,
          sender: 'bot',
          text: fallbackText,
          timestamp: botTime,
          suggestedQuestions: ['Raise Support Ticket']
        }]);
        playNotificationSound('receive');
        return;
      }

      const data = await resp.json();
      setIsTyping(false);

      const botResponse: Message = {
        id: `msg-${Date.now()}-bot`,
        sender: 'bot',
        text: data.text || fallbackText,
        timestamp: botTime,
        suggestedQuestions: data.suggestedQuestions || [],
        sourceUrl: data.sourceUrl || null,
        sourcePage: data.sourcePage || null,
        sourceCategory: data.sourceCategory || null,
        sources: data.sources || (data.sourceUrl ? [{ title: data.sourcePage || 'NECN Website', url: data.sourceUrl }] : [])
      };

      if (data.isNoVerifiedWarning || data.suggestOpenTicket) {
        // Update the fallback message to show both chips
        botResponse.text = "I couldn't find reliable information for your question in our current knowledge base. If you'd like, you can create a Support Ticket and a college administrator will review your request personally.";
        botResponse.suggestedQuestions = ['🎫 Open Support Ticket Form', 'View Main FAQs'];
        // Store the unanswered query for pre-filling the form
        setLastUnansweredQuery(text);
      }

      setMessages(prev => [...prev, botResponse]);
      playNotificationSound('receive');

      // Send a lightweight analytics log
      onAddLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        userQuery: text,
        matchedRuleId: data.matchedRuleId || null,
        matchedQuestion: data.matchedQuestion || null,
        score: data.confidence || 0,
        userRole: 'Unified Chatbot Guest',
        fallbackTriggered: data.isNoVerifiedWarning === true
      });

    } catch (err) {
      console.error('Chat request failed:', err);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-bot`,
        sender: 'bot',
        text: "I couldn't find this information in the Knowledge Base.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: ['Raise Support Ticket']
      }]);
      playNotificationSound('receive');
    }

    // Intercept Ticket tracking / status query or identifier
    const isTicketId = /^tkt-\d+/i.test(queryLower) || /^t-\d+/i.test(queryLower) || /^necn-\d+/i.test(queryLower);
    const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(queryLower);
    const isTrackIntent = queryLower.includes('track') || queryLower.includes('ticket status') || queryLower.includes('track my ticket') || queryLower.includes('ticket progress');

    if (trackingStep === 'awaiting_identifier' || isTicketId || (isTrackIntent && isEmailInput)) {
      const identifier = queryLower;
      setTimeout(async () => {
        try {
          const isQueryEmail = isEmailInput || identifier.includes('@');
          const url = `/api/tickets/track?${isQueryEmail ? 'email' : 'id'}=${encodeURIComponent(identifier)}`;
          const res = await apiFetch(url);
          
          if (!res.ok) {
            setIsTyping(false);
            setMessages(prev => [
              ...prev,
              {
                id: `msg-${Date.now()}-bot`,
                sender: 'bot',
                text: `I couldn't locate any support ticket for \"**${identifier}**\". \n\nPlease verify your **Ticket ID** (e.g., \`TKT-...\`) or **registered Email Address** and try again, or ask me something else!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
            playNotificationSound('receive');
            return;
          }

          const tickets = await res.json();
          setIsTyping(false);
          setTrackingStep('none');

          let textResult = ` **Found ${tickets.length} ticket${tickets.length > 1 ? 's' : ''} matching your query:**\n\n`;
          tickets.forEach((t: any) => {
            const dateStr = new Date(t.created_at).toLocaleString();
            textResult += `### Ticket #${t.ticket_id}\n- **Status**: ${t.status === 'Resolved' ? '🟢 Resolved' : '🟡 Active / Open'}\n- **Created At**: ${dateStr}\n- **Inquiry**: \"${t.query}\"\n`;
            if (t.status === 'Resolved') {
              textResult += `- **Resolution Response**: \"${t.resolution_notes || 'Your ticket has been completed by our desk.'}\"\n`;
              if (t.resolved_at) {
                textResult += `- **Resolved At**: ${new Date(t.resolved_at).toLocaleString()}\n`;
              }
            } else {
              textResult += `- **Counselor Status**: In queue. Our desk will contact you via email once processed.\n`;
            }
            textResult += `\n---\n\n`;
          });

          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}-bot`,
              sender: 'bot',
              text: textResult,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          playNotificationSound('receive');
        } catch (err) {
          setIsTyping(false);
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}-bot`,
              sender: 'bot',
              text: "An error occurred while tracking your support ticket. Please check your network and try again later.",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          playNotificationSound('receive');
        }
      }, 1000);
      return;
    }

    if (isTrackIntent) {
      setTimeout(() => {
        setIsTyping(false);
        setTrackingStep('awaiting_identifier');
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now()}-bot`,
            sender: 'bot',
            text: "I can help you track your support ticket! 🎟️\n\nPlease enter your **Ticket ID** (e.g. `TKT-123456-ABC`) or your **registered Email Address** below:",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        playNotificationSound('receive');
      }, 1000);
      return;
    }

    // Intercept student portal queries
    if (queryLower.includes('attendance') || queryLower.includes('student status') || queryLower.includes('marks')) {
      setTimeout(() => {
        setIsTyping(false);
        setActiveTab('student-portal');
        const botMsg: Message = {
          id: `msg-${Date.now()}-bot`,
          sender: 'bot',
          text: language === 'te' 
            ? "నేను **నారాయణ విద్యార్థి హాజరు ట్రాకర్‌ను** ప్రారంభించాను. మీ విద్యా స్థితి మరియు హాజరు శాతాన్ని పరిశీలించడానికి మీ హాల్ టికెట్ నంబర్‌ను (ఉదా. `26911A0501` నుండి `26911A0510`) టైప్ చేయండి!"
            : language === 'hi'
            ? "मैंने **नारायणा छात्र उपस्थिति ट्रैकर** शुरू कर दिया है। अपनी शैक्षणिक स्थिति और उपस्थिति प्रतिशत की जांच करने के लिए अपना हॉल टिकट नंबर (जैसे `26911A0501` से `26911A0510`) दर्ज करें!"
            : "I have launched the **Narayana Student Attendance Tracker**. Type your hall ticket number (e.g., `26911A0501` to `26911A0510`) to inspect your academic status and percentage!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
        playNotificationSound('receive');
      }, 1000);
      return;
    }

    setIsTyping(false);
  };

  // Copy text to clipboard and trigger animation feedback
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Track response upvote/downvotes with transient notification messages
  const handleRateResponse = (id: string, type: 'up' | 'down') => {
    setRatings(prev => ({ ...prev, [id]: type }));
    setRatingMessage(type === 'up' ? "👍 Thank you for your feedback!" : "👎 Feedback logged. We will refine our responses.");
    setTimeout(() => setRatingMessage(null), 3000);
  };

  // Fast-route slider actions and FAQ selections
  const handleQuickReply = (reply: string) => {
    const cleanReply = reply.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();
    if (cleanReply === 'My Attendance') {
      setActiveTab('student-portal');
      return;
    }
    handleSendMessage(reply);
  };

  const handleStudentPortalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchRegNo.trim()) return;

    setIsSearchingPortal(true);
    setStudentPortalResult(null);

    try {
      const idStr = searchRegNo.trim().toUpperCase();
      setHasSearchedPortal(true);

      if (idStr.length < 5) {
        setStudentPortalResult(null);
        setIsSearchingPortal(false);
        return;
      }

      let foundStudent = null;
      try {
        const res = await apiFetch('/api/admin/students');
        if (res.ok) {
          const dbStudents = await res.json();
          foundStudent = dbStudents.find((s: any) => 
            (s.reg_no || s.regNo || '').toUpperCase() === idStr
          );
        }
      } catch (err) {
        console.error("Failed to fetch students:", err);
      }

      if (foundStudent) {
        setStudentPortalResult({
          regNo: foundStudent.reg_no || foundStudent.regNo,
          name: foundStudent.name,
          branch: foundStudent.branch,
          attendance: Number(foundStudent.attendance || 0),
          cgpa: Number(foundStudent.cgpa || 0),
          mid1: Number(foundStudent.mid1 || 0),
          mid2: Number(foundStudent.mid2 || 0),
          isSafe: Number(foundStudent.attendance || 0) >= 75
        });
      } else {
        setStudentPortalResult(null);
      }
    } catch (err) {
      console.error("Failed to query student database:", err);
      setStudentPortalResult(null);
    } finally {
      setIsSearchingPortal(false);
    }
  };

  return (
    <React.Fragment>
    <div className={`fixed z-50 flex flex-col font-sans pointer-events-none transition-all duration-300 ${
      isMaximized 
        ? 'inset-0 w-full h-[100dvh] sm:inset-auto sm:bottom-6 sm:right-6 sm:w-auto sm:h-auto items-center justify-center sm:items-end' 
        : 'bottom-4 right-4 sm:bottom-6 sm:right-6 items-end'
    }`}>
      {/* 1. Main Chat Widget Frame */}
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none transition-all duration-300`}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id="necn-chatbot-widget-container"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={
                !isMaximized && customSize
                  ? { width: customSize.width, height: customSize.height, maxWidth: '100vw', maxHeight: '100vh' }
                  : {}
              }
              className={`pointer-events-auto relative ${isDark ? 'dark' : ''} ${
                isMaximized 
                  ? 'w-full h-full sm:rounded-3xl rounded-none border-0 sm:border' 
                  : customSize ? 'mb-2 rounded-3xl border' : 'w-[95vw] sm:w-[440px] h-[80vh] sm:h-[610px] mb-2 rounded-3xl border'
              } flex flex-col overflow-hidden transition-all duration-300 max-h-[90vh] shadow-2xl ${
                isDark 
                  ? 'bg-slate-950 border-slate-850 text-slate-100 shadow-indigo-950/20' 
                  : 'bg-white border-slate-200 text-slate-900 shadow-slate-350/30'
              }`}
            >
              {/* Eight unobtrusive handles make resizing natural from every edge
                  and corner. They are disabled on mobile by the design system. */}
              {([
                ['top-left', 'top-0 left-0 w-5 h-5 cursor-nwse-resize'],
                ['top-right', 'top-0 right-0 w-5 h-5 cursor-nesw-resize'],
                ['bottom-left', 'bottom-0 left-0 w-5 h-5 cursor-nesw-resize'],
                ['bottom-right', 'bottom-0 right-0 w-5 h-5 cursor-nwse-resize'],
                ['top', 'top-0 left-5 right-5 h-2 cursor-ns-resize'],
                ['bottom', 'bottom-0 left-5 right-5 h-2 cursor-ns-resize'],
                ['left', 'left-0 top-5 bottom-5 w-2 cursor-ew-resize'],
                ['right', 'right-0 top-5 bottom-5 w-2 cursor-ew-resize']
              ] as [ResizeDirection, string][]).map(([direction, position]) => (
                <div
                  key={direction}
                  aria-label={`Resize chatbot from ${direction}`}
                  role="button"
                  tabIndex={0}
                  className={`nexa-resize-handle ${position}`}
                  onMouseDown={beginResize(direction)}
                  onKeyDown={(event) => {
                    const horizontal = event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0;
                    const vertical = event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0;
                    if (!horizontal && !vertical) return;
                    event.preventDefault();
                    setCustomSize((size) => ({
                      width: Math.min(window.innerWidth - 32, Math.max(320, size.width + (direction.includes('left') ? -horizontal : direction.includes('right') ? horizontal : 0))),
                      height: Math.min(window.innerHeight - 32, Math.max(420, size.height + (direction.includes('top') ? -vertical : direction.includes('bottom') ? vertical : 0)))
                    }));
                  }}
                />
              ))}

            {/* Header with Branding matching Image 1 Reference */}
            <div className={`p-4 flex items-center justify-between border-b shrink-0 relative overflow-hidden min-h-0`}
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
              <div className="flex items-center gap-3 relative z-10 min-w-0">
                <div className="relative flex items-center shrink-0">
                  <RobotLogo className="w-10 h-10 shrink-0" animate={true} />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <h3 className="font-extrabold text-[15px] tracking-tight nexa-display leading-tight text-white flex flex-col">
                    <span>Narayana</span>
                    <span className="text-white flex items-center gap-1.5">
                      NEXA
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold font-sans ml-1 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {t('online')}
                      </span>
                    </span>
                  </h3>
                </div>
              </div>

              {/* Utility shortcuts matching Image 1 */}
              <div className="flex items-center gap-2 relative z-10 shrink-0">
                {/* Language Switcher Toggle Pill matching Image 1 */}
                <div className="flex bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/50 shrink-0">
                  {(['en', 'hi', 'te'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer min-w-[28px] ${
                        language === lang 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <button 
                  id="chatbot-theme-toggle"
                  onClick={() => toggleTheme()}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer shrink-0"
                  title="Toggle Dark Mode"
                >
                  {isDark ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 11-7.07 7.07l.707-.707" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                  )}
                </button>

                <span className="w-[1px] h-4 bg-slate-700/60 mx-0.5 shrink-0"></span>

                <button 
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shrink-0"
                  title={isMaximized ? "Minimize Chat" : "Maximize Chat"}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shrink-0"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs matching Image 1 Reference */}
            <div className={`px-3 py-2 border-b text-[12px] flex items-center justify-around font-medium shrink-0 select-none gap-1 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              {/* 1. Chat Tab - Blue */}
              <button
                onClick={() => {
                  setActiveTab('chat');
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'chat'
                    ? 'text-blue-600 dark:text-blue-400 font-extrabold border-b-2 border-blue-600 dark:border-blue-400 -mb-[9px] pb-2'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className={`w-4 h-4 ${activeTab === 'chat' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`} />
                <span>{t('chat')}</span>
              </button>

              {/* 2. Portals Tab - Indigo */}
              <button
                onClick={() => {
                  setActiveTab('student-portal');
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-portal'
                    ? 'text-indigo-600 dark:text-indigo-400 font-extrabold border-b-2 border-indigo-600 dark:border-indigo-400 -mb-[9px] pb-2'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className={`w-4 h-4 ${activeTab === 'student-portal' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                <span>{t('portal')}</span>
              </button>

              {/* 3. Tracker Tab - Emerald / Green */}
              <button
                onClick={() => {
                  setActiveTab('tracker');
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'tracker'
                    ? 'text-emerald-600 dark:text-emerald-400 font-extrabold border-b-2 border-emerald-600 dark:border-emerald-400 -mb-[9px] pb-2'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className={`w-4 h-4 ${activeTab === 'tracker' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
                <span>{t('tracker')}</span>
              </button>

              {/* 4. Notices Tab - Amber */}
              <button
                onClick={() => {
                  setActiveTab('notices');
                }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'notices'
                    ? 'text-amber-600 dark:text-amber-400 font-extrabold border-b-2 border-amber-600 dark:border-amber-400 -mb-[9px] pb-2'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bell className={`w-4 h-4 ${activeTab === 'notices' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
                <span>{t('notices')}</span>
              </button>
            </div>

            {/* Dynamic Rendering of Selected View */}
            {activeTab === 'chat' ? (
              /* ==================== SCREEN: Primary Professional Conversation Window ==================== */
              <>
                <div ref={containerRef} onScroll={() => handleScroll()} onPointerDown={startScrollDrag('y')} className={`chat-scroll-area flex-1 p-4 overflow-y-auto relative cursor-grab active:cursor-grabbing ${
                  isDark ? 'bg-slate-950' : 'bg-[#F5F7FB]'
                }`}>
                  <div className="relative z-10 space-y-4 min-h-full">
                    {/* Ticket Notification Banner */}
                    {trackerEmail && supportTickets.some(t => t.email.toLowerCase() === trackerEmail.toLowerCase() && t.status === 'Resolved' && !viewedTicketIds.includes(t.id)) && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex gap-3 items-start animate-fade-in shadow-sm">
                        <div className="p-1.5 bg-emerald-500 rounded-full shrink-0 text-white shadow-sm mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Support Ticket Resolved</h4>
                          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                            A college counselor has responded to your inquiry.
                          </p>
                          <button 
                            onClick={() => setActiveTab('tracker')}
                            className="mt-2 text-[10px] font-bold px-2.5 py-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors shadow-sm"
                          >
                            View Answer in Tracker
                          </button>
                        </div>
                      </div>
                    )}

                    {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col nexa-message-enter ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {msg.sender === 'user' ? (
                        <div className="max-w-[80%] px-4 py-2.5 text-sm relative group nexa-user-message">
                          <div className="leading-relaxed text-xs sm:text-sm font-medium">
                            {language !== 'en' && translatedMessages[`${msg.id}_${language}`] ? translatedMessages[`${msg.id}_${language}`] : msg.text}
                          </div>
                          <div className="flex items-center justify-end mt-1.5">
                            <span className="text-[9px] text-white/50 font-mono">{msg.timestamp}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-[88%] text-sm relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden text-slate-900 dark:text-slate-100">
                          <div className="px-4 pt-3.5 pb-2">
                            {/* 1. ANSWER FIRST */}
                            {msg.id === 'welcome' ? (
                              <TypingText text={language !== 'en' && translatedMessages[`${msg.id}_${language}`] ? translatedMessages[`${msg.id}_${language}`] : msg.text} speed={typingSpeed} isDark={isDark} />
                            ) : msg.plainText ? (
                              <div className="text-xs sm:text-sm leading-relaxed break-words whitespace-pre-line text-slate-900 dark:text-slate-100">
                                {language !== 'en' && translatedMessages[`${msg.id}_${language}`] ? translatedMessages[`${msg.id}_${language}`] : msg.text}
                              </div>
                            ) : (
                              <div className="text-xs sm:text-sm leading-relaxed break-words text-slate-900 dark:text-slate-100">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    a: ({node, ...props}) => (
                                      <a {...props} className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer" />
                                    ),
                                    strong: ({node, ...props}) => (
                                      <strong {...props} className="font-extrabold text-current" />
                                    ),
                                    p: ({node, ...props}) => (
                                      <p {...props} className="mb-2 last:mb-0" />
                                    ),
                                    ul: ({node, ...props}) => (
                                      <ul {...props} className="my-2 list-disc pl-5" />
                                    ),
                                    ol: ({node, ...props}) => (
                                      <ol {...props} className="my-2 list-decimal pl-5" />
                                    ),
                                    h1: ({node, ...props}) => (
                                      <h1 {...props} className="text-base font-bold text-current" />
                                    ),
                                    h2: ({node, ...props}) => (
                                      <h2 {...props} className="text-sm font-bold text-current" />
                                    ),
                                    h3: ({node, ...props}) => (
                                      <h3 {...props} className="text-xs font-bold text-current" />
                                    ),
                                    h4: ({node, ...props}) => (
                                      <h4 {...props} className="text-xs font-bold text-current" />
                                    ),
                                    code: ({node, ...props}) => (
                                      <code {...props} className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs" />
                                    ),
                                    blockquote: ({node, ...props}) => (
                                      <blockquote {...props} className="border-l-4 border-slate-300 dark:border-slate-600 pl-3 text-slate-700 dark:text-slate-300" />
                                    )
                                  }}
                                >
                                  {language !== 'en' && translatedMessages[`${msg.id}_${language}`] ? translatedMessages[`${msg.id}_${language}`] : msg.text}
                                </ReactMarkdown>
                              </div>
                            )}

                            {/* 2. COMPACT SOURCE AREA SECOND (BELOW ANSWER) */}
                            {(() => {
                              const rawSources = msg.sources && msg.sources.length > 0
                                ? msg.sources
                                : msg.sourceUrl
                                  ? [{ title: msg.sourcePage || 'NECN Website', url: msg.sourceUrl }]
                                  : [];
                              
                              if (!rawSources.length) return null;

                              // Deduplicate sources by URL and Title
                              const uniqueMap = new Map<string, { title: string; url: string }>();
                              for (const s of rawSources) {
                                if (s.url && !uniqueMap.has(s.url)) {
                                  uniqueMap.set(s.url, s);
                                }
                              }
                              const uniqueList = Array.from(uniqueMap.values());
                              if (!uniqueList.length) return null;

                              const primary = uniqueList[0];
                              const extra = uniqueList.slice(1);
                              const isExpanded = Boolean(expandedSources[msg.id]);

                              return (
                                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                                  {/* Primary Best Source Card */}
                                  <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-400 font-mono">
                                            Official NECN Source
                                          </div>
                                          <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                                            {primary.title || 'NECN Official Website'}
                                          </div>
                                        </div>
                                      </div>
                                      <a
                                        href={primary.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline shrink-0 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span>View official page</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  </div>

                                  {/* Collapsible Extra Sources Toggle if > 1 */}
                                  {extra.length > 0 && (
                                    <div className="mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors px-1 py-0.5"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <span>Hide additional sources</span>
                                            <ChevronUp className="w-3 h-3" />
                                          </>
                                        ) : (
                                          <>
                                            <span>View {extra.length} more {extra.length === 1 ? 'source' : 'sources'}</span>
                                            <ChevronDown className="w-3 h-3" />
                                          </>
                                        )}
                                      </button>

                                      {isExpanded && (
                                        <div className="mt-1.5 space-y-1 pl-1 animate-fade-in">
                                          {extra.map((src, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                              <span className="truncate text-slate-700 dark:text-slate-300 text-[11px] font-medium min-w-0 pr-2">
                                                {src.title || 'NECN Source'}
                                              </span>
                                              <a
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 shrink-0 inline-flex items-center gap-1"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <span>Open</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center justify-between px-4 pb-2.5 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/50">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{msg.timestamp}</span>
                            
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleSpeak(language !== 'en' && translatedMessages[`${msg.id}_${language}`] ? translatedMessages[`${msg.id}_${language}`] : msg.text, msg.id)}
                                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                                  speakingId === msg.id ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'text-slate-400 dark:text-slate-500'
                                }`}
                                title="Speak Answer"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${speakingId === msg.id ? 'animate-pulse' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleCopyText(msg.text, msg.id)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 dark:text-slate-500"
                                title="Copy Response"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handleRateResponse(msg.id, 'up')}
                                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                                  ratings[msg.id] === 'up' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
                                }`}
                                title="Helpful answer"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRateResponse(msg.id, 'down')}
                                className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                                  ratings[msg.id] === 'down' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                                }`}
                                title="Unhelpful answer"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Other Suggested Topics Chips */}
                      {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                        <div className="mt-3.5 flex flex-col gap-2 w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1 font-mono">{t('suggestedTopicsHeader')}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestedQuestions.map((q, idx) => {
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (q === 'View Main FAQs') {
                                      handleQuickReply('FAQ');
                                    } else if (q === '🎫 Open Support Ticket Form') {
                                      setActiveTab('ticketForm');
                                    } else {
                                      handleSendMessage(q);
                                    }
                                  }}
                                  className="nexa-suggestion-chip"
                                >
                                  {q}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex items-start">
                      <div className={`rounded-2xl px-3 py-2 border shadow-sm ${
                        isDark ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-100'
                      }`}>
                        <div className="flex space-x-1.5 items-center justify-center h-4">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visual feedback popup indicator */}
                  {ratingMessage && (
                    <div className="text-center p-2 bg-blue-500/10 border border-blue-500/15 rounded-xl text-[10px] text-blue-400 font-mono animate-fade-in">
                      {ratingMessage}
                    </div>
                  )}
                  </div>
                  <div ref={messagesEndRef} />
                </div>


                {/* Quick Action Bar matching Image 1 (Pills with blue outlines) */}
                <div onPointerDown={startScrollDrag('x')} className={`chat-scroll-area px-3 py-2.5 border-t flex gap-2 overflow-x-auto whitespace-nowrap cursor-grab active:cursor-grabbing ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  {getDynamicQuickReplies().map((reply) => {
                    const isTicket = reply === 'Raise Support Ticket';
                    return (
                      <button
                        key={reply}
                        onClick={() => handleQuickReply(reply)}
                        className={isTicket ? 'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 transition-all shrink-0 shadow-sm cursor-pointer' : 'px-3.5 py-1.5 rounded-full text-xs font-semibold border border-blue-500/40 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all shrink-0 shadow-sm cursor-pointer'}
                      >
                        {isTicket ? (
                          <>
                            <Ticket className="w-4 h-4 text-blue-600" />
                            {reply}
                          </>
                        ) : reply}
                      </button>
                    );
                  })}
                </div>

                {/* Autocomplete Instant Suggestion Dropdown */}
                {getAutocompleteSuggestions().length > 0 && (
                  <div onPointerDown={startScrollDrag('y')} className={`chat-scroll-area absolute bottom-full left-0 w-full z-[100] px-4 py-2 border-t text-xs space-y-2 max-h-40 overflow-y-auto shadow-xl cursor-grab active:cursor-grabbing ${
                    isDark ? 'bg-slate-950/95 border-slate-700' : 'bg-blue-50/95 border-blue-200'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-extrabold flex items-center gap-1 font-mono">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Instant Suggestions
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs">
                      {getAutocompleteSuggestions().map((sRule) => (
                        <button
                          type="button"
                          key={sRule.id}
                          onClick={() => handleSendMessage(sRule.question)}
                          className={`text-left w-full truncate py-1.5 px-2 rounded-md font-medium cursor-pointer text-xs flex items-center gap-2 border border-transparent transition-all ${isDark ? "hover:bg-slate-800 text-slate-200 hover:border-slate-700" : "hover:bg-blue-100 text-slate-900 hover:border-blue-200"}`}
                        >
                          <span className="text-blue-400">•</span> {sRule.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Area matching Image 1 Reference */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(inputText);
                  }}
                  className={`px-3 py-3 border-t relative z-10 flex gap-2 items-center ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleListen}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isListening 
                        ? 'bg-rose-500/20 text-rose-500 ring-2 ring-rose-500' 
                        : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                    }`}
                    title="Speak question"
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4 text-rose-500" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask Admissions, placement records, faculty..."
                      className={`w-full px-4 py-2.5 text-xs rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 font-medium'
                      }`}
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute bottom-full mb-2 w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                        {suggestions.map((suggestion) => (
                          <div 
                            key={suggestion.id}
                            className="p-3 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-800 dark:text-slate-200 font-medium"
                            onClick={() => {
                              setInputText(suggestion.question);
                              setShowSuggestions(false);
                              handleSendMessage(suggestion.question);
                            }}
                          >
                            {suggestion.question}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className={`w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : activeTab === 'ticketForm' ? (
              /* ==================== SCREEN: Support Ticket Form ==================== */
              <div className="flex flex-col h-full overflow-hidden">
                <TicketForm
                  isDark={isDark}
                  onCancel={() => setActiveTab('chat')}
                  onSubmitSuccess={(ticketId, fullName) => {
                    // Add confirmation message to chat
                    const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setMessages(prev => [...prev, {
                      id: `msg-${Date.now()}-bot`,
                      sender: 'bot',
                      text: `✅ Support Ticket Created Successfully\n\nTicket ID: **${ticketId}**\nName: ${fullName}\nStatus: Open\n\nYour request has been submitted to the support team.\nYou will receive updates through email.`,
                      timestamp: botTime,
                      suggestedQuestions: [],
                      plainText: true // Flag to prevent RichResponseRenderer from processing
                    }]);
                    setActiveTab('chat');
                    // Auto-scroll to latest message
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  originalQuery={lastUnansweredQuery}
                />
              </div>
            ) : activeTab === 'student-portal' ? (
              /* ==================== SCREEN: Student Academic Portal ==================== */
              <div onPointerDown={startScrollDrag('y')} className={`chat-scroll-area flex-1 p-5 overflow-y-auto space-y-4 flex flex-col cursor-grab active:cursor-grabbing ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Attendance Search Section */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-850">
                      <GraduationCap className="w-5 h-5 text-blue-500" />
                      <h4 className="font-extrabold text-sm">{t('portalTitle')}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {t('portalIntro')}
                    </p>

                    <form onSubmit={handleStudentPortalSearch} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={searchRegNo}
                        onChange={(e) => setSearchRegNo(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className={`flex-1 px-3 py-2 text-xs rounded-xl border font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-250 text-slate-900'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={isSearchingPortal}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        {isSearchingPortal ? (
                          <span className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                        ) : t('searchBtnText')}
                      </button>
                    </form>

                    {/* Result Box */}
                    {studentPortalResult && (
                      <div className={`p-4 rounded-2xl border space-y-3.5 shadow-sm animate-fade-in ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className={`font-extrabold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{studentPortalResult.name}</h5>
                            <span className={`text-[11px] font-mono font-bold block mt-0.5 ${isDark ? "text-slate-200" : "text-slate-900"}`}>{t('regNo')}: {studentPortalResult.regNo}</span>
                            <span className="text-[11px] text-blue-700 dark:text-blue-300 font-bold block">{studentPortalResult.branch}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            studentPortalResult.isSafe 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'
                          }`}>
                            {studentPortalResult.isSafe ? t('safeStatus') : t('riskStatus')}
                          </span>
                        </div>

                        {/* Graphical Attendance ring */}
                        <div className="flex items-center gap-4 bg-slate-500/5 p-3 rounded-xl border border-slate-500/5">
                          <div className="relative w-14 h-14 shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path
                                className={isDark ? "text-slate-800" : "text-slate-200"}
                                strokeWidth="3.5"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className={studentPortalResult.isSafe ? "text-emerald-500" : "text-rose-500"}
                                strokeDasharray={`${studentPortalResult.attendance}, 100`}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-[10px] font-extrabold font-mono ${isDark ? "text-white" : "text-slate-900"}`}>{studentPortalResult.attendance}%</span>
                            </div>
                          </div>
                          <div className="flex-1 space-y-1 min-w-0">
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 block font-semibold truncate">{t('academicMetrics')}</span>
                            <div className="grid grid-cols-2 gap-2 text-[14px]">
                              <div className="min-w-0">
                                <span className={`block font-bold truncate ${isDark ? "text-slate-200" : "text-slate-900"}`}>{t('gpaLabel')}</span>
                                <strong className={`text-lg truncate block ${isDark ? "text-white" : "text-slate-900"}`}>{studentPortalResult.cgpa} / 10</strong>
                              </div>
                              <div className="min-w-0">
                                <span className={`block font-bold truncate ${isDark ? "text-slate-200" : "text-slate-900"}`}>{t('internalExamsLabel')}</span>
                                <strong className={`text-lg truncate block ${isDark ? "text-white" : "text-slate-900"}`}>{(studentPortalResult.mid1 + studentPortalResult.mid2) / 2} / 25</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 leading-normal font-mono bg-slate-500/5 p-2 rounded-lg">
                          💡 {studentPortalResult.isSafe 
                            ? t('safeTip')
                            : t('riskTip')}
                        </div>
                      </div>
                    )}

                    {/* Not Found State */}
                    {hasSearchedPortal && !studentPortalResult && (
                      <div className={`p-6 rounded-2xl border text-center space-y-4 animate-fade-in ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex justify-center">
                          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <Search className="w-6 h-6 text-rose-500" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                            Data Not Available
                          </h5>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {t('noDataFound')}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('ticketForm')}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Ticket className="w-4 h-4" />
                          Open Support Ticket
                        </button>
                      </div>
                    )}
                  </div>

                   {/* Portal Links Section */}
                  {portalItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-850">
                        <ExternalLink className="w-5 h-5 text-indigo-500" />
                        <h4 className="font-extrabold text-sm">{t('portalLinksTitle')}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          {portalItems.map(item => {
                            let itemLink = item.link || item.url || '';
                            if (itemLink && !/^https?:\/\//i.test(itemLink) && !/^mailto:/i.test(itemLink) && !/^tel:/i.test(itemLink)) {
                              itemLink = 'https://' + itemLink;
                            }
                            return (
                              <a
                                key={item.id}
                                href={itemLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`p-3 rounded-xl border text-[11px] font-bold text-center transition-all hover:scale-105 shadow-sm ${
                                  isDark 
                                    ? 'bg-slate-900 border-slate-800 text-indigo-300 hover:border-indigo-700'
                                    : 'bg-white border-slate-200 text-indigo-700 hover:border-indigo-300'
                                }`}
                              >
                                {item.title}
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <div className="text-center text-[9px] text-slate-450 font-mono mt-4">
                    {t('dataSyncLabel')} {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>

            ) : activeTab === 'tracker' ? (
              /* ==================== SCREEN: Unified Ticket Tracker View ==================== */
              <div onPointerDown={startScrollDrag('y')} className={`chat-scroll-area flex-1 p-5 overflow-y-auto space-y-4 cursor-grab active:cursor-grabbing ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-850">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-bold text-sm">{t('trackTitle')}</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-normal">
                  {t('trackIntro')}
                </p>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={trackerEmail}
                      onChange={(e) => setTrackerEmail(e.target.value)}
                      placeholder={t('trackPlaceholder')}
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-250 text-slate-800'
                      }`}
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <h5 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 font-mono">
                    {t('ticketDetails')}
                  </h5>

                  {(() => {
                    const searchClean = trackerEmail.trim().toLowerCase();
                    if (!searchClean) {
                      return (
                        <div className="text-center py-10 text-slate-400 bg-slate-500/5 rounded-xl border border-dashed border-slate-250 dark:border-slate-850">
                          <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="text-xs">{t('trackIntro')}</p>
                        </div>
                      );
                    }

                    const matches = supportTickets.filter(t => 
                      (t.ticketId || '').toLowerCase().includes(searchClean) ||
                      (t.id || '').toLowerCase().includes(searchClean) || 
                      t.email.toLowerCase().includes(searchClean) ||
                      (t.studentName || '').toLowerCase().includes(searchClean)
                    );

                    if (matches.length === 0) {
                      return (
                        <div className="text-center py-10 text-slate-400 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                          <p className="text-xs font-semibold text-rose-500">{t('noTicketsFound')}</p>
                        </div>
                      );
                    }

                    return matches.map((ticket) => (
                      <div 
                        key={ticket.id} 
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          ticket.status === 'Resolved' 
                            ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10' 
                            : 'bg-amber-500/5 border-amber-500/20 dark:bg-amber-500/10 animate-pulse'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-blue-500 dark:text-blue-400">
                            {ticket.ticketId || ticket.id.substring(0, 8)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            ticket.status === 'Resolved' 
                              ? 'bg-emerald-100 text-emerald-850 dark:bg-emerald-500/20 dark:text-emerald-450' 
                              : 'bg-amber-100 text-amber-850 dark:bg-amber-500/20 dark:text-amber-455'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-mono">Your Inquiry:</span>
                            <p className="text-slate-700 dark:text-slate-300 font-medium">"{ticket.query}"</p>
                          </div>

                          {ticket.status === 'Resolved' ? (
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/15 mt-2 space-y-1">
                              <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Helpdesk Counselor Response:
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-xs">
                                {ticket.adminResponse || "No response has been recorded yet."}
                              </p>
                              {ticket.respondedAt && (
                                <span className="text-[9px] text-slate-400 block pt-1 font-mono">
                                  Resolved: {new Date(ticket.respondedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-100/50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 mt-2">
                              <span className="text-[10px] text-slate-400 font-mono block">Ticket Status:</span>
                              <p className="text-slate-500 dark:text-slate-400 italic text-[11px]">
                                Your ticket is active in our counseling queue. Our counselors are evaluating your query. You will be alerted via push notification immediately once resolved.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              /* ==================== SCREEN: College Notice Board ==================== */
              <div onPointerDown={startScrollDrag('y')} className={`chat-scroll-area flex-1 p-5 overflow-y-auto space-y-4 cursor-grab active:cursor-grabbing ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-850">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-500" />
                    <h4 className="font-bold text-sm">{t('noticesTitle')}</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('noticesIntro')}
                </p>

                <div className="space-y-4 pt-1">
                  {notices.filter((notice) => {
                    const hasImage = !!notice.imageUrl;
                    const hasText = !!(notice.title || notice.description || notice.attachment);
                    return hasImage || hasText;
                  }).length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="text-xs">{t('noNotices')}</p>
                    </div>
                  ) : (
                    notices.filter((notice) => {
                      const hasImage = !!notice.imageUrl;
                      const hasText = !!(notice.title || notice.description || notice.attachment);
                      return hasImage || hasText;
                    }).map((notice, idx) => {
                      const hasImage = !!notice.imageUrl;
                      const hasText = !!(notice.title || notice.description);
                      
                      return (
                        <div 
                          key={notice.id || idx}
                          className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 shadow-md transition-all duration-300 hover:shadow-lg ${
                            isDark ? 'border-slate-800' : 'border-slate-200'
                          }`}
                        >
                          {hasImage && (
                            <button
                              type="button"
                              onClick={() => setSelectedNoticeImage({ url: notice.imageUrl!, title: notice.title || 'Notice image' })}
                              className="w-full bg-slate-100 dark:bg-slate-950 relative group block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              title="Open full image"
                            >
                              <img 
                                src={notice.imageUrl} 
                                alt={notice.title || 'Notice Image'} 
                                className="block w-full h-auto max-h-[70vh] object-contain" 
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute right-3 bottom-3 bg-black/65 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                Click to view
                              </span>
                              {!hasText && notice.date && (
                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] font-bold font-mono">
                                  {notice.date}
                                </div>
                              )}
                            </button>
                          )}
                          {hasText && (
                            <div className="p-5 space-y-3 bg-white dark:bg-slate-900">
                              <div className="flex justify-between items-start gap-3">
                                {notice.title && (
                                  <h5 className="font-bold text-sm text-slate-950 dark:text-white flex-1 leading-snug">
                                    {notice.title}
                                  </h5>
                                )}
                                {notice.date && (
                                  <span className="text-[9px] font-mono font-extrabold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg whitespace-nowrap border border-slate-200 dark:border-slate-700 shadow-sm">
                                    {notice.date}
                                  </span>
                                )}
                              </div>
                              {notice.description && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-extrabold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatNoticeMarkdown(notice.description)}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      
      {/* 2. Floating Circular Launch Button with Airtel/Gitam Branding */}
      <motion.button
        id="chatbot-floating-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`w-16 h-16 rounded-full bg-slate-900 hover:bg-slate-850 text-white flex items-center justify-center shadow-2xl cursor-pointer pointer-events-auto mt-4 border border-slate-800 relative group transition-all duration-300 ${
          !isOpen ? 'animate-border-glow animate-floating' : ''
        }`}
        title="Narayana NEXA Assistant"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6 text-slate-300" />
            </motion.div>
          ) : (
            <motion.div
              key="chat-icon"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full flex items-center justify-center p-1"
            >
              <RobotLogo className="w-13 h-13" animate={true} />
              {/* Notification bubble */}
              <span className="absolute top-2.5 right-2.5 w-3.5 h-3.5 bg-rose-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Tooltip hint */}
        {!isOpen && (
          <div className="absolute right-20 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Narayana NEXA Counsel Desk
          </div>
        )}
      </motion.button>
    </div>

    <AnimatePresence>
      {selectedNoticeImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedNoticeImage(null)}
          className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-sm p-4 flex items-center justify-center cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label={`Full image: ${selectedNoticeImage.title}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(event) => event.stopPropagation()}
            className="relative max-w-[95vw] max-h-[92vh]"
          >
            <img
              src={selectedNoticeImage.url}
              alt={selectedNoticeImage.title}
              className="block max-w-[95vw] max-h-[88vh] object-contain rounded-xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => setSelectedNoticeImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 shadow-lg"
              aria-label="Close full image"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ==================== 3. FIRST-VISIT POPUP OVERLAY ==================== */}
    <AnimatePresence>
      {showFirstVisitPopup && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="max-w-md w-full bg-slate-900 border border-slate-800/80 text-white rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6 relative"
          >
            <button
              onClick={() => setShowFirstVisitPopup(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Logo box */}
            <div className="relative p-5 bg-slate-950/50 rounded-full border border-slate-800 shadow-inner">
              <RobotLogo className="w-24 h-24" animate={true} />
              <span className="absolute inset-0 rounded-full border border-blue-500/20 animate-ping pointer-events-none"></span>
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-500/20 font-mono">
                YOUR SMART ASSISTANT
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight text-white font-sans mt-2">
                Welcome to Narayana NEXA
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                The Official Digital Assistant of Narayana Engineering College.
              </p>
            </div>

            <div className="w-full flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  setShowFirstVisitPopup(false);
                  setIsOpen(true);
                  setActiveTab('chat');
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue to Nexa
              </button>
            </div>


          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </React.Fragment>
  );
}

import { formatMarkdown } from "../utils/markdown";
