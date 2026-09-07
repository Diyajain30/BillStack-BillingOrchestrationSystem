import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import axios from 'axios';
import { backendApi } from '../services/api';

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();

  // Role Normalization
  const normalizedRole = (user?.role || '').toUpperCase();
  const isStorekeeper = normalizedRole === 'STOREKEEPER' || normalizedRole === 'STORE';
  const roleTitle = isStorekeeper ? 'Storekeeper Verification Desk' : 'Executive Sanctioning Portal (Principal)';

  // Tabs & Navigation
  const [activeTab, setActiveTab] = useState('Folders'); // 'Folders', 'Queue', 'Ledger'
  const [bills, setBills] = useState([]);
  const [subEvents, setSubEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Folder View State
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Filter & Search States
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Action State
  const [selectedBill, setSelectedBill] = useState(null);
  const [auditRemark, setAuditRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Budget quota exceeded');
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch live bills and sub-event folders from Spring Boot
  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, eventsRes] = await Promise.all([
        backendApi.get('/bills').catch(() => ({ data: [] })),
        axios.get('http://localhost:8080/api/subevents').catch(() => ({ data: [] })),
      ]);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      setSubEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } catch (error) {
      console.error('Failed to sync data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Open Sub-Event Folder & retrieve assigned faculty/coordinators
  const openFolderDetails = async (subEventId) => {
    setLoadingFolder(true);
    try {
      const res = await axios.get(`http://localhost:8080/api/subevents/${subEventId}`);
      setSelectedFolder(res.data);
    } catch (err) {
      alert('Failed to load sub-event folder particulars');
    } finally {
      setLoadingFolder(false);
    }
  };

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setAuditRemark('');
  };

  // PRINCIPAL APPROVAL: PENDING_PRINCIPAL -> PENDING_STOREKEEPER
  const handlePrincipalApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'PENDING_STOREKEEPER',
        remark: auditRemark || 'Executive financial sanction granted by Principal. Forwarded to Storekeeper.',
      });
      alert(`Bill #${selectedBill.billNo} sanctioned and forwarded to Storekeeper for ledger logging!`);
      closeModals();
      fetchData();
      if (selectedFolder) openFolderDetails(selectedFolder.id);
    } catch (error) {
      console.error('Principal sanction failed:', error);
      alert(error.response?.data?.message || 'Failed to sanction bill.');
    } finally {
      setActionLoading(false);
    }
  };

  // STOREKEEPER APPROVAL: PENDING_STOREKEEPER -> APPROVED
  const handleStorekeeperApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'APPROVED',
        remark: auditRemark || 'Physical inventory verified and logged in store register book.',
      });
      alert(`Bill #${selectedBill.billNo} recorded in stock book and granted FINAL APPROVAL!`);
      closeModals();
      fetchData();
      if (selectedFolder) openFolderDetails(selectedFolder.id);
    } catch (error) {
      console.error('Storekeeper logging failed:', error);
      alert(error.response?.data?.message || 'Failed to record bill.');
    } finally {
      setActionLoading(false);
    }
  };

  // REJECTION HANDLER (Returns bill to Coordinator)
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        remark: auditRemark,
        rejectionReason: rejectionReason,
      });
      alert(`Bill #${selectedBill.billNo} disapproved and kicked back to Event Coordinator.`);
      closeModals();
      fetchData();
      if (selectedFolder) openFolderDetails(selectedFolder.id);
    } catch (error) {
      console.error('Rejection failed:', error);
      alert(error.response?.data?.message || 'Failed to record rejection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Duplex Audit Voucher PDF Generator
  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GOVERNMENT COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text('WINGS TECHNICAL FEST - AUDIT CERTIFICATION', 105, 28, { align: 'center' });
    doc.line(15, 32, 195, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Voucher ID: BS-AUD-${bill.id}`, 16, 42);
    doc.text(`Invoice No: ${bill.billNo || 'N/A'}`, 130, 42);
    doc.text(`Vendor: ${bill.vendorName}`, 16, 50);
    doc.text(`Date: ${bill.billDate || 'N/A'}`, 130, 50);
    doc.text(`Event Folder: ${bill.eventName || 'Wings Fest'}`, 16, 58);
    doc.text(`Workflow Stage: ${bill.status}`, 130, 58);

    doc.rect(15, 66, 180, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL AUDIT PARTICULARS', 20, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(`Taxable Base: Rs. ${Number(bill.baseAmount || bill.amount).toFixed(2)}`, 20, 84);
    doc.text(`Tax (CGST+SGST): Rs. ${(Number(bill.cgst || 0) + Number(bill.sgst || 0)).toFixed(2)}`, 110, 84);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total Amount: Rs. ${Number(bill.amount).toFixed(2)}`, 20, 96);
    doc.text(`Cumulative Spend Position: Rs. ${(bill.runningTotal || bill.amount).toFixed(2)}`, 110, 96);

    doc.save(`Certified_Voucher_${bill.billNo || bill.id}.pdf`);
  };

  // Metric Computations
  const totalFestBudget = subEvents.reduce((acc, s) => acc + (Number(s.budgetCap) || 0), 0);
  const totalFestAdvance = subEvents.reduce((acc, s) => acc + (Number(s.advanceDisbursed) || 0), 0);
  const totalSanctionedOutflow = bills
    .filter((b) => b.status === 'APPROVED' || b.status === 'PENDING_STOREKEEPER')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Queue separation
  const pendingPrincipalBills = bills.filter((b) => b.status === 'PENDING_PRINCIPAL');
  const pendingStorekeeperBills = bills.filter((b) => b.status === 'PENDING_STOREKEEPER');
  const activeQueueBills = isStorekeeper ? pendingStorekeeperBills : pendingPrincipalBills;

  // Filtered Master Bills
  const filteredMasterBills = bills.filter((b) => {
    const matchesStatus = statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch =
      b.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.billNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.eventName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Folder-Scoped Bills
  const folderBills = selectedFolder
    ? bills.filter(
        (b) =>
          (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) ||
          (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
              B
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-indigo-400">BillStack</span>
              <span className="block bg-indigo-900/60 border border-indigo-700 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                {isStorekeeper ? 'Storekeeper' : 'Principal'}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            <button
              onClick={() => setActiveTab('Folders')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'Folders' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>📁</span> Sub-Event Folders
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-extrabold">
                {subEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Queue')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'Queue' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>⚡</span> {isStorekeeper ? 'Storekeeper Queue' : 'Principal Queue'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeQueueBills.length > 0 ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {activeQueueBills.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Ledger')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'Ledger' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>📑</span> Master Bills Ledger
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-extrabold">
                {bills.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-bold text-white">
              {user?.name ? user.name[0].toUpperCase() : 'P'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-200">{user?.name || 'Dr. Principal'}</p>
              <p className="text-[10px] text-slate-400 truncate">{isStorekeeper ? 'STOREKEEPER' : 'PRINCIPAL'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{roleTitle}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isStorekeeper
                ? 'Review Principal-sanctioned bills, enter stock book records, and grant final sign-off.'
                : 'Sub-event folder auditing: Grant executive financial sanction or return bills with feedback.'}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 shadow-sm transition"
          >
            ↻ Sync Live Database
          </button>
        </header>

        {/* 4 Real-Time Executive Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fest Budget</p>
            <p className="text-2xl font-black text-white mt-1">₹{totalFestBudget.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 mt-1">{subEvents.length} Active Sub-Events</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advances Disbursed</p>
            <p className="text-2xl font-black text-amber-400 mt-1">₹{totalFestAdvance.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 mt-1">Physical cash handed out</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isStorekeeper ? 'Storekeeper Queue' : 'Pending Sanction'}
            </p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{activeQueueBills.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting your authorization</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sanctioned Outflow</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">₹{totalSanctionedOutflow.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 mt-1">Approved against fest allocation</p>
          </div>
        </section>

        {/* ─── TAB 1: SUB-EVENT FOLDERS (PRINCIPAL CONTEXTUAL AUDIT) ─── */}
        {activeTab === 'Folders' && (
          <section className="mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <span>📁</span> Sub-Event Folders & Budgets ({subEvents.length})
                </h2>
                <p className="text-xs text-slate-400">Click any folder to inspect its assigned faculty heads, spending, and bill queue.</p>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">Loading sub-event folders...</div>
            ) : subEvents.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                No sub-events found. They must be provisioned by the Student Head.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {subEvents.map((evt) => {
                  const pendingCountInEvent = bills.filter(
                    (b) =>
                      b.status === 'PENDING_PRINCIPAL' &&
                      ((b.subEventId && String(b.subEventId) === String(evt.id)) ||
                        (b.eventName && b.eventName.toLowerCase().trim() === evt.name.toLowerCase().trim()))
                  ).length;
                  const remaining = (evt.budgetCap || 0) - (evt.totalSpent || 0);

                  return (
                    <div
                      key={evt.id}
                      onClick={() => openFolderDetails(evt.id)}
                      className="bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500 rounded-2xl p-5 space-y-4 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {evt.department}
                          </span>
                          {pendingCountInEvent > 0 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 animate-pulse">
                              {pendingCountInEvent} to sanction
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <span>📁</span> {evt.name}
                        </h3>
                        {evt.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{evt.description}</p>
                        )}
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Budget Cap:</span>
                          <span className="font-bold text-slate-200">₹{evt.budgetCap?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Advance Given:</span>
                          <span className="font-bold text-amber-400">₹{evt.advanceDisbursed?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Spent to Date:</span>
                          <span className="font-bold text-indigo-400">₹{evt.totalSpent?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400">Remaining Balance:</span>
                          <span className={`font-bold ${remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ₹{remaining.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center text-xs">
                        <span className="text-slate-400 text-[11px]">Lifecycle: <strong>{evt.status}</strong></span>
                        <span className="text-indigo-400 font-bold hover:underline">Open Folder →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── TAB 2: ACTIVE AUTHORIZATION QUEUE ─── */}
        {activeTab === 'Queue' && (
          <section className="mt-8 space-y-4">
            <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
              <span>⚡</span> Pending Sanction Queue ({activeQueueBills.length})
            </h2>

            {loading ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">Loading queue...</div>
            ) : activeQueueBills.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                ✓ No bills currently pending at this review gate.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeQueueBills.map((bill) => (
                  <div key={bill.id} className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-white block">{bill.vendorName}</span>
                        <span className="text-[11px] font-mono text-indigo-400">Invoice #{bill.billNo}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{bill.eventName} • {bill.billDate}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-white block">₹{Number(bill.amount).toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">
                          Running Total: ₹{(bill.runningTotal || bill.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl text-xs space-y-1 text-slate-300">
                      <p><strong className="text-slate-400">GSTIN:</strong> {bill.vendorGstin || 'Unregistered'}</p>
                      <p><strong className="text-slate-400">Audit Notes:</strong> {bill.description || 'Verified by Faculty'}</p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-700/60">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        {isStorekeeper ? 'Record in Stock Register' : 'Review & Sanction'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBill(bill);
                          setShowRejectModal(true);
                        }}
                        className="px-3 py-2 bg-rose-900/40 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 rounded-xl text-xs font-bold transition"
                      >
                        Disapprove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── TAB 3: MASTER BILLS LEDGER ─── */}
        {activeTab === 'Ledger' && (
          <section className="mt-8 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-base font-black text-slate-100">Master Financial Record Ledger</h2>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search vendor, bill ID, or event..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 w-full md:w-64 outline-none"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="PENDING_FACULTY">Faculty Review</option>
                  <option value="PENDING_PRINCIPAL">Principal Sanction</option>
                  <option value="PENDING_STOREKEEPER">Storekeeper Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Invoice No</th>
                    <th className="py-3.5 px-4">Vendor & Event</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Running Total</th>
                    <th className="py-3.5 px-4">Conveyor Status</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                  {filteredMasterBills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">#{b.billNo || b.id}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block">{b.vendorName}</span>
                        <span className="text-[10px] text-slate-400">{b.eventName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-white">₹{Number(b.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-bold text-indigo-400">₹{Number(b.runningTotal || b.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          b.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          b.status === 'REJECTED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          b.status === 'PENDING_PRINCIPAL' ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' :
                          'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => generateVoucherPdf(b)}
                          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] font-bold transition shadow-sm"
                        >
                          🖨️ PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── MODAL 1: SUB-EVENT FOLDER INSPECTOR (SHOWS ASSIGNED FACULTY & DETAILS) ─── */}
        {selectedFolder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📁</span>
                    <h3 className="text-xl font-black text-white">{selectedFolder.name}</h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md">
                      {selectedFolder.department}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Fest: <strong>{selectedFolder.festName}</strong> • Lifecycle Status: <strong className="text-emerald-400">{selectedFolder.status}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="text-slate-400 hover:text-white text-2xl font-bold px-2"
                >
                  ✕
                </button>
              </div>

              {/* Sub-Event Ledger Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Sanctioned Budget</span>
                  <span className="text-base font-black text-white">₹{selectedFolder.budgetCap?.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Cash Advance</span>
                  <span className="text-base font-black text-amber-400">₹{selectedFolder.advanceDisbursed?.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Spent</span>
                  <span className="text-base font-black text-indigo-400">₹{selectedFolder.totalSpent?.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Remaining Balance</span>
                  <span className="text-base font-black text-emerald-400">
                    ₹{(selectedFolder.budgetCap - selectedFolder.totalSpent)?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Personnel Assignment Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Description / Scope</span>
                  <p className="text-slate-300 font-medium">{selectedFolder.description || 'No specific description provided.'}</p>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Assigned Faculty Head(s):</span>
                    <p className="text-indigo-300 font-bold mt-0.5">
                      {selectedFolder.facultyHeads && selectedFolder.facultyHeads.length > 0
                        ? selectedFolder.facultyHeads.map((f) => `${f.name} (${f.institutionalId})`).join(', ')
                        : 'Not allotted yet'}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Assigned Student Coordinator(s):</span>
                    <p className="text-slate-200 font-bold mt-0.5">
                      {selectedFolder.coordinators && selectedFolder.coordinators.length > 0
                        ? selectedFolder.coordinators.map((c) => `${c.name} (${c.institutionalId})`).join(', ')
                        : 'Not allotted yet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bills Under This Folder */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📑</span> Bills Uploaded to this Folder ({folderBills.length})
                </h4>

                {folderBills.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-xs">
                    No bills recorded for this event folder yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Invoice No</th>
                          <th className="py-2.5 px-3">Vendor</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {folderBills.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono text-indigo-300 font-bold">#{b.billNo}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{b.vendorName}</td>
                            <td className="py-2.5 px-3 font-black text-white">₹{Number(b.amount).toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-400">{b.billDate}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.status === 'PENDING_PRINCIPAL' ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' :
                                b.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                b.status === 'REJECTED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {b.status === 'PENDING_PRINCIPAL' && !isStorekeeper ? (
                                <button
                                  onClick={() => setSelectedBill(b)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm"
                                >
                                  Sanction
                                </button>
                              ) : (
                                <button
                                  onClick={() => generateVoucherPdf(b)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                                >
                                  PDF
                                </button>
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
          </div>
        )}

        {/* ─── MODAL 2: PRINCIPAL SANCTION & AUDIT REMARK MODAL ─── */}
        {selectedBill && !showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isStorekeeper ? 'Storekeeper Verification Gate' : 'Principal Executive Sanction Gate'}
                  </h3>
                  <p className="text-xs text-slate-400">Review invoice particulars before advancing on conveyor belt</p>
                </div>
                <button onClick={closeModals} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Vendor</span>
                  <p className="font-bold text-white">{selectedBill.vendorName}</p>
                  <p className="text-slate-400 font-mono text-[10px]">GSTIN: {selectedBill.vendorGstin}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Invoice Ref</span>
                  <p className="font-bold text-white">{selectedBill.billNo}</p>
                  <p className="text-slate-400 text-[10px]">Date: {selectedBill.billDate}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Amount</span>
                  <p className="text-lg font-black text-emerald-400">₹{Number(selectedBill.amount).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Folder Running Spend</span>
                  <p className="text-lg font-black text-indigo-400">
                    ₹{Number(selectedBill.runningTotal || selectedBill.amount).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  {isStorekeeper ? 'Stock Register / Store Ledger Note:' : 'Principal Executive Sanction Remark:'}
                </label>
                <textarea
                  rows={2}
                  value={auditRemark}
                  onChange={(e) => setAuditRemark(e.target.value)}
                  placeholder={
                    isStorekeeper
                      ? 'e.g., Logged in Store Register Book Vol 2, Page 14.'
                      : 'e.g., Sanctioned under Wings Annual Operating Budget.'
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-xl text-xs font-bold"
                >
                  Disapprove
                </button>
                <button
                  onClick={isStorekeeper ? handleStorekeeperApprove : handlePrincipalApprove}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {actionLoading
                    ? 'Processing...'
                    : isStorekeeper
                    ? '✓ Log in Register & Grant Final Approval'
                    : '✓ Grant Sanction & Forward to Storekeeper'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: REJECTION MODAL ─── */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Disapproval & Return Loop</h3>
              <p className="text-xs text-slate-400">Specify why Bill #{selectedBill?.billNo} is being kicked back to the Coordinator.</p>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Reason:</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium outline-none"
                >
                  <option value="Budget quota exceeded">Budget quota exceeded</option>
                  <option value="Missing physical receipt in department store">Missing physical receipt in department store</option>
                  <option value="Discrepancy in recorded ledger items">Discrepancy in recorded ledger items</option>
                  <option value="Incomplete vendor tax credentials">Incomplete vendor tax credentials</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800">
                  Back
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Disapproval'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}