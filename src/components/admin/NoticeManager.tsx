import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, RefreshCw, Megaphone, Link, Pin, Calendar, 
  ExternalLink, Globe, Sparkles, X, Check 
} from 'lucide-react';
import { NoticeItem, PortalItem } from '../../types';
import { 
  subscribeToCollection, 
  uploadNoticeImage, 
  bulkDeleteNotices, 
  deleteAllNotices, 
  bulkDeletePortalLinks, 
  deleteAllPortalLinks 
} from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface NoticeManagerProps {
  onStateChanged?: () => void;
}

export default function NoticeManager({ onStateChanged }: NoticeManagerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'notices' | 'portalLinks'>('notices');
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [portalLinks, setPortalLinks] = useState<PortalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notice Form states
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeDesc, setNewNoticeDesc] = useState('');
  const [newNoticeDate, setNewNoticeDate] = useState(new Date().toISOString().split('T')[0]);
  const [newNoticePinned, setNewNoticePinned] = useState(false);
  const [newNoticeType, setNewNoticeType] = useState<'General' | 'Academic' | 'Exam' | 'Placement'>('General');
  const [newNoticeImageFile, setNewNoticeImageFile] = useState<File | null>(null);
  const [newNoticeAttachment, setNewNoticeAttachment] = useState('');

  // Portal Link states
  const [showAddPortalModal, setShowAddPortalModal] = useState(false);
  const [editingPortal, setEditingPortal] = useState<PortalItem | null>(null);

  const [newPortalTitle, setNewPortalTitle] = useState('');
  const [newPortalUrl, setNewPortalUrl] = useState('');
  const [newPortalCategory, setNewPortalCategory] = useState('General');
  const [newPortalDescription, setNewPortalDescription] = useState('');

  // Selection and Bulk Delete States
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<Set<string>>(new Set());
  const [selectedPortalIds, setSelectedPortalIds] = useState<Set<string>>(new Set());
  const [showDeleteAllNoticeModal, setShowDeleteAllNoticeModal] = useState(false);
  const [showDeleteAllPortalModal, setShowDeleteAllPortalModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

  const isAllNoticesSelected = notices.length > 0 && selectedNoticeIds.size >= notices.length;
  const isAllPortalsSelected = portalLinks.length > 0 && selectedPortalIds.size >= portalLinks.length;

  const toggleSelectAllNotices = () => {
    if (isAllNoticesSelected) setSelectedNoticeIds(new Set());
    else setSelectedNoticeIds(new Set(notices.map(n => n.id)));
  };

  const toggleSelectNotice = (id: string) => {
    setSelectedNoticeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPortals = () => {
    if (isAllPortalsSelected) setSelectedPortalIds(new Set());
    else setSelectedPortalIds(new Set(portalLinks.map(p => p.id)));
  };

  const toggleSelectPortal = (id: string) => {
    setSelectedPortalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedNotices = async () => {
    if (selectedNoticeIds.size === 0) return;
    try {
      const count = await bulkDeleteNotices(Array.from(selectedNoticeIds));
      setSelectedNoticeIds(new Set());
      await loadAnnouncements();
      showToast(`Successfully deleted ${count} selected notice(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting notices: ${err.message}`, "error");
    }
  };

  const handleExportSelectedNotices = () => {
    const selected = notices.filter(n => selectedNoticeIds.has(n.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notices-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} notice(s).`, "success");
  };

  const handleConfirmDeleteAllNotices = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllNotices();
      setSelectedNoticeIds(new Set());
      await loadAnnouncements();
      showToast(`Successfully cleared all ${count} notices.`, "success");
      setShowDeleteAllNoticeModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to clear notices: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteSelectedPortals = async () => {
    if (selectedPortalIds.size === 0) return;
    try {
      const count = await bulkDeletePortalLinks(Array.from(selectedPortalIds));
      setSelectedPortalIds(new Set());
      await loadAnnouncements();
      showToast(`Successfully deleted ${count} selected portal link(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting portal links: ${err.message}`, "error");
    }
  };

  const handleExportSelectedPortals = () => {
    const selected = portalLinks.filter(p => selectedPortalIds.has(p.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portals-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} portal link(s).`, "success");
  };

  const handleConfirmDeleteAllPortals = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllPortalLinks();
      setSelectedPortalIds(new Set());
      await loadAnnouncements();
      showToast(`Successfully cleared all ${count} portal links.`, "success");
      setShowDeleteAllPortalModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to clear portal links: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const [noticesRes, portalRes] = await Promise.all([
        apiFetch('/api/admin/notices'),
        apiFetch('/api/admin/portal-links')
      ]);

      if (!noticesRes.ok || !portalRes.ok) {
        throw new Error("Failed to load campus notices and portals from API");
      }

      const noticesData = await noticesRes.json();
      const portalsData = await portalRes.json();

      setNotices(noticesData.map((n: any) => {
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

      setPortalLinks(portalsData.map((p: any) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        category: p.category || 'General',
        description: p.description || ''
      })));

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Unable to sync announcements and quick resources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Subscribe to notices
    const unsubNotices = subscribeToCollection<NoticeItem>('notices', (data) => {
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
      setLoading(false);
    });

    // Subscribe to portal links
    const unsubPortals = subscribeToCollection<PortalItem>('portalLinks', (data) => {
      setPortalLinks(data.map((p: any) => ({
        id: p.id,
        title: p.title,
        url: p.link || p.url || '',
        category: p.category || 'General',
        description: p.description || ''
      })));
      setLoading(false);
    });

    return () => {
      unsubNotices();
      unsubPortals();
    };
  }, []);

  // Notice CRUD
  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() && !newNoticeDesc.trim() && !newNoticeImageFile && !newNoticeAttachment.trim()) {
      showToast("Add a title, message, or image before posting the notice.", "error");
      return;
    }
    const generatedId = `notice-${Date.now()}`;

    let imageUrl = newNoticeAttachment.trim();
    if (newNoticeImageFile) {
      try {
        setLoading(true);
        imageUrl = await uploadNoticeImage(newNoticeImageFile);
      } catch (err: any) {
        showToast("Failed to upload image: " + err.message, "error");
        setLoading(false);
        return;
      }
    }

    const payload = {
      id: generatedId,
      title: newNoticeTitle.trim(),
      description: newNoticeDesc.trim(),
      date: newNoticeDate,
      pinned: newNoticePinned,
      type: newNoticeType,
      attachment: imageUrl,
      image_url: imageUrl
    };

    try {
      const res = await apiFetch('/api/admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to post notice");

      setShowAddNoticeModal(false);
      resetNoticeForm();
      
      await loadAnnouncements();
      showToast("Notice posted successfully to student notice board!", 'success');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;
    if (!newNoticeTitle.trim() && !newNoticeDesc.trim() && !newNoticeImageFile && !newNoticeAttachment.trim()) {
      showToast("Add a title, message, or image before saving the notice.", "error");
      return;
    }

    let imageUrl = newNoticeAttachment.trim();
    if (newNoticeImageFile) {
      try {
        setLoading(true);
        imageUrl = await uploadNoticeImage(newNoticeImageFile);
      } catch (err: any) {
        showToast("Failed to upload image: " + err.message, "error");
        setLoading(false);
        return;
      }
    }

    const payload = {
      title: newNoticeTitle.trim(),
      description: newNoticeDesc.trim(),
      date: newNoticeDate,
      pinned: newNoticePinned,
      type: newNoticeType,
      attachment: imageUrl,
      image_url: imageUrl
    };

    try {
      const res = await apiFetch(`/api/admin/notices/${editingNotice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update notice");

      setShowAddNoticeModal(false);
      resetNoticeForm();
      
      await loadAnnouncements();
      showToast("Notice updated successfully!", 'success');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetNoticeForm = () => {
    setEditingNotice(null);
    setNewNoticeTitle('');
    setNewNoticeDesc('');
    setNewNoticePinned(false);
    setNewNoticeType('General');
    setNewNoticeAttachment('');
    setNewNoticeImageFile(null);
  };

  const handleDeleteNotice = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Notice',
      message: 'Are you sure you want to permanently delete this notice? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete notice");
          await loadAnnouncements();
          showToast("Notice permanently deleted from notice board.", 'success');
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  // Portal Links CRUD
  const handleUpdatePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPortal || !newPortalTitle.trim() || !newPortalUrl.trim()) return;

    let normalizedUrl = newPortalUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl) && !/^mailto:/i.test(normalizedUrl) && !/^tel:/i.test(normalizedUrl) && !/^\//.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const payload = {
      title: newPortalTitle.trim(),
      url: normalizedUrl,
      category: newPortalCategory,
      description: newPortalDescription.trim()
    };

    try {
      const res = await apiFetch(`/api/admin/portal-links/${editingPortal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update portal link");

      setShowAddPortalModal(false);
      resetPortalForm();

      await loadAnnouncements();
      showToast("Portal quick resource link updated successfully!", 'success');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const resetPortalForm = () => {
    setEditingPortal(null);
    setNewPortalTitle('');
    setNewPortalUrl('');
    setNewPortalCategory('General');
    setNewPortalDescription('');
  };

  const handleAddPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortalTitle.trim() || !newPortalUrl.trim()) return;
    const generatedId = `portal-${Date.now()}`;

    let normalizedUrl = newPortalUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl) && !/^mailto:/i.test(normalizedUrl) && !/^tel:/i.test(normalizedUrl) && !/^\//.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const payload = {
      id: generatedId,
      title: newPortalTitle.trim(),
      url: normalizedUrl,
      category: newPortalCategory,
      description: newPortalDescription.trim()
    };

    try {
      const res = await apiFetch('/api/admin/portal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save portal link");

      setShowAddPortalModal(false);
      resetPortalForm();

      await loadAnnouncements();
      showToast("Portal quick resource link indexed successfully!", 'success');
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeletePortal = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Portal Link',
      message: 'Are you sure you want to permanently delete this portal resource link? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/portal-links/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete portal link");
          await loadAnnouncements();
          showToast("Portal quick resource deleted.", 'success');
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(err.message, 'error');
        }
      }
    });
  };

  if (loading && notices.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" style={{ animationDuration: '3s' }} />
        LOADING ANNOUNCEMENTS BOARD...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-850 dark:text-slate-100">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('notices')}
          className={`py-3 px-5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'notices' 
              ? 'border-b-blue-600 text-blue-600 font-extrabold' 
              : 'border-b-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Narayana Student Notice Board ({notices.length})
        </button>
        <button
          onClick={() => setActiveTab('portalLinks')}
          className={`py-3 px-5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'portalLinks' 
              ? 'border-b-blue-600 text-blue-600 font-extrabold' 
              : 'border-b-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Link className="w-4 h-4" />
          Campus Resource Portal Links ({portalLinks.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      {/* ==================== NOTICE BOARD PANEL ==================== */}
      {activeTab === 'notices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm">Bulletin Announcements</h4>
              <p className="text-[11px] text-slate-400">Broadcast exam schedules, holiday notices, placement drives, and notifications.</p>
            </div>
            <button
              onClick={() => setShowAddNoticeModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" /> Post Announcement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notices.map((notice) => (
              <div 
                key={notice.id} 
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 relative group hover:shadow-md transition-all ${
                  notice.pinned 
                    ? 'border-indigo-500/50 bg-indigo-500/[0.02]' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold tracking-wider font-sans uppercase border ${
                      notice.type === 'Exam'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/10'
                        : notice.type === 'Placement'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'
                        : notice.type === 'Academic'
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/10'
                        : 'bg-slate-500/10 text-slate-500 border-slate-500/10'
                    }`}>
                      {notice.type} Bulletin
                    </span>
                    <h5 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                      {notice.title}
                    </h5>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {notice.pinned && (
                      <span className="p-1.5 bg-indigo-500/15 text-indigo-500 rounded-lg" title="Pinned Notice">
                        <Pin className="w-3.5 h-3.5 fill-indigo-500" />
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditingNotice(notice);
                        setNewNoticeTitle(notice.title);
                        setNewNoticeDesc(notice.description);
                        setNewNoticeDate(notice.date);
                        setNewNoticePinned(notice.pinned);
                        setNewNoticeType(notice.type as any);
                        setNewNoticeAttachment(notice.attachment || '');
                        setNewNoticeImageFile(null);
                        setShowAddNoticeModal(true);
                      }}
                      className="p-2 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-full cursor-pointer transition-all border border-blue-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-full cursor-pointer transition-all border border-rose-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-350 leading-relaxed font-medium">
                  {notice.description}
                </p>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {notice.date}
                  </div>
                  {notice.attachment && (
                    <a 
                      href={notice.attachment} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-1 text-blue-500 hover:underline font-bold"
                    >
                      View Document <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {notices.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-400">
                Notice Board is empty. Post new announcements for students.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'portalLinks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm">Portal Quick Resources</h4>
              <p className="text-[11px] text-slate-400">Add easy hyperlinked pathways like Fees payment, results desk, and feedback boxes.</p>
            </div>
            <button
              onClick={() => setShowAddPortalModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" /> Link Resource
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {portalLinks.map((link) => (
              <div 
                key={link.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all space-y-3 relative group"
              >
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold tracking-wider font-sans uppercase">
                    {link.category}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingPortal(link);
                        setNewPortalTitle(link.title);
                        setNewPortalUrl(link.url || link.link || '');
                        setNewPortalCategory(link.category || 'General');
                        setNewPortalDescription(link.description || '');
                        setShowAddPortalModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-blue-500/10"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePortal(link.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-rose-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h5 className="font-extrabold text-sm text-slate-850 dark:text-white flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-slate-400" />
                    {link.title}
                  </h5>
                  <p className="text-xs text-slate-400 font-medium">{link.description || 'Quick redirect resources link.'}</p>
                </div>

                <a 
                  href={link.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-blue-500 hover:underline select-all shrink-0"
                >
                  {link.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
            {portalLinks.length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-400">
                No portal links indexed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================== MODAL: ADD BULLET BOARD ==================================== */}
      {showAddNoticeModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Post Notice Board Announcement</h3>
              </div>
              <button
                onClick={() => setShowAddNoticeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingNotice ? handleUpdateNotice : handleAddNotice} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notice Board Title (Optional)</label>
                <input
                  type="text"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  placeholder="e.g. Mid-Term II Semester Exams Timetable"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Announcement Body (Optional — supports paragraphs, **bold**, and lists)</label>
                <textarea
                  rows={4}
                  value={newNoticeDesc}
                  onChange={(e) => setNewNoticeDesc(e.target.value)}
                  placeholder={'Write the notice in paragraphs. Use **bold** for important dates or headings.\n\n**Holiday Period:** 23 July 2026 to 27 July 2026'}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notice Type</label>
                  <select
                    value={newNoticeType}
                    onChange={(e) => setNewNoticeType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Placement">Placement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Publish Date</label>
                  <input
                    type="date"
                    value={newNoticeDate}
                    onChange={(e) => setNewNoticeDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Image Attachment (Optional, posters display in full 9:16)</label>
                {newNoticeAttachment && !newNoticeImageFile && (
                  <div className="mb-2">
                    <img src={newNoticeAttachment} alt="Current Attachment" className="h-20 object-contain rounded-md bg-slate-100 dark:bg-slate-800" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewNoticeImageFile(file);
                      // Clear the existing attachment URL so we know we're using a new file
                      setNewNoticeAttachment('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 select-none cursor-pointer">
                <input
                  type="checkbox"
                  id="pin"
                  checked={newNoticePinned}
                  onChange={(e) => setNewNoticePinned(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer w-4 h-4"
                />
                <label htmlFor="pin" className="text-xs text-slate-500 dark:text-slate-300 cursor-pointer font-bold">
                  Pin this announcement to top of feed
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetNoticeForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-855 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : editingNotice ? 'Update Announcement' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: ADD PORTAL RESOURCE ==================================== */}
      {showAddPortalModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Index Portal Quick Resource Link</h3>
              </div>
              <button
                onClick={() => setShowAddPortalModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingPortal ? handleUpdatePortal : handleAddPortal} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Resource Title (Required)</label>
                <input
                  type="text"
                  required
                  value={newPortalTitle}
                  onChange={(e) => setNewPortalTitle(e.target.value)}
                  placeholder="e.g. Central Library OPAC search catalog"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Web Link URL (Required)</label>
                <input
                  type="text"
                  required
                  value={newPortalUrl}
                  onChange={(e) => setNewPortalUrl(e.target.value)}
                  placeholder="e.g. https://ecap.narayanagroup.com"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Classification</label>
                <select
                  value={newPortalCategory}
                  onChange={(e) => setNewPortalCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-855 dark:text-slate-100 focus:outline-none"
                >
                  <option value="General">General</option>
                  <option value="Student">Student Portal</option>
                  <option value="Placement">Placements</option>
                  <option value="Examinations">Examinations</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Short Description</label>
                <input
                  type="text"
                  value={newPortalDescription}
                  onChange={(e) => setNewPortalDescription(e.target.value)}
                  placeholder="e.g. Search text-books, thesis, and journal databases online."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPortalModal(false);
                    resetPortalForm();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-855 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {editingPortal ? 'Update Portal Link' : 'Post Portal Link'}
                </button>
              </div>
            </form>
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

      {activeTab === 'notices' ? (
        <>
          <BulkActionBar
            selectedCount={selectedNoticeIds.size}
            onDeleteSelected={handleDeleteSelectedNotices}
            onExportSelected={handleExportSelectedNotices}
            onCancelSelection={() => setSelectedNoticeIds(new Set())}
            label="notices"
          />
          <DeleteAllModal
            isOpen={showDeleteAllNoticeModal}
            onClose={() => setShowDeleteAllNoticeModal(false)}
            onConfirm={handleConfirmDeleteAllNotices}
            moduleName="Notices"
            recordCount={notices.length}
            isDeleting={isDeletingAll}
          />
        </>
      ) : (
        <>
          <BulkActionBar
            selectedCount={selectedPortalIds.size}
            onDeleteSelected={handleDeleteSelectedPortals}
            onExportSelected={handleExportSelectedPortals}
            onCancelSelection={() => setSelectedPortalIds(new Set())}
            label="portal links"
          />
          <DeleteAllModal
            isOpen={showDeleteAllPortalModal}
            onClose={() => setShowDeleteAllPortalModal(false)}
            onConfirm={handleConfirmDeleteAllPortals}
            moduleName="Portal Links"
            recordCount={portalLinks.length}
            isDeleting={isDeletingAll}
          />
        </>
      )}
    </div>
  );
}
