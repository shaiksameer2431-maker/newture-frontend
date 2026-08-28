/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PortalItem {
  id: string;
  title: string;
  link?: string;
  url?: string;
  category?: string;
  description?: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  date: string;
  description?: string;
  type?: string;
  imageUrl?: string;
  pinned?: boolean;
  attachment?: string;
}

export interface Rule {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords?: string;
  synonyms?: string;
  relatedDepartment?: string;
  priority?: number;
  status: 'Active' | 'Inactive' | 'Archived';
  relatedQuestions?: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Department {
  id: string;
  name: string;
  contactNumber?: string;
  email?: string;
  location?: string;
  code?: string;
  hod?: string;
}

export interface Faculty {
  id: string;
  name: string;
  designation?: string;
  role?: string;
  department: string;
  email: string;
  contact?: string;
}

export interface ChatLog {
  id: string;
  timestamp: string;
  userQuery: string;
  matchedRuleId: string | null;
  matchedQuestion: string | null;
  score: number;
  userRole: string;
  fallbackTriggered: boolean;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  suggestedQuestions?: string[];
  departmentContact?: {
    name: string;
    phone: string;
    email: string;
  };
  score?: number;
  translations?: Record<string, string>;
  plainText?: boolean; // Flag to prevent RichResponseRenderer processing
  sourceUrl?: string | null;
  sourcePage?: string | null;
  sourceCategory?: string | null;
  sources?: Array<{ title: string; url: string }>;
}

export interface SupportTicket {
  id: string;
  ticketId?: string;
  timestamp: string;
  studentName?: string;
  email: string;
  subject?: string;
  countryCode?: string;
  phone: string;
  role: string;
  query: string;
  category?: string;
  priority?: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Resolved';
  adminResponse?: string;
  respondedAt?: string;
  notificationChannels?: { email: boolean; whatsapp: boolean; sms?: boolean };
  userNotified?: boolean;
  // Metadata for better support context
  chatSessionId?: string;
  conversationId?: string;
  language?: string;
  userId?: string;
  currentPage?: string;
  websiteSection?: string;
}

export interface Feedback {
  id: string;
  userId?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Student {
  regNo: string;
  name: string;
  branch: string;
  attendance: number;
  cgpa: number;
  mid1: number;
  mid2: number;
  createdAt?: string;
}

export interface WebsiteKnowledgeSettings {
  id: string;
  domain: string;
}

