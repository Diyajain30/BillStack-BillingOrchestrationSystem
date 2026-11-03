import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';

import axios from 'axios';
import { backendApi } from '../services/api';

export default function PrincipalDashboard({ user }) {
  const navigate = useNavigate();

  const [masterEvent, setMasterEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Inspection Modal & Remarks State
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [principalRemark, setPrincipalRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingFolderId, setRejectingFolderId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("Amount doesn't match the bill");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, eventsRes, usersRes] = await Promise.all([
        backendApi.get('/bills').catch(() => axios.get('http://localhost:8080/api/bills').catch(() => ({ data: [] }))),
        backendApi.get('/events').catch(() => axios.get('http://localhost:8080/api/events').catch(() => ({ data: [] }))),
        backendApi.get('/users').catch(() => axios.get('http://localhost:8080/api/users').catch(() => ({ data: [] }))),
      ]);

      const allEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const foundMaster = allEvents.find((ev) => ev.parentEventId === null || ev.parentEventId === undefined);
      const foundSubs = allEvents.filter((ev) => ev.parentEventId !== null && ev.parentEventId !== undefined);

      setMasterEvent(foundMaster || null);
      setSubEvents(foundSubs.length > 0 ? foundSubs : allEvents);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (error) {
      console.error('Failed to sync principal dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Executive Sub-Event Folder PDF Report Generator
  const generateSubEventPdf = (sub) => {
    const doc = new jsPDF();
    const folderBills = bills.filter(
      (b) =>
        (b.subEventId && String(b.subEventId) === String(sub.id)) ||
        (b.eventName && b.eventName.toLowerCase().trim() === sub.name.toLowerCase().trim())
    );
    const subSpent = folderBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
    const assignedStudent = users.find((u) => u.id === Number(sub.studentCoordinatorId));
    const assignedFaculty = users.find((u) => u.id === Number(sub.facultyHeadId));

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PRINCIPAL SANCTION & AUDIT DOSSIER', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sub-Event: ${sub.name} | Department: ${sub.department} | ID: #${sub.id}`, 14, 28);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Leadership Assignment & Budget Summary', 14, 48);

    doc.autoTable({
      startY: 53,
      head: [['Sanctioned Budget Cap', 'Total Outflow Spent', 'Student Lead', 'Faculty Head']],
      body: [
        [
          `Rs. ${sub.budgetCap?.toLocaleString('en-IN')}`,
          `Rs. ${subSpent.toLocaleString('en-IN')}`,
          assignedStudent ? (assignedStudent.username || assignedStudent.name) : 'Unassigned',
          assignedFaculty ? (assignedFaculty.username || assignedFaculty.name) : 'Unassigned',
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
    });

    let currentY = doc.lastAutoTable.finalY + 15;
    doc.text('2. Itemized Expenditure Vouchers', 14, currentY);

    const bRows = folderBills.map((b) => [
      `#${b.billNo || b.id}`,
      b.vendorName || 'N/A',
      b.billDate || 'N/A',
      `Rs. ${Number(b.amount).toFixed(2)}`,
      b.status,
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Invoice No', 'Vendor Name', 'Date', 'Amount', 'Status']],
      body: bRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Principal_Audit_${sub.name.replace(/\s+/g, '_')}.pdf`);
  };

  // 2. Complete Master Executive Summary PDF
  const generateMasterExecutivePdf = () => {
    const doc = new jsPDF();
    const festName = masterEvent ? (masterEvent.name || masterEvent.wingName) : 'WINGS Fest Master Portfolio';

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE PRINCIPAL FEST AUDIT REPORT', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Master Event Container: ${festName} | Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Global Financial Overview', 14, 48);

    const totalBudget = masterEvent ? masterEvent.budgetCap : subEvents.reduce((acc, s) => acc + (Number(s.budgetCap) || 0), 0);
    const totalSpent = bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    doc.autoTable({
      startY: 53,
      head: [['Total Fest Sanction', 'Total Disbursed Outflow', 'Remaining Buffer', 'Active Sub-Events']],
      body: [
        [
          `Rs. ${totalBudget?.toLocaleString('en-IN')}`,
          `Rs. ${totalSpent.toLocaleString('en-IN')}`,
          `Rs. ${(totalBudget - totalSpent).toLocaleString('en-IN')}`,
          subEvents.length,
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
    });

    let currentY = doc.lastAutoTable.finalY + 15;
    doc.text('2. Sub-Events Department Breakdown', 14, currentY);

    const subRows = subEvents.map((s) => [
      `#${s.id}`,
      s.name,
      s.department,
      `Rs. ${s.budgetCap?.toLocaleString('en-IN')}`,
      s.status || 'OPEN',
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['ID', 'Sub-Event Name', 'Department', 'Budget Cap', 'Status']],
      body: subRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`${festName.replace(/\s+/g, '_')}_Executive_Summary.pdf`);
  };

  // 3. Approve Sub-Event Folder Status
  const handleApproveStatus = async (subEventId) => {
    setActionLoading(true);
    try {
      await backendApi
        .put(`/events/${subEventId}`, {
          status: 'APPROVED',
          description: principalRemark ? `Principal remark: ${principalRemark}` : undefined,
        })
        .catch(() =>
          axios.put(`http://localhost:8080/api/events/${subEventId}`, {
            status: 'APPROVED',
            description: principalRemark ? `Principal remark: ${principalRemark}` : undefined,
          })
        );

      alert('Sub-Event Folder status updated to "APPROVED" successfully!');
      setSelectedFolder(null);
      setPrincipalRemark('');
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update event status.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Trigger Rejection Modal
  const handleOpenRejectModal = (subEventId) => {
    setRejectingFolderId(subEventId);
    setShowRejectModal(true);
  };

  // 5. Confirm Rejection with Reason and Role
  const handleConfirmReject = async () => {
    if (!rejectingFolderId) return;
    setActionLoading(true);
    try {
      await backendApi
        .put(`/events/${rejectingFolderId}`, {
          status: 'REJECTED',
          description: `Rejected by PRINCIPAL. Reason: ${rejectionReason}${principalRemark ? ' | Note: ' + principalRemark : ''}`,
        })
        .catch(() =>
          axios.put(`http://localhost:8080/api/events/${rejectingFolderId}`, {
            status: 'REJECTED',
            description: `Rejected by PRINCIPAL. Reason: ${rejectionReason}${principalRemark ? ' | Note: ' + principalRemark : ''}`,
          })
        );

      alert('Sub-Event Folder rejected successfully and returned for correction!');
      setShowRejectModal(false);
      setRejectingFolderId(null);
      setSelectedFolder(null);
      setPrincipalRemark('');
      setRejectionReason("Amount doesn't match the bill");
      fetchData();
    } catch (err) {
      console.error('Failed to reject folder:', err);
      alert('Failed to record rejection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Statistical Computations
  const totalFestBudget = masterEvent ? masterEvent.budgetCap : subEvents.reduce((acc, s) => acc + (Number(s.budgetCap) || 0), 0);
  const totalAuditedSpent = bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const utilizationPercentage = totalFestBudget > 0 ? Math.min(100, Math.round((totalAuditedSpent / totalFestBudget) * 100)) : 0;
  const pendingCount = subEvents.filter((s) => !s.status || s.status === 'OPEN' || s.status === 'PENDING_PRINCIPAL').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
              🎓
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-violet-400">BillStack</span>
              <span className="block bg-violet-950 border border-violet-800 text-violet-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                Principal Portal
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            <div className="px-4 py-3 bg-violet-950/60 border border-violet-800/80 rounded-xl text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>📊</span> Executive Overview
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-violet-300 font-extrabold">
                {subEvents.length}
              </span>
            </div>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-sm font-bold text-white">
              {user?.name ? user.name[0].toUpperCase() : 'P'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-200">{user?.name || 'Principal'}</p>
              <p className="text-[10px] text-slate-400 truncate">INSTITUTIONAL HEAD</p>
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
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl space-y-6">
        
        {/* Header Banner */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Principal Executive Dashboard</h1>
            <p className="text-xs text-slate-400 mt-1">
              Statistical oversight of institutional event portfolios, budget burn rates, and final administrative approval sanctions.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateMasterExecutivePdf}
              className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-2"
            >
              🖨️ Download Executive Summary (PDF)
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 shadow-sm transition"
            >
              ↻ Sync
            </button>
          </div>
        </header>

        {/* Statistical Overview Cards */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fest Allocation</span>
            <h2 className="text-2xl font-black text-white">₹{totalFestBudget.toLocaleString('en-IN')}</h2>
            <p className="text-[11px] text-slate-400">{subEvents.length} Department Folders</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Audited Outflow</span>
            <h2 className="text-2xl font-black text-emerald-400">₹{totalAuditedSpent.toLocaleString('en-IN')}</h2>
            <p className="text-[11px] text-slate-400">Across verified invoices</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Budget Burn Rate</span>
            <h2 className="text-2xl font-black text-violet-400">{utilizationPercentage}%</h2>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full ${utilizationPercentage > 85 ? 'bg-rose-500' : 'bg-violet-500'}`}
                style={{ width: `${utilizationPercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Sanctions</span>
            <h2 className="text-2xl font-black text-amber-400">{pendingCount}</h2>
            <p className="text-[11px] text-slate-400">Requires executive review</p>
          </div>
        </section>

        {/* Sub-Event Folders & Approval Queue */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>📁</span> Event Folders & Approval Queue ({subEvents.length})
            </h2>
            <span className="text-xs text-slate-400">Click any card to inspect folder contents and grant approval</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400">Loading institutional portfolios...</div>
          ) : subEvents.length === 0 ? (
            <div className="p-12 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No sub-event folders found under the master container.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {subEvents.map((evt) => {
                const folderBills = bills.filter(
                  (b) =>
                    (b.subEventId && String(b.subEventId) === String(evt.id)) ||
                    (b.eventName && b.eventName.toLowerCase().trim() === evt.name.toLowerCase().trim())
                );
                const subSpent = folderBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                const subCap = evt.budgetCap || 1;
                const subUtil = Math.min(100, Math.round((subSpent / subCap) * 100));

                return (
                  <div
                    key={evt.id}
                    className="bg-slate-800/60 border border-slate-700/80 hover:border-violet-500 rounded-2xl p-5 space-y-4 transition shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedFolder(evt)} className="cursor-pointer space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800">
                          {evt.department}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            evt.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : evt.status === 'REJECTED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {evt.status || 'PENDING'}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white">📁 {evt.name}</h3>
                        <span className="text-[11px] font-mono text-slate-400">Sub-Event ID: #{evt.id}</span>
                      </div>
                    </div>

                    <div onClick={() => setSelectedFolder(evt)} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs cursor-pointer">
                      <div className="flex justify-between text-slate-400">
                        <span>Sanctioned Budget:</span>
                        <span className="font-bold text-slate-200">₹{evt.budgetCap?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Audited Spent:</span>
                        <span className="font-bold text-emerald-400">₹{subSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Utilization ({subUtil}%)</span>
                          <span>{folderBills.length} Vouchers</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${subUtil > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${subUtil}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center text-xs">
                      <button
                        onClick={() => generateSubEventPdf(evt)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                      >
                        🖨️ PDF
                      </button>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenRejectModal(evt.id)}
                          className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-lg text-[10px] font-bold transition"
                        >
                          ✕ Reject
                        </button>
                        <button
                          onClick={() => handleApproveStatus(evt.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition"
                        >
                          ✓ Approve
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FOLDER INSPECTION & APPROVAL MODAL */}
        {selectedFolder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto text-slate-100">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📁</span>
                    <h3 className="text-xl font-black text-white">{selectedFolder.name}</h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-violet-950 text-violet-300 border border-violet-800 rounded-md">
                      {selectedFolder.department}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Lifecycle Status: <strong className="text-emerald-400">{selectedFolder.status || 'PENDING'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => generateSubEventPdf(selectedFolder)}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    🖨️ Print Dossier PDF
                  </button>
                  <button onClick={() => setSelectedFolder(null)} className="text-slate-400 hover:text-white text-2xl font-bold">✕</button>
                </div>
              </div>

              {/* Folder Financial Metrics */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Sanctioned Budget Cap</span>
                  <span className="text-base font-black text-white">₹{selectedFolder.budgetCap?.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Outflow Spent</span>
                  <span className="text-base font-black text-emerald-400">
                    ₹{bills
                      .filter(
                        (b) =>
                          (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) ||
                          (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())
                      )
                      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
                      .toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Net Buffer Balance</span>
                  <span className="text-base font-black text-violet-400">
                    ₹{(
                      selectedFolder.budgetCap -
                      bills
                        .filter(
                          (b) =>
                            (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) ||
                            (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())
                        )
                        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
                    ).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Vouchers Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📑</span> Itemized Vouchers in this Folder
                </h4>

                {bills.filter(
                  (b) =>
                    (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) ||
                    (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())
                ).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-xs">
                    No vouchers uploaded to this folder yet.
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {bills
                          .filter(
                            (b) =>
                              (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) ||
                              (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())
                          )
                          .map((b) => (
                            <tr key={b.id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-mono text-violet-300 font-bold">#{b.billNo || b.id}</td>
                              <td className="py-2.5 px-3 font-semibold text-white">{b.vendorName}</td>
                              <td className="py-2.5 px-3 font-black text-white">₹{Number(b.amount).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-slate-400">{b.billDate || 'N/A'}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Principal Sanction Actions */}
              <div className="pt-4 border-t border-slate-800 space-y-3 bg-slate-950/60 p-4 rounded-xl border">
                <h4 className="text-xs font-black uppercase text-violet-400">Principal Executive Sanction Authorization</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Executive Remark / Feedback:</label>
                  <textarea
                    rows={2}
                    value={principalRemark}
                    onChange={(e) => setPrincipalRemark(e.target.value)}
                    placeholder="e.g., Reviewed itemized expenses; sanctioned for final storekeeper registry."
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-violet-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={() => handleOpenRejectModal(selectedFolder.id)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-xl text-xs font-bold transition"
                  >
                    {actionLoading ? 'Processing...' : '✕ Reject Folder Sanction'}
                  </button>
                  <button
                    onClick={() => handleApproveStatus(selectedFolder.id)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {actionLoading ? 'Processing...' : '✓ Approve & Sanction Folder'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ─── MANDATORY REJECTION MODAL ─── */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 text-slate-100">
              <h3 className="text-lg font-black text-white">Mandatory Rejection Feedback</h3>
              <p className="text-xs text-slate-400">
                Specify why this sub-event folder / sanction is being rejected and returned for correction.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Reason for rejection:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium outline-none focus:border-violet-500"
                >
                  <option value="Amount doesn't match the bill">Amount doesn't match the bill</option>
                  <option value="Missing or unreadable receipt image">Missing or unreadable receipt image</option>
                  <option value="Unapproved vendor / Event out-of-scope">Unapproved vendor / Event out-of-scope</option>
                  <option value="Sub-event budget allocation exceeded">Sub-event budget allocation exceeded</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Additional Remark (Optional):
                </label>
                <textarea
                  rows={2}
                  value={principalRemark}
                  onChange={(e) => setPrincipalRemark(e.target.value)}
                  placeholder="Add specific notes for correction..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingFolderId(null);
                  }}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}