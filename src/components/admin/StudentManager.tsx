import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Search, BookOpen, RefreshCw, 
  Sparkles, XCircle, X, Check, Users, FileUp, FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student } from '../../types';
import { subscribeToCollection, bulkDeleteStudents, deleteAllStudents } from '../../data/sqliteService';
import { useToast } from './Toast';
import { apiFetch } from '../../lib/api';
import BulkActionBar from './BulkActionBar';
import DeleteAllModal from './DeleteAllModal';

interface StudentManagerProps {
  // Let parent know when student collection changes if it wants to sync global state
  onStateChanged?: () => void;
}

export default function StudentManager({ onStateChanged }: StudentManagerProps) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBranchFilter, setStudentBranchFilter] = useState('All');
  const [studentStatusFilter, setStudentStatusFilter] = useState('All');

  // Modals / forms
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add student form state
  const [newStudentRegNo, setNewStudentRegNo] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentBranch, setNewStudentBranch] = useState('Computer Science Engineering (CSE)');
  const [newStudentAttendance, setNewStudentAttendance] = useState<number>(85);
  const [newStudentCgpa, setNewStudentCgpa] = useState<number>(8.0);
  const [newStudentMid1, setNewStudentMid1] = useState<number>(20);
  const [newStudentMid2, setNewStudentMid2] = useState<number>(20);

  // Fetch student records from REST API
  // Selection and Bulk Deletion States
  const [selectedRegNos, setSelectedRegNos] = useState<Set<string>>(new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
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

  const filteredStudents = students.filter(s => {
    const searchLower = studentSearch.toLowerCase();
    const matchSearch = s.regNo.toLowerCase().includes(searchLower) || s.name.toLowerCase().includes(searchLower);
    const matchBranch = studentBranchFilter === 'All' || s.branch === studentBranchFilter;
    const isRisk = s.attendance < 75;
    const matchStatus = studentStatusFilter === 'All' || (studentStatusFilter === 'Safe' ? !isRisk : isRisk);
    return matchSearch && matchBranch && matchStatus;
  });

  const isAllSelected = filteredStudents.length > 0 && selectedRegNos.size >= filteredStudents.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRegNos(new Set());
    } else {
      setSelectedRegNos(new Set(filteredStudents.map(s => s.regNo)));
    }
  };

  const toggleSelect = (regNo: string) => {
    setSelectedRegNos(prev => {
      const next = new Set(prev);
      if (next.has(regNo)) next.delete(regNo);
      else next.add(regNo);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedRegNos.size === 0) return;
    try {
      const count = await bulkDeleteStudents(Array.from(selectedRegNos));
      setSelectedRegNos(new Set());
      await fetchStudents();
      showToast(`Successfully deleted ${count} selected student record(s).`, "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error deleting students: ${err.message}`, "error");
    }
  };

  const handleExportSelected = () => {
    const selected = students.filter(s => selectedRegNos.has(s.regNo));
    const ws = XLSX.utils.json_to_sheet(selected);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Selected Students");
    XLSX.writeFile(wb, `Selected_Students_${Date.now()}.xlsx`);
    showToast(`Exported ${selected.length} student records.`, "success");
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      const count = await deleteAllStudents();
      setSelectedRegNos(new Set());
      await fetchStudents();
      showToast(`Successfully purged all ${count} student record(s) from registry.`, "success");
      setShowDeleteAllModal(false);
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Failed to purge student registry: ${err.message}`, "error");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/admin/students');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      
      // Ensure properties are camelCased
      const mappedData = data.map((item: any) => ({
        regNo: item.reg_no || item.regNo,
        name: item.name,
        branch: item.branch,
        attendance: item.attendance || 0,
        cgpa: item.cgpa || 0,
        mid1: item.mid1 || 0,
        mid2: item.mid2 || 0
      }));
      
      setStudents(mappedData);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch students from API:", err);
      setError("Unable to connect to the students database server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Use real-time subscription for students
    const unsub = subscribeToCollection<Student>('students', (data) => {
      // Map properties to camelCase
      const mappedData = data.map((item: any) => ({
        regNo: item.reg_no || item.regNo,
        name: item.name,
        branch: item.branch,
        attendance: item.attendance || 0,
        cgpa: item.cgpa || 0,
        mid1: item.mid1 || 0,
        mid2: item.mid2 || 0
      }));
      setStudents(mappedData);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Save new student profile
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentRegNo.trim() || !newStudentName.trim()) {
      showToast("Registration Number and Name are required!", "error");
      return;
    }
    const upReg = newStudentRegNo.trim().toUpperCase();
    if (students.some(s => s.regNo.toUpperCase() === upReg)) {
      showToast("A student with this Hall Ticket number already exists!", "error");
      return;
    }

    const payload = {
      reg_no: upReg,
      name: newStudentName.trim(),
      branch: newStudentBranch,
      attendance: Number(newStudentAttendance) || 0,
      cgpa: Number(newStudentCgpa) || 0,
      mid1: Number(newStudentMid1) || 0,
      mid2: Number(newStudentMid2) || 0
    };

    try {
      const res = await apiFetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Server failed to save student profile");
      
      setShowAddStudentModal(false);
      setNewStudentRegNo('');
      setNewStudentName('');
      setNewStudentAttendance(85);
      setNewStudentCgpa(8.0);
      setNewStudentMid1(20);
      setNewStudentMid2(20);
      
      fetchStudents();
      showToast("Student profile created successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error saving student: ${err.message}`, "error");
    }
  };

  // Update existing student profile
  const handleUpdateStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const payload = {
      name: editingStudent.name.trim(),
      branch: editingStudent.branch,
      attendance: Number(editingStudent.attendance) || 0,
      cgpa: Number(editingStudent.cgpa) || 0,
      mid1: Number(editingStudent.mid1) || 0,
      mid2: Number(editingStudent.mid2) || 0
    };

    try {
      const res = await apiFetch(`/api/admin/students/${editingStudent.regNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Server failed to update student record");
      
      setEditingStudent(null);
      fetchStudents();
      showToast("Student academic profile updated successfully!", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Error updating student: ${err.message}`, "error");
    }
  };

  // Delete student profile
  const handleDeleteStudent = async (regNo: string) => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 Delete Student Profile',
      message: `Are you sure you want to permanently delete student record ${regNo}? This action is irreversible.`,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/students/${regNo}`, {
            method: 'DELETE'
          });
          if (!res.ok) throw new Error("Server failed to delete student");
          
          fetchStudents();
          showToast("Student profile permanently deleted.", "success");
          if (onStateChanged) onStateChanged();
        } catch (err: any) {
          showToast(`Error deleting student: ${err.message}`, "error");
        }
      }
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      regNo: "22711A0501",
      name: "John Doe",
      branch: "Computer Science Engineering (CSE)",
      attendance: 85,
      cgpa: 8.5,
      mid1: 20,
      mid2: 22
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    XLSX.writeFile(wb, "Student_Registry_Template.xlsx");
  };

  // Handle Excel Import
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const fileData = evt.target?.result as string;
        // Strip data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64, prefix if present
        const base64Data = fileData.split(',')[1] || fileData;

        const res = await apiFetch('/api/admin/students/import', {
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
        await fetchStudents();
        
        if (resData.failed && resData.failed.length > 0) {
          showToast(`Imported with ${resData.failed.length} failures. Added: ${resData.added}, Updated: ${resData.updated}`, "info");
          console.error("Import failures:", resData.failed);
        } else {
          showToast(`Successfully imported ${resData.added + resData.updated} students!`, "success");
        }
        
        if (onStateChanged) onStateChanged();
      } catch (err: any) {
        console.error("Excel import error:", err);
        showToast(`Failed to parse or upload Excel file: ${err.message}`, "error");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Bulk daily attendance simulator
  const handleBulkDailyAttendanceSimulator = async () => {
    try {
      const res = await apiFetch('/api/admin/students/sync', {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Server synchronization failed");
      
      await fetchStudents();
      showToast("Narayana Central E-Cap Synchronizer completed! Daily student logs processed & database percentage marks updated successfully.", "success");
      if (onStateChanged) onStateChanged();
    } catch (err: any) {
      showToast(`Sync failed: ${err.message}`, "error");
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" />
        LOADING STUDENT REGISTERS...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-850 dark:text-slate-100">
      {/* Header section with Stats Row */}
      <div className="bg-gradient-to-r from-blue-900/60 via-slate-900 to-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white font-sans">Student Attendance & E-Cap Records 📊</h2>
          </div>
          <p className="text-sm text-slate-300">
            Manage live student metrics, check-ins, internal marks, and academic status. Changes sync instantly with E-Cap & Chatbot Portal.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer border border-slate-700"
          >
            <FileDown className="w-4 h-4" />
            Template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer border border-indigo-500"
          >
            <FileUp className="w-4 h-4" />
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
            onClick={handleBulkDailyAttendanceSimulator}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            Sync Daily Attendance
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center gap-2 font-mono">
          <XCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Quick KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registered</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{students.length}</div>
          <div className="text-[10px] text-slate-500 font-medium">B.Tech Active Profiles</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-rose-500">Condonation Risks</div>
          <div className="text-2xl font-extrabold text-rose-500">{students.filter(s => s.attendance < 75).length}</div>
          <div className="text-[10px] text-rose-400/80 font-medium">Below AICTE 75% Limit</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Attendance</div>
          <div className="text-2xl font-extrabold text-blue-500">
            {students.length > 0 ? (students.reduce((acc, s) => acc + Number(s.attendance || 0), 0) / students.length).toFixed(1) : 0}%
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Campus General Average</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average CGPA</div>
          <div className="text-2xl font-extrabold text-emerald-500">
            {students.length > 0 ? (students.reduce((acc, s) => acc + Number(s.cgpa || 0), 0) / students.length).toFixed(2) : 0}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Out of 10.00 Scale</div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search Hall Ticket or Name..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-850 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Branch filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Branch:</span>
            <select
              value={studentBranchFilter}
              onChange={(e) => setStudentBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Branches</option>
              <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
              <option value="Electronics & Communication (ECE)">ECE</option>
              <option value="Electrical & Electronics (EEE)">EEE</option>
              <option value="Information Technology (IT)">IT</option>
              <option value="Mechanical Engineering">Mechanical</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={studentStatusFilter}
              onChange={(e) => setStudentStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-750 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Safe">Safe (&gt;= 75%)</option>
              <option value="Risk">Risk (&lt; 75%)</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddStudentModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
          >
            <Plus className="w-4 h-4" />
            Add Student Profile
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteAllModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Clear Student Registry
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  />
                </th>
                <th className="p-4">Hall Ticket</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Branch / Department</th>
                <th className="p-4">Attendance Rate</th>
                <th className="p-4">Cumulative CGPA</th>
                <th className="p-4">Mid Marks (1 / 2)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-855">
              {students
                .filter(s => {
                  const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                        s.regNo.toLowerCase().includes(studentSearch.toLowerCase());
                  const matchesBranch = studentBranchFilter === 'All' || s.branch === studentBranchFilter;
                  const matchesStatus = studentStatusFilter === 'All' || 
                                        (studentStatusFilter === 'Safe' ? s.attendance >= 75 : s.attendance < 75);
                  return matchesSearch && matchesBranch && matchesStatus;
                })
                .map((student) => {
                  const isSafe = student.attendance >= 75;
                  return (
                    <tr key={student.regNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedRegNos.has(student.regNo)}
                          onChange={() => toggleSelect(student.regNo)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400 select-all uppercase">
                        {student.regNo}
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                        {student.name}
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">
                        {student.branch}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold font-mono text-sm ${isSafe ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {student.attendance}%
                          </span>
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                              style={{ width: `${Math.min(100, student.attendance)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {student.cgpa.toFixed(2)}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{student.mid1}</span>
                        <span className="mx-1 text-slate-300 dark:text-slate-700">/</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{student.mid2}</span>
                        <span className="text-[10px] text-slate-400 ml-1">/25</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          isSafe 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' 
                            : 'bg-rose-500/10 text-rose-500 border-rose-500/10'
                        }`}>
                          {isSafe ? '✅ SAFE' : '⚠️ RISK'}
                        </span>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingStudent({ ...student })}
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-blue-500 hover:text-blue-600 rounded-lg cursor-pointer transition-all border border-slate-200 dark:border-slate-700/50"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.regNo)}
                          className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer transition-all border border-slate-200 dark:border-slate-700/50"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {students.length === 0 && (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-500 animate-pulse" />
            <div className="text-sm font-bold">No Students Tracked Yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add new student records or trigger bulk sync to generate student attendance logs.
            </p>
          </div>
        )}
      </div>

      {/* ==================================== MODAL: ADD STUDENT PROFILE ==================================== */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Add Student Academic Record</h3>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hall Ticket Number (Required)</label>
                <input
                  type="text"
                  required
                  value={newStudentRegNo}
                  onChange={(e) => setNewStudentRegNo(e.target.value)}
                  placeholder="e.g. 26911A0511"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 placeholder-slate-400 font-mono uppercase focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Student Name (Required)</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Student Name"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Branch</label>
                <select
                  value={newStudentBranch}
                  onChange={(e) => setNewStudentBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-855 dark:text-slate-100 focus:outline-none"
                >
                  <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                  <option value="Electronics & Communication (ECE)">ECE</option>
                  <option value="Electrical & Electronics (EEE)">EEE</option>
                  <option value="Information Technology (IT)">IT</option>
                  <option value="Mechanical Engineering">Mechanical</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Attendance %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newStudentAttendance}
                    onChange={(e) => setNewStudentAttendance(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CGPA (0 - 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={newStudentCgpa}
                    onChange={(e) => setNewStudentCgpa(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mid-1 Marks (/25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={newStudentMid1}
                    onChange={(e) => setNewStudentMid1(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mid-2 Marks (/25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={newStudentMid2}
                    onChange={(e) => setNewStudentMid2(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-850 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  Save Student Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================== MODAL: EDIT STUDENT PROFILE ==================================== */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-slate-850 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500 animate-pulse" />
                <h3 className="font-bold text-base text-slate-955 dark:text-slate-100">Edit Student Record: <span className="font-mono text-blue-500">{editingStudent.regNo}</span></h3>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Branch</label>
                <select
                  value={editingStudent.branch}
                  onChange={(e) => setEditingStudent({ ...editingStudent, branch: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                >
                  <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                  <option value="Electronics & Communication (ECE)">ECE</option>
                  <option value="Electrical & Electronics (EEE)">EEE</option>
                  <option value="Information Technology (IT)">IT</option>
                  <option value="Mechanical Engineering">Mechanical</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Attendance Percentage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingStudent.attendance}
                    onChange={(e) => setEditingStudent({ ...editingStudent, attendance: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cumulative CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editingStudent.cgpa}
                    onChange={(e) => setEditingStudent({ ...editingStudent, cgpa: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mid-1 Marks (/25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={editingStudent.mid1}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mid1: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mid-2 Marks (/25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={editingStudent.mid2}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mid2: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-855 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
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

      <BulkActionBar
        selectedCount={selectedRegNos.size}
        onDeleteSelected={handleDeleteSelected}
        onExportSelected={handleExportSelected}
        onCancelSelection={() => setSelectedRegNos(new Set())}
        label="students"
      />

      <DeleteAllModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleConfirmDeleteAll}
        moduleName="Student Registry"
        recordCount={students.length}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}
