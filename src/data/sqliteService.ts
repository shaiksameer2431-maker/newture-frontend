import { Rule, Department, Faculty, Category, SupportTicket, NoticeItem, PortalItem, ChatLog, Feedback, UserProfile, Student } from '../types';
import { apiFetch } from '../lib/api';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface ServiceErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
}

function handleServiceError(error: unknown, operationType: OperationType, table: string | null) {
  let errMsg = '';
  if (error instanceof Error) {
    errMsg = error.message;
  } else if (error && typeof error === 'object') {
    errMsg = (error as any).message || (error as any).error || JSON.stringify(error);
  } else {
    errMsg = String(error);
  }
  const errInfo: ServiceErrorInfo = {
    error: errMsg,
    operationType,
    table
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const TABLES = {
  RULES: 'rules',
  DEPARTMENTS: 'departments',
  CATEGORIES: 'categories',
  FACULTY: 'faculty',
  SUPPORT_TICKETS: 'support_tickets',
  NOTICES: 'notices',
  PORTAL_LINKS: 'portal_links',
  CHAT_LOGS: 'chat_logs',
  WEBSITE_KNOWLEDGE_SETTINGS: 'website_knowledge_settings',
  FEEDBACK: 'feedback',
  USER_PROFILES: 'user_profiles',
  STUDENTS: 'students'
};

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const HEALTH_CHECK_TIMEOUT_MS = isLocalhost ? 4_000 : 60_000;

async function fetchWithTimeout(input: string, timeoutMs = HEALTH_CHECK_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await apiFetch(input, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkConnection(onProgress?: (message: string) => void): Promise<boolean> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && onProgress) {
      onProgress(`Connecting to local backend (attempt ${attempt}/${maxAttempts})...`);
    }
    try {
      const res = await fetchWithTimeout('/api/health');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.status === 'ok' || data.status === 'degraded' || data.status === 'online' || data.database)) {
          return true;
        }
      }
    } catch (error) {
      console.warn(`Connection check attempt ${attempt}/${maxAttempts} failed or timed out:`, error);
      // Try direct IPv4 fallback
      try {
        const altRes = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(3000) });
        if (altRes.ok) {
          const altData = await altRes.json().catch(() => null);
          if (altData && (altData.status === 'ok' || altData.status === 'degraded' || altData.status === 'online')) {
            return true;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

export async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  const endpointMap: Record<string, string> = {
    rules: '/api/admin/rules',
    // Use canonical endpoints (single source of truth) for frontend reads
    departments: '/api/canonical/departments',
    // categories collection deprecated — keep the endpoint mapping but it's expected to return 410
    categories: '/api/admin/categories',
    faculty: '/api/canonical/faculty',
    supportTickets: '/api/admin/tickets',
    notices: '/api/admin/notices',
    portalLinks: '/api/admin/portal-links',
    students: '/api/admin/students',
    chatLogs: '/api/admin/chat-logs',
    feedback: '/api/admin/feedback',
    userProfiles: '/api/admin/user-profiles',
  };

  const endpoint = endpointMap[collectionName];
  if (!endpoint) return [];

  try {
    const res = await apiFetch(endpoint);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data)) {
        return data.map((item: any) => mapFromSnakeCase(item) as T);
      }
    }
  } catch (fetchErr: any) {
    console.warn(`[FETCH] Failed to fetch ${endpoint}:`, fetchErr?.message || fetchErr);
  }
  return [];
}

export function subscribeToCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  fetchCollection<T>(collectionName).then(callback);
  const intervalId = setInterval(() => {
    fetchCollection<T>(collectionName).then(callback);
  }, 4000);

  return () => {
    clearInterval(intervalId);
  };
}

export async function saveSupportTicket(ticket: SupportTicket) {
  try {
    if (!ticket.ticketId) {
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const random = Math.floor(1000 + Math.random() * 9000);
      ticket.ticketId = `NECN-${date}-${random}`;
    }

    const snakeTicket = mapToSnakeCase(ticket);
    if (ticket.ticketId && !snakeTicket.id) {
      snakeTicket.id = ticket.ticketId;
    }
    delete (snakeTicket as any).ticket_id;

    const res = await apiFetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeTicket)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save ticket via backend');
    }
  } catch (error) {
    handleServiceError(error, OperationType.CREATE, TABLES.SUPPORT_TICKETS);
  }
}

export async function updateSupportTicket(ticketId: string, updates: Partial<SupportTicket>) {
  try {
    const res = await apiFetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapToSnakeCase(updates))
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update ticket');
    }
  } catch (error) {
    handleServiceError(error, OperationType.UPDATE, TABLES.SUPPORT_TICKETS);
  }
}

async function apiWrite(method: string, endpoint: string, body?: any) {
  const res = await apiFetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(mapToSnakeCase(body)) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
}

export async function saveRule(rule: Rule) {
  try {
    if (rule.id) {
      await apiWrite('PUT', `/api/admin/rules/${encodeURIComponent(rule.id)}`, rule);
    } else {
      await apiWrite('POST', '/api/admin/rules', rule);
    }
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.RULES);
  }
}

export async function deleteRule(ruleId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/rules/${encodeURIComponent(ruleId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.RULES);
  }
}

export async function saveNotice(notice: NoticeItem) {
  try {
    await apiWrite('POST', '/api/admin/notices', notice);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.NOTICES);
  }
}

export async function uploadNoticeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function deleteNotice(noticeId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/notices/${encodeURIComponent(noticeId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.NOTICES);
  }
}

export async function savePortalLink(link: PortalItem) {
  try {
    await apiWrite('POST', '/api/admin/portal-links', link);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.PORTAL_LINKS);
  }
}

export async function deletePortalLink(linkId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/portal-links/${encodeURIComponent(linkId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.PORTAL_LINKS);
  }
}

export async function saveDepartment(dept: Department) {
  try {
    await apiWrite('POST', '/api/admin/departments', dept);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.DEPARTMENTS);
  }
}

export async function deleteDepartment(deptId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/departments/${encodeURIComponent(deptId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.DEPARTMENTS);
  }
}

export async function saveFaculty(member: Faculty) {
  try {
    await apiWrite('POST', '/api/admin/faculty', member);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.FACULTY);
  }
}

export async function deleteFaculty(facultyId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/faculty/${encodeURIComponent(facultyId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.FACULTY);
  }
}

export async function saveCategory(cat: Category) {
  try {
    await apiWrite('POST', '/api/admin/categories', cat);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.CATEGORIES);
  }
}

export async function deleteCategory(catId: string) {
  try {
    await apiWrite('DELETE', `/api/admin/categories/${encodeURIComponent(catId)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.CATEGORIES);
  }
}

export async function saveChatLog(log: ChatLog) {
  try {
    try {
      const existingStr = localStorage.getItem('college_chat_logs');
      const existing: ChatLog[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [log, ...existing].slice(0, 200);
      localStorage.setItem('college_chat_logs', JSON.stringify(updated));
    } catch {
      /* ignore */
    }

    await apiWrite('POST', '/api/admin/chat-logs', log);
  } catch (error) {
    console.warn('[CHAT LOGGING] Failed to persist chat log to backend:', error);
  }
}

export async function clearChatLogs() {
  try {
    await apiFetch('/api/admin/chat-logs', { method: 'DELETE' });
  } catch (err) {
    console.warn('[CHAT LOGGING] Failed to clear chat logs from server:', err);
  }
  return Promise.resolve();
}

export async function seedDatabase(
  rules: Rule[],
  departments: Department[],
  categories: Category[],
  faculty: Faculty[]
) {
  console.log('Seeding SQLite database...');
  try {
    const response = await apiFetch('/api/admin/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: rules.map(mapToSnakeCase),
        departments: departments.map(mapToSnakeCase),
        categories: categories.map(mapToSnakeCase),
        faculty: faculty.map(mapToSnakeCase)
      })
    });

    if (response.ok) {
      console.log('Seeding complete via backend API');
      return;
    }
    console.warn('Backend seeding API returned non-OK status.');
  } catch (apiErr) {
    console.error('Backend seeding API call failed.', apiErr);
  }
}

export interface WebsiteKnowledgeSettings {
  id: string;
  domain: string;
  crawlUrl: string;
  crawlLimit: number;
  scheduledIntervalHours: number;
  isScheduledSync: boolean;
}

export async function fetchWebsiteKnowledgeSettings(): Promise<WebsiteKnowledgeSettings | null> {
  try {
    const res = await apiFetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      return data ? mapFromSnakeCase(data) as WebsiteKnowledgeSettings : null;
    }
  } catch (apiError) {
    console.warn('API settings fetch failed:', apiError);
  }
  return null;
}

export async function saveWebsiteKnowledgeSettings(settings: WebsiteKnowledgeSettings) {
  try {
    const res = await apiFetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapToSnakeCase(settings))
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save settings');
    }
  } catch (error) {
    console.warn('Could not save settings:', error);
    throw error;
  }
}

export async function fetchUserProfiles(): Promise<UserProfile[]> {
  return fetchCollection<UserProfile>('userProfiles');
}

export async function saveUserProfile(profile: UserProfile) {
  try {
    await apiWrite('POST', '/api/admin/user-profiles', profile);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.USER_PROFILES);
  }
}

export async function toggleAdminStatus(userId: string, isAdmin: boolean) {
  try {
    await apiWrite('PUT', `/api/admin/user-profiles/${encodeURIComponent(userId)}`, { isAdmin });
  } catch (error) {
    handleServiceError(error, OperationType.UPDATE, TABLES.USER_PROFILES);
  }
}

export async function fetchFeedback(): Promise<Feedback[]> {
  return fetchCollection<Feedback>('feedback');
}

export async function saveFeedback(feedback: Feedback) {
  try {
    await apiWrite('POST', '/api/admin/feedback', feedback);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.FEEDBACK);
  }
}

export async function saveStudent(student: Student) {
  try {
    await apiWrite('POST', '/api/admin/students', student);
  } catch (error) {
    handleServiceError(error, OperationType.WRITE, TABLES.STUDENTS);
  }
}

export async function deleteStudent(regNo: string) {
  try {
    await apiWrite('DELETE', `/api/admin/students/${encodeURIComponent(regNo)}`);
  } catch (error) {
    handleServiceError(error, OperationType.DELETE, TABLES.STUDENTS);
  }
}

export async function bulkDeleteRecords(table: string, ids: string[]): Promise<number> {
  try {
    const res = await apiFetch('/api/admin/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ids, deleteAll: false })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Bulk delete failed' }));
      throw new Error(err.error || 'Bulk delete failed');
    }
    const data = await res.json();
    return data.deletedCount || 0;
  } catch (error) {
    console.error(`Bulk delete failed for ${table}:`, error);
    throw error;
  }
}

export async function deleteAllRecords(table: string): Promise<number> {
  try {
    const res = await apiFetch('/api/admin/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, deleteAll: true })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete all failed' }));
      throw new Error(err.error || 'Delete all failed');
    }
    const data = await res.json();
    return data.deletedCount || 0;
  } catch (error) {
    console.error(`Delete all failed for ${table}:`, error);
    throw error;
  }
}

export const bulkDeleteRules = (ids: string[]) => bulkDeleteRecords('rules', ids);
export const deleteAllRules = () => deleteAllRecords('rules');

export const bulkDeleteFaculty = (ids: string[]) => bulkDeleteRecords('faculty', ids);
export const deleteAllFaculty = () => deleteAllRecords('faculty');

export const bulkDeleteDepartments = (ids: string[]) => bulkDeleteRecords('departments', ids);
export const deleteAllDepartments = () => deleteAllRecords('departments');

export const bulkDeleteCategories = (ids: string[]) => bulkDeleteRecords('categories', ids);
export const deleteAllCategories = () => deleteAllRecords('categories');

export const bulkDeleteNotices = (ids: string[]) => bulkDeleteRecords('notices', ids);
export const deleteAllNotices = () => deleteAllRecords('notices');

export const bulkDeleteTickets = (ids: string[]) => bulkDeleteRecords('support_tickets', ids);
export const deleteAllTickets = () => deleteAllRecords('support_tickets');

export const bulkDeleteStudents = (regNos: string[]) => bulkDeleteRecords('students', regNos);
export const deleteAllStudents = () => deleteAllRecords('students');

export const bulkDeletePortalLinks = (ids: string[]) => bulkDeleteRecords('portal_links', ids);
export const deleteAllPortalLinks = () => deleteAllRecords('portal_links');

export const bulkDeleteNotifications = (ids: string[]) => bulkDeleteRecords('notifications', ids);
export const deleteAllNotifications = () => deleteAllRecords('notifications');

export const bulkDeleteChatLogs = (ids: string[]) => bulkDeleteRecords('chat_logs', ids);
export const deleteAllChatLogs = () => deleteAllRecords('chat_logs');

function mapToSnakeCase(obj: any): any {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
}

function mapFromSnakeCase(obj: any): any {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    if (key === 'id') {
      newObj[key] = obj[key];
      continue;
    }
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    newObj[camelKey] = obj[key];
  }
  return newObj;
}
