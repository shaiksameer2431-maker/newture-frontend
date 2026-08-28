import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, RefreshCw, FolderClosed, 
  Users, Layers, GraduationCap, Building2, CheckCircle2, FileDown,
  Copy, Check, Eye
} from 'lucide-react';
import { Department, Faculty } from '../../types';
import { 
  bulkDeleteFaculty, 
  deleteAllFaculty, 
  bulkDeleteDepartments, 
  deleteAllDepartments,
  bulkDeleteCategories,
  deleteAllCategories
} from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface DatabaseManagerProps {
  onStateChanged?: () => void;
}

export default function DatabaseManager({ onStateChanged }: DatabaseManagerProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'departments' | 'faculty' | 'rules'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback DB download/inspection states
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Form states
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [newDeptId, setNewDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptHod, setNewDeptHod] = useState('');

  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultyRole, setNewFacultyRole] = useState('');
  const [newFacultyDept, setNewFacultyDept] = useState('');
  const [newFacultyEmail, setNewFacultyEmail] = useState('');


  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<Set<string>>(new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  const [showDeleteAllDeptModal, setShowDeleteAllDeptModal] = useState(false);
  const [showDeleteAllFacultyModal, setShowDeleteAllFacultyModal] = useState(false);
  const [showDeleteAllCategoryModal, setShowDeleteAllCategoryModal] = useState(false);
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

  const toggleSelectAllDepts = () => {
    if (selectedDeptIds.size >= departments.length) setSelectedDeptIds(new Set());
    else setSelectedDeptIds(new Set(departments.map(d => d.id)));
  };

  const toggleSelectDept = (id: string) => {
    setSelectedDeptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFaculty = () => {
    if (selectedFacultyIds.size >= faculty.length) setSelectedFacultyIds(new Set());
    else setSelectedFacultyIds(new Set(faculty.map(f => f.id)));
  };

  const toggleSelectFaculty = (id: string) => {
    setSelectedFacultyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedDepts = async () => {
    if (selectedDeptIds.size === 0) return;
    try {
      const count = await bulkDeleteDepartments(Array.from(selectedDeptIds));
      setSelectedDeptIds(new Set());
      await loadDatabase();
      showToast(`Successfully deleted ${count} department(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting departments: ${err.message}`, "error");
    }
  };

  const handleDeleteSelectedFaculty = async () => {
    if (selectedFacultyIds.size === 0) return;
    try {
      const count = await bulkDeleteFaculty(Array.from(selectedFacultyIds));
      setSelectedFacultyIds(new Set());
      await loadDatabase();
      showToast(`Successfully deleted ${count} faculty member(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting faculty: ${err.message}`, "error");
    }
  };

  const handleExportSelectedDepts = () => {
    const selected = departments.filter(d => selectedDeptIds.has(d.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `departments-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} department(s).`, "success");
  };

  const handleExportSelectedFaculty = () => {
    const selected = faculty.filter(f => selectedFacultyIds.has(f.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faculty-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} faculty record(s).`, "success");
  };

  const handleConfirmDeleteAllDepts = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllDepartments();
      setSelectedDeptIds(new Set());
      await loadDatabase();
      showToast(`Successfully cleared all ${count} academic departments.`, "success");
      setShowDeleteAllDeptModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to clear departments: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleConfirmDeleteAllFaculty = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllFaculty();
      setSelectedFacultyIds(new Set());
      await loadDatabase();
      showToast(`Successfully cleared all ${count} faculty records.`, "success");
      setShowDeleteAllFacultyModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to clear faculty registry: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Fetch all collections
  const loadDatabase = async () => {
    try {
      setLoading(true);
      const [deptRes, facultyRes, rulesRes] = await Promise.all([
        apiFetch('/api/admin/departments'),
        apiFetch('/api/admin/faculty'),
        apiFetch('/api/admin/rules')
      ]);

      if (!deptRes.ok || !facultyRes.ok || !rulesRes.ok) {
        throw new Error("Failed to load directories databases from API");
      }

      const deptsData = await deptRes.json();
      const facultyData = await facultyRes.json();
      const rulesData = await rulesRes.json();

      setDepartments(deptsData.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.contact_number || d.contactNumber || d.code || '',
        hod: d.location || d.hod || ''
      })));

      setFaculty(facultyData.map((f: any) => ({
        id: f.id,
        name: f.name,
        role: f.designation || f.role || '',
        department: f.department || '',
        email: f.email || ''
      })));

      setRules(rulesData);

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Unable to query directory data schemas from backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Department CRUD
  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    const payload = {
      id: editingDeptId || newDeptId.trim() || `dept-${Date.now()}`,
      name: newDeptName.trim(),
      code: newDeptCode.trim().toUpperCase(),
      hod: newDeptHod.trim()
    };

    try {
      const url = editingDeptId ? `/api/admin/departments/${editingDeptId}` : '/api/admin/departments';
      const method = editingDeptId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save department");
      
      setEditingDeptId(null);
      setNewDeptId('');
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptHod('');
      await loadDatabase();
      showToast(editingDeptId ? "Department updated successfully!" : "Department created and saved successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteDept = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Department',
      message: 'Are you sure you want to permanently delete this department schema? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete department");
          await loadDatabase();
          showToast("Department schema deleted successfully.", "success");
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  // Faculty CRUD
  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacultyName.trim()) return;

    const payload = {
      id: editingFacultyId || newFacultyId.trim() || `faculty-${Date.now()}`,
      name: newFacultyName.trim(),
      role: newFacultyRole.trim(),
      department: newFacultyDept,
      email: newFacultyEmail.trim()
    };

    try {
      const url = editingFacultyId ? `/api/admin/faculty/${editingFacultyId}` : '/api/admin/faculty';
      const method = editingFacultyId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save faculty");

      setEditingFacultyId(null);
      setNewFacultyId('');
      setNewFacultyName('');
      setNewFacultyRole('');
      setNewFacultyDept('');
      setNewFacultyEmail('');
      await loadDatabase();
      showToast(editingFacultyId ? "Faculty profile updated successfully!" : "Faculty profile registered successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Faculty Profile',
      message: 'Are you sure you want to permanently delete this faculty profile member? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/faculty/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error("Failed to delete faculty");
          await loadDatabase();
          showToast("Faculty profile deleted successfully.", "success");
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };


  const handleDownloadFallback = async () => {
    setIsDownloading(true);
    try {
      const response = await apiFetch('/api/admin/download-fallback');
      if (!response.ok) throw new Error("Failed to download database from server");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'local_fallback_db.json');
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      if (link.parentNode) link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast("Fallback DB downloaded successfully!", "success");
    } catch (error: any) {
      console.error("Failed to download fallback DB:", error);
      showToast("Browser blocked standard download. Opening viewer instead...", "info");
      handleOpenInspector();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInspector = async () => {
    try {
      const response = await apiFetch('/api/admin/download-fallback');
      if (!response.ok) throw new Error("Failed to fetch database file");
      const data = await response.json();
      setJsonContent(JSON.stringify(data, null, 2));
      setShowJsonModal(true);
    } catch (error: any) {
      showToast("Failed to fetch database content: " + error.message, "error");
    }
  };

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(jsonContent);
      setIsCopied(true);
      showToast("Database content copied to clipboard!", "success");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      showToast("Failed to copy. Please manually select the code to copy.", "error");
    }
  };

  if (loading && departments.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" style={{ animationDuration: '3s' }} />
        LOADING CAMPUS REGISTERS...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-850 dark:text-slate-100">
      
      {/* Database Backup & Control Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/80 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
              <FolderClosed className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">System Data Registry 🗄️</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Manage academic records, departments, and faculty. In case your cloud database is ever disconnected, the system relies on <code className="text-emerald-400 bg-slate-900/60 px-1.5 py-0.5 rounded font-mono text-xs">local_fallback_db.json</code> as a zero-latency failover.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <button
            type="button"
            onClick={handleDownloadFallback}
            disabled={isDownloading}
            className={`px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 hover:-translate-y-0.5 ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <FileDown className={`w-4 h-4 ${isDownloading ? 'animate-spin' : 'animate-bounce'}`} />
            {isDownloading ? 'Processing...' : 'Download File (JSON)'}
          </button>
          
          <button
            type="button"
            onClick={handleOpenInspector}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 hover:-translate-y-0.5"
          >
            <Eye className="w-4 h-4" />
            View & Copy DB (100% Guaranteed)
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('departments')}
          className={`py-3 px-5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'departments' 
              ? 'border-b-blue-600 text-blue-600 font-extrabold' 
              : 'border-b-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Academic Departments ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          className={`py-3 px-5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'faculty' 
              ? 'border-b-blue-600 text-blue-600 font-extrabold' 
              : 'border-b-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Faculty Registry ({faculty.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`py-3 px-5 text-xs font-bold transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'rules' 
              ? 'border-b-blue-600 text-blue-600 font-extrabold' 
              : 'border-b-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Plus className="w-4 h-4" />
          Knowledge Rules ({rules.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      {/* ==================== DEPARTMENTS PANEL ==================== */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm h-fit space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Register Department Code</h4>
            <form onSubmit={handleAddDept} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unique Code (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CSE"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Department Name (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science Engineering"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Head of Department (HOD)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. K. Sai Prasad"
                  value={newDeptHod}
                  onChange={(e) => setNewDeptHod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </form>
          </div>

          {/* List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Dept Code</th>
                    <th className="p-4">Department Name</th>
                    <th className="p-4">HOD Representative</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                      <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400 select-all uppercase">
                        {dept.code}
                      </td>
                      <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{dept.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{dept.hod || 'N/A'}</td>
                      <td className="p-4 text-right flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingDeptId(dept.id);
                            setNewDeptName(dept.name);
                            setNewDeptCode(dept.code);
                            setNewDeptHod(dept.hod);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-blue-500/10"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDept(dept.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">No departments added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FACULTY PANEL ==================== */}
      {activeTab === 'faculty' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm h-fit space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">Register Faculty Profile</h4>
            <form onSubmit={handleAddFaculty} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. A. V. S. Murthy"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Designation / Role</label>
                <input
                  type="text"
                  placeholder="e.g. Professor & Dean R&D"
                  value={newFacultyRole}
                  onChange={(e) => setNewFacultyRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                <select
                  value={newFacultyDept}
                  onChange={(e) => setNewFacultyDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. dean@narayanagroup.com"
                  value={newFacultyEmail}
                  onChange={(e) => setNewFacultyEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Faculty Profile
              </button>
            </form>
          </div>

          {/* List Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Faculty Member</th>
                    <th className="p-4">Designation</th>
                    <th className="p-4">Department Link</th>
                    <th className="p-4">Email Channel</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {faculty.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                      <td className="p-4 font-bold text-slate-850 dark:text-slate-100">{member.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{member.role || 'Designation Not Available'}</td>
                      <td className="p-4 text-slate-400 font-sans">{member.department || 'N/A'}</td>
                      <td className="p-4 font-mono text-[11px] text-blue-500 select-all">{member.email || 'N/A'}</td>
                      <td className="p-4 text-right flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingFacultyId(member.id);
                            setNewFacultyName(member.name);
                            setNewFacultyRole(member.role);
                            setNewFacultyDept(member.department || '');
                            setNewFacultyEmail(member.email || '');
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-blue-500/10"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaculty(member.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {faculty.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">No faculty profiles added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CATEGORIES PANEL ==================== */}

      {/* ==================== RULES PANEL ==================== */}
      {activeTab === 'rules' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Question</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                    <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{rule.question}</td>
                    <td className="p-4 text-slate-500 dark:text-slate-400">{rule.category}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        rule.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        {rule.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Guaranteed JSON Fallback Inspector Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <FolderClosed className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">Local Fallback DB Inspector 🖥️</h3>
                  <p className="text-[10px] text-slate-400">Current active register entries format</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>

            {/* Sandbox Iframe Warning / Guide */}
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5 leading-relaxed">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <strong className="font-bold text-amber-200 block mb-0.5">Iframe Sandbox Download Interception</strong>
                If your browser blocks the standard <code className="bg-slate-950/80 px-1 py-0.5 rounded text-amber-400 font-mono text-[10px]">.json</code> file download due to security sandbox guidelines, simply click the copy button below, create <code className="bg-slate-950/80 px-1 py-0.5 rounded text-amber-400 font-mono text-[10px]">local_fallback_db.json</code> at your project root, and paste the code.
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap gap-2 items-center justify-between">
              <span className="font-mono text-xs text-slate-400">local_fallback_db.json</span>
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Code to Clipboard
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 bg-slate-950 overflow-y-auto p-5 font-mono text-xs text-slate-300 leading-relaxed selection:bg-indigo-500/30 selection:text-white">
              <pre className="whitespace-pre-wrap">{jsonContent || 'Fetching content...'}</pre>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-indigo-500/10 hover:-translate-y-0.5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <>
          <BulkActionBar
            selectedCount={selectedDeptIds.size}
            onDeleteSelected={handleDeleteSelectedDepts}
            onExportSelected={handleExportSelectedDepts}
            onCancelSelection={() => setSelectedDeptIds(new Set())}
            label="departments"
          />
          <DeleteAllModal
            isOpen={showDeleteAllDeptModal}
            onClose={() => setShowDeleteAllDeptModal(false)}
            onConfirm={handleConfirmDeleteAllDepts}
            moduleName="Academic Departments"
            recordCount={departments.length}
            isDeleting={isDeletingAll}
          />
        </>
      )}

      {activeTab === 'faculty' && (
        <>
          <BulkActionBar
            selectedCount={selectedFacultyIds.size}
            onDeleteSelected={handleDeleteSelectedFaculty}
            onExportSelected={handleExportSelectedFaculty}
            onCancelSelection={() => setSelectedFacultyIds(new Set())}
            label="faculty members"
          />
          <DeleteAllModal
            isOpen={showDeleteAllFacultyModal}
            onClose={() => setShowDeleteAllFacultyModal(false)}
            onConfirm={handleConfirmDeleteAllFaculty}
            moduleName="Faculty Registry"
            recordCount={faculty.length}
            isDeleting={isDeletingAll}
          />
        </>
      )}
    </div>
  );
}
