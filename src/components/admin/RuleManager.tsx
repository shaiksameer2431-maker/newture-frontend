import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Search, FileDown, FileUp, Sparkles, X, 
  HelpCircle, BookOpen, Layers, RefreshCw, CheckCircle, Upload,
  CheckSquare, Square, Download
} from 'lucide-react';
import { Rule } from '../../types';
import { subscribeToCollection, bulkDeleteRules, deleteAllRules } from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import { RichResponseRenderer } from '../RichResponseRenderer';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface RuleManagerProps {
  rules?: Rule[];
  onUpdateRules?: (newRules: Rule[]) => Promise<void> | void;
  onStateChanged?: () => void;
}

const safeParseJsonArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    val = val.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } catch (e) {
        // Fallback
      }
    }
    return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const categoryOptions = ['General', 'Admissions', 'Academics', 'Infrastructure', 'Administration', 'Placements', 'Student Life'];

const ResponsePreview = ({ text }: { text: string }) => {
  if (!text.trim()) return null;
  return <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/20" aria-label="Live chatbot response preview">
    <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Live chatbot preview</p>
    <RichResponseRenderer text={text} isDark={false} fallback={<div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{text}</div>} />
  </section>;
};

export default function RuleManager({ rules: propsRules, onUpdateRules, onStateChanged }: RuleManagerProps) {
  const { showToast } = useToast();
  const [rules, setRules] = useState<Rule[]>(propsRules || []);
  const [loading, setLoading] = useState(propsRules ? false : true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState('All');
  const [ruleStatusFilter, setRuleStatusFilter] = useState('All');

  // Selection state for bulk actions
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());

  // Modals / forms
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk selection state
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Add rule state
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [newRuleStatus, setNewRuleStatus] = useState<'Active' | 'Archived'>('Active');
  const [newRuleQuestion, setNewRuleQuestion] = useState('');
  const [newRuleAnswer, setNewRuleAnswer] = useState('');
  const [newRuleRelatedQuestions, setNewRuleRelatedQuestions] = useState('');
  const [newRulePriority, setNewRulePriority] = useState<number>(1);
  const [newRuleDepartment, setNewRuleDepartment] = useState('');

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

  // Fetch Rules from DB via API
  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/admin/rules');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      // Ensure properties are camelCased
      const mappedData = data.map((item: any) => ({
        id: item.id,
        category: item.category,
        status: item.status || 'Active',
        question: item.question,
        answer: item.answer,
        keywords: item.keywords || '',
        synonyms: item.synonyms || '',
        relatedQuestions: safeParseJsonArray(item.related_questions || item.relatedQuestions),
        priority: item.priority || 1,
        relatedDepartment: item.related_department || item.relatedDepartment || ''
      }));
      
      setRules(mappedData);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch rules:", err);
      setError("Unable to connect to the knowledge base database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propsRules) {
      setRules(propsRules);
      setLoading(false);
    }
  }, [propsRules]);

  useEffect(() => {
    // Only subscribe locally if we don't have propsRules provided by parent
    let unsub = () => {};
    if (!propsRules) {
      unsub = subscribeToCollection<Rule>('rules', (data) => {
        // Map properties to camelCase
        const mappedData = data.map((item: any) => ({
          id: item.id,
          category: item.category,
          status: item.status || 'Active',
          question: item.question,
          answer: item.answer,
          keywords: item.keywords || '',
          synonyms: item.synonyms || '',
          relatedQuestions: safeParseJsonArray(item.related_questions || item.relatedQuestions),
          priority: item.priority || 1,
          relatedDepartment: item.related_department || item.relatedDepartment || ''
        }));
        setRules(mappedData);
        setLoading(false);
      });
    }

    // Default category fallback (categories collection deprecated)
    if (!newRuleCategory) setNewRuleCategory('General');

    return () => unsub();
  }, [propsRules]);

  // Handle Excel Import
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsImporting(true);
        const fileData = evt.target?.result as string;
        const base64Data = fileData.split(',')[1] || fileData;

        const res = await apiFetch('/api/admin/rules/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: file.name
          })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Server error ${res.status}`);
        }

        const resData = await res.json();
        await fetchRules();
        
        if (resData.failed && resData.failed.length > 0) {
          showToast(`Imported with ${resData.failed.length} failures. Added: ${resData.added}, Updated: ${resData.updated}`, "info");
          console.error("Import failures:", resData.failed);
        } else {
          showToast(`Successfully imported ${resData.added + resData.updated} rules!`, "success");
        }
        
        if (onStateChanged) onStateChanged();
      } catch (err: any) {
        console.error("Excel import error:", err);
        showToast(`Failed to parse or upload Excel file: ${err.message}`, "error");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Save
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleQuestion.trim() || !newRuleAnswer.trim()) {
      showToast("Question and Answer are required!", "error");
      return;
    }
    const normalizedQuestion = newRuleQuestion.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    if (rules.some(rule => rule.question.trim().toLocaleLowerCase().replace(/\s+/g, ' ') === normalizedQuestion)) {
      showToast('A rule with the same primary question already exists. Edit the existing rule instead.', 'error');
      return;
    }

    const cleanedRelated = newRuleRelatedQuestions
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    const generatedId = `rule-${Date.now()}`;
    const payload = {
      id: generatedId,
      category: newRuleCategory || 'General',
      status: newRuleStatus,
      question: newRuleQuestion.trim(),
      answer: newRuleAnswer.trim(),
      keywords: newRuleQuestion.trim(),
      synonyms: cleanedRelated.join(', '),
      relatedQuestions: cleanedRelated,
      priority: Number(newRulePriority),
      relatedDepartment: newRuleDepartment
    };

    try {
      const res = await apiFetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Server failed to save rule");
      
      setShowAddRuleModal(false);
      setNewRuleQuestion('');
      setNewRuleAnswer('');
      setNewRuleRelatedQuestions('');
      
      fetchRules();
      showToast("Knowledge rule created successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error saving rule: ${err.message}`, "error");
    }
  };

  // Handle Update
  const handleUpdateRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    if (!editingRule.question.trim() || !editingRule.answer.trim()) {
      showToast('Question and answer are required.', 'error');
      return;
    }
    const normalizedQuestion = editingRule.question.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    if (rules.some(rule => rule.id !== editingRule.id && rule.question.trim().toLocaleLowerCase().replace(/\s+/g, ' ') === normalizedQuestion)) {
      showToast('Another rule already uses this primary question.', 'error');
      return;
    }

    let relatedList: string[] = [];
    if (typeof editingRule.relatedQuestions === 'string') {
      relatedList = (editingRule.relatedQuestions as string)
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0);
    } else if (Array.isArray(editingRule.relatedQuestions)) {
      relatedList = editingRule.relatedQuestions;
    }

    const payload = {
      id: editingRule.id,
      category: editingRule.category,
      status: editingRule.status,
      question: editingRule.question.trim(),
      answer: editingRule.answer.trim(),
      keywords: editingRule.question.trim(),
      synonyms: relatedList.join(', '),
      relatedQuestions: relatedList,
      priority: editingRule.priority || 1,
      relatedDepartment: editingRule.relatedDepartment || ''
    };

    try {
      const res = await apiFetch(`/api/admin/rules/${encodeURIComponent(editingRule.id)}`, {
        // Creating a rule is POST; editing an existing rule must use its
        // dedicated PUT endpoint so it updates instead of attempting a duplicate insert.
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Server failed to update rule");
      
      setEditingRule(null);
      fetchRules();
      showToast("Knowledge rule updated successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error updating rule: ${err.message}`, "error");
    }
  };

  // Handle Delete
  const handleDeleteRule = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Knowledge Rule',
      message: 'Are you sure you want to permanently delete this knowledge rule? This action is irreversible.',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/rules/${id}`, {
            method: 'DELETE'
          });
          if (!res.ok) throw new Error("Server failed to delete rule");
          
          fetchRules();
          showToast("Knowledge rule deleted successfully.", "success");
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(`Error deleting rule: ${err.message}`, "error");
        }
      }
    });
  };

  // Bulk Selection Handlers
  const toggleRuleSelection = (id: string) => {
    setSelectedRuleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllRules = () => {
    const filteredRules = rules
      .filter(r => {
        const searchLower = ruleSearch.toLowerCase();
        const matchSearch = r.question.toLowerCase().includes(searchLower) || 
                            r.answer.toLowerCase().includes(searchLower) ||
                            (r.category && r.category.toLowerCase().includes(searchLower));
        const matchCat = ruleCategoryFilter === 'All' || r.category === ruleCategoryFilter;
        const matchStatus = ruleStatusFilter === 'All' || r.status === ruleStatusFilter;
        return matchSearch && matchCat && matchStatus;
      });
    
    const allSelected = selectedRuleIds.size === filteredRules.length && filteredRules.length > 0;
    
    if (allSelected) {
      setSelectedRuleIds(new Set());
    } else {
      setSelectedRuleIds(new Set(filteredRules.map(r => r.id)));
    }
  };

  const toggleSelectVisibleRules = () => {
    const filteredRules = rules
      .filter(r => {
        const searchLower = ruleSearch.toLowerCase();
        const matchSearch = r.question.toLowerCase().includes(searchLower) || 
                            r.answer.toLowerCase().includes(searchLower) ||
                            (r.category && r.category.toLowerCase().includes(searchLower));
        const matchCat = ruleCategoryFilter === 'All' || r.category === ruleCategoryFilter;
        const matchStatus = ruleStatusFilter === 'All' || r.status === ruleStatusFilter;
        return matchSearch && matchCat && matchStatus;
      });
    
    const visibleIds = filteredRules.map(r => r.id);
    const allVisibleSelected = visibleIds.every(id => selectedRuleIds.has(id));
    
    if (allVisibleSelected) {
      setSelectedRuleIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedRuleIds(prev => new Set([...prev, ...visibleIds]));
    }
  };

  const clearSelection = () => {
    setSelectedRuleIds(new Set());
  };

  const handleBulkDeleteRules = async () => {
    if (selectedRuleIds.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      // Delete each selected rule
      for (const id of selectedRuleIds) {
        const res = await apiFetch(`/api/admin/rules/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Failed to delete rule ${id}`);
      }
      
      fetchRules();
      clearSelection();
      showToast(`Successfully deleted ${selectedRuleIds.size} knowledge rule(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error during bulk delete: ${err.message}`, "error");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportSelectedRules = () => {
    const selectedRules = rules.filter(r => selectedRuleIds.has(r.id));
    if (selectedRules.length === 0) return;
    
    const exportData = selectedRules.map(r => ({
      category: r.category,
      question: r.question,
      answer: r.answer,
      keywords: r.keywords,
      synonyms: r.synonyms,
      relatedQuestions: r.relatedQuestions,
      priority: r.priority,
      relatedDepartment: r.relatedDepartment,
      status: r.status
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rules-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selectedRules.length} rule(s).`, "success");
  };

  // Bulk Selection Handlers
  const filteredRules = rules.filter(r => {
    const searchLower = ruleSearch.toLowerCase();
    const matchSearch = r.question.toLowerCase().includes(searchLower) || 
                        r.answer.toLowerCase().includes(searchLower) ||
                        (r.category && r.category.toLowerCase().includes(searchLower));
    const matchCat = ruleCategoryFilter === 'All' || r.category === ruleCategoryFilter;
    const matchStatus = ruleStatusFilter === 'All' || r.status === ruleStatusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const visibleCount = filteredRules.length;
  const isAllSelected = visibleCount > 0 && selectedRules.size >= visibleCount;
  const isIndeterminate = selectedRules.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredRules.map(r => r.id)));
    }
  };

  const toggleSelectVisible = () => {
    setSelectedRules(prev => {
      const next = new Set(prev);
      filteredRules.forEach(r => {
        if (next.has(r.id)) next.delete(r.id);
        else next.add(r.id);
      });
      return next;
    });
  };

  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteSelected = async () => {
    if (selectedRules.size === 0 && selectedRuleIds.size === 0) return;
    const targetIds = Array.from(selectedRules.size > 0 ? selectedRules : selectedRuleIds);
    try {
      setIsBulkDeleting(true);
      const count = await bulkDeleteRules(targetIds);
      setSelectedRules(new Set());
      setSelectedRuleIds(new Set());
      await fetchRules();
      showToast(`Successfully deleted ${count} selected knowledge rule(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting rules: ${err.message}`, "error");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteAllRules = () => {
    setShowDeleteAllModal(true);
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllRules();
      setSelectedRules(new Set());
      setSelectedRuleIds(new Set());
      await fetchRules();
      showToast(`Successfully purged all ${count} knowledge rule(s) from database.`, "success");
      setShowDeleteAllModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to purge knowledge base: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleExportSelected = () => {
    const selected = filteredRules.filter(r => selectedRules.has(r.id));
    const dataStr = JSON.stringify(selected, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rules-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} rule${selected.length > 1 ? 's' : ''}.`, "success");
  };

  // Bulk Ingestion
  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(bulkImportText);
      if (!Array.isArray(parsed)) {
        showToast("Import content must be a valid JSON Array of objects containing 'question' and 'answer' attributes.", "error");
        return;
      }

      setLoading(true);
      const payloads: any[] = [];
      for (const item of parsed) {
        if (!item.question || !item.answer) continue;
        const generatedId = `bulk-rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        payloads.push({
          id: generatedId,
          category: item.category || 'General',
          status: item.status || 'Active',
          question: item.question.trim(),
          answer: item.answer.trim(),
          keywords: item.keywords || '',
          synonyms: item.synonyms || '',
          relatedQuestions: safeParseJsonArray(item.relatedQuestions || item.related_questions),
          priority: item.priority || 1,
          relatedDepartment: item.relatedDepartment || item.related_department || ''
        });
      }

      if (payloads.length === 0) {
        showToast("No valid records found to import.", "error");
        return;
      }

      if (onUpdateRules) {
        await onUpdateRules(payloads);
      } else {
        const res = await apiFetch('/api/admin/rules/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloads)
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
      }

      setShowImportModal(false);
      setBulkImportText('');
      await fetchRules();
      showToast(`Import completed! Successfully parsed & inserted ${payloads.length} knowledge records.`, "success");
      if (onStateChanged) onStateChanged();
    } catch (e: any) {
      showToast(`Failed to parse bulk JSON data: ${e.message}. Ensure double quotes and standard layout format.`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Generate blank template
  const handleDownloadTemplate = () => {
    const template = [
      {
        category: "Admission",
        question: "What is the application fee for B.Tech admission at Narayana Engineering College?",
        answer: "The application or processing fee for B.Tech admissions is Rs. 1,000 for Convener quota and Rs. 5,000 for Category-B management quota admissions.",
        related_questions: [
          "NECN entrance application cost",
          "BTech admission registration fees"
        ]
      }
    ];
    setBulkImportText(JSON.stringify(template, null, 2));
    setShowImportModal(true);
  };

  if (loading && rules.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" style={{ animationDuration: '4s' }} />
        LOADING KNOWLEDGE BASE REGISTERS...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-850 dark:text-slate-100">
      {/* Knowledge header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950/80 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Rule-Based Knowledge Engine 🧠</h2>
          </div>
          <p className="text-sm text-slate-300">
            Configure primary conversational queries, exact answers, related triggers, and classifications. Supports bulk imports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-500 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Import Excel
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleExcelImport} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <FileDown className="w-4 h-4" />
            Spreadsheet Template
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <FileUp className="w-4 h-4" />
            Bulk Ingestion (Excel/JSON)
          </button>
          <button
            type="button"
            onClick={() => setShowAddRuleModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
          >
            <Plus className="w-4 h-4" />
            Create Knowledge Rule
          </button>
          <button
            type="button"
            onClick={handleDeleteAllRules}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Clear Entire Rule Base
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              aria-label={isAllSelected ? 'Deselect all visible rules' : 'Select all visible rules'}
            />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {isAllSelected ? 'All' : 'Select'}
            </span>
            {selectedRuleIds.size > 0 && !isAllSelected && (
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-500/20 text-xs">
                {selectedRuleIds.size}
              </span>
            )}
            <button
              onClick={toggleSelectVisible}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800"
              type="button"
            >
              {isAllSelected ? 'Deselect visible' : 'Select visible'}
            </button>
            {isAllSelected && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                (All {visibleCount} selected)
              </span>
            )}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={ruleSearch}
              onChange={(e) => setRuleSearch(e.target.value)}
              placeholder="Search questions, answers, keywords..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-850 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Category:</span>
            <select
              value={ruleCategoryFilter}
              onChange={(e) => setRuleCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="General">General</option>
              <option value="Admissions">Admissions</option>
              <option value="Academics">Academics</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Administration">Administration</option>
              <option value="Placements">Placements</option>
              <option value="Student Life">Student Life</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={ruleStatusFilter}
              onChange={(e) => setRuleStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rules list */}
      <div className="grid grid-cols-1 gap-4">
        {rules
          .filter(r => {
            const searchLower = ruleSearch.toLowerCase();
            const matchSearch = r.question.toLowerCase().includes(searchLower) || 
                                r.answer.toLowerCase().includes(searchLower) ||
                                (r.category && r.category.toLowerCase().includes(searchLower));
            const matchCat = ruleCategoryFilter === 'All' || r.category === ruleCategoryFilter;
            const matchStatus = ruleStatusFilter === 'All' || r.status === ruleStatusFilter;
            return matchSearch && matchCat && matchStatus;
          })
          .map((rule) => {
            const isSelected = selectedRules.has(rule.id);
            return (
              <div 
                key={rule.id} 
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 relative group flex flex-col justify-between ${isSelected ? 'ring-2 ring-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRuleSelection(rule.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                        aria-label={isSelected ? `Deselect rule ${rule.id}` : `Select rule ${rule.id}`}
                      />
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold text-[10px] uppercase tracking-wider font-sans">
                        {rule.category || 'General'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        rule.status === 'Active' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10' 
                          : 'bg-slate-500/10 text-slate-400 border border-slate-700/10'
                      }`}>
                        {rule.status === 'Active' ? 'ACTIVE' : 'ARCHIVED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 z-10">
                      <button
                        type="button"
                        onClick={() => setEditingRule({ ...rule })}
                        title="Edit Rule"
                        className="p-2 bg-slate-50 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700/50 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        title="Delete Rule"
                        className="p-2 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-400 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700/50 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400 font-bold font-mono">PRIMARY TRIGGER QUESTION:</div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                    "{rule.question}"
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400 font-bold font-mono">DETERMINISTIC CONVEX ANSWER:</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                    {rule.answer}
                  </p>
                </div>

                {rule.relatedQuestions && Array.isArray(rule.relatedQuestions) && rule.relatedQuestions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] text-slate-400 font-bold font-mono uppercase">SEMANTIC EQUIVALENTS & TRIGGERS:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {rule.relatedQuestions.map((q, idx) => (
                        <span key={idx} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-medium font-sans">
                          "{q}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================== MODAL: ADD KNOWLEDGE RULE ==================================== */}
      {showAddRuleModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Create Knowledge Base Rule</h3>
              </div>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Classification</label>
                  <select
                    value={newRuleCategory}
                    onChange={(e) => setNewRuleCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  >
                    {categoryOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Active Status</label>
                  <select
                    value={newRuleStatus}
                    onChange={(e) => setNewRuleStatus(e.target.value as 'Active' | 'Archived')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Response Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newRulePriority}
                    onChange={(e) => setNewRulePriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Related Department Code</label>
                  <input
                    type="text"
                    value={newRuleDepartment}
                    onChange={(e) => setNewRuleDepartment(e.target.value)}
                    placeholder="e.g. ADMISSIONS"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary Intent / Question (Required)</label>
                <input
                  type="text"
                  required
                  value={newRuleQuestion}
                  onChange={(e) => setNewRuleQuestion(e.target.value)}
                  placeholder="e.g. What are B.Tech computer science fees?"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Factual Deterministic Response Answer (Required)</label>
                <textarea
                  rows={4}
                  required
                  value={newRuleAnswer}
                  onChange={(e) => setNewRuleAnswer(e.target.value)}
                  placeholder="The annual CSE tuition fee is..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Semantic equivalents & alternate triggers (One per line)</label>
                <textarea
                  rows={3}
                  value={newRuleRelatedQuestions}
                  onChange={(e) => setNewRuleRelatedQuestions(e.target.value)}
                  placeholder="BTech CSE fee structure&#10;How much is computer science cost?&#10;Computer engineering payments"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <ResponsePreview text={newRuleAnswer} />

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-850 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Save New Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: EDIT KNOWLEDGE RULE ==================================== */}
      {editingRule && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Edit Knowledge Rule</h3>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRuleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Classification</label>
                  <select
                    value={editingRule.category}
                    onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  >
                    {categoryOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Active Status</label>
                  <select
                    value={editingRule.status}
                    onChange={(e) => setEditingRule({ ...editingRule, status: e.target.value as 'Active' | 'Archived' })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Response Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingRule.priority || 1}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Related Department Code</label>
                  <input
                    type="text"
                    value={editingRule.relatedDepartment || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, relatedDepartment: e.target.value })}
                    placeholder="e.g. ADMISSIONS"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary Intent / Question</label>
                <input
                  type="text"
                  required
                  value={editingRule.question}
                  onChange={(e) => setEditingRule({ ...editingRule, question: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Factual Deterministic Response Answer</label>
                <textarea
                  rows={4}
                  required
                  value={editingRule.answer}
                  onChange={(e) => setEditingRule({ ...editingRule, answer: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Semantic Trigger Questions (One per line)</label>
                <textarea
                  rows={3}
                  value={
                    Array.isArray(editingRule.relatedQuestions) 
                      ? editingRule.relatedQuestions.join('\n') 
                      : (editingRule.relatedQuestions as any) || ''
                  }
                  onChange={(e) => setEditingRule({ ...editingRule, relatedQuestions: e.target.value.split('\n') })}
                  placeholder="Add variations here..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <ResponsePreview text={editingRule.answer} />

              <div className="pt-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const ruleId = editingRule.id;
                    setEditingRule(null);
                    handleDeleteRule(ruleId);
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-650 dark:text-rose-400 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Rule
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRule(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-850 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: BULK SPREADSHEET IMPORT ==================================== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Bulk Ingest Knowledge Base Spreadsheet</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-normal">
                Paste your Excel / CSV exports mapped into standard JSON array objects. It will parse and upsert rows directly into SQLite.
              </p>
              
              <textarea
                rows={10}
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder='[&#10;  { &#10;    "category": "General", &#10;    "question": "What is the fee?", &#10;    "answer": "The fee is...", &#10;    "keywords": "fee, cost, payment", &#10;    "synonyms": "pricing, charges", &#10;    "priority": 1, &#10;    "relatedQuestions": ["How much to pay?", "Payment details"] &#10;  }&#10;]'
                className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-slate-850 dark:text-slate-100"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-855 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Confirm & Upsert Rows
                </button>
              </div>
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
        selectedCount={selectedRules.size || selectedRuleIds.size}
        onDeleteSelected={handleDeleteSelected}
        onExportSelected={handleExportSelected}
        onCancelSelection={() => {
          setSelectedRules(new Set());
          setSelectedRuleIds(new Set());
        }}
        label="knowledge rules"
      />

      <DeleteAllModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleConfirmDeleteAll}
        moduleName="Knowledge Rules"
        recordCount={rules.length}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}
