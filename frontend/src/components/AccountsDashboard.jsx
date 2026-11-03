import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';

import axios from 'axios';
import { backendApi } from '../services/api';

export default function AccountsDashboard({ user }) {
  const navigate = useNavigate();

  const [masterEvent, setMasterEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Folder View & Action State
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [accountRemark, setAccountRemark] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, eventsRes] = await Promise.all([
        backendApi.get('/bills').catch(() => axios.get('http://localhost:8080/api/bills').catch(() => ({ data: [] }))),
        backendApi.get('/events').catch(() => axios.get('http://localhost:8080/api/events').catch(() => ({ data: [] }))),
      ]);

      const allEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
      const foundMaster = allEvents.find((ev) => ev.parentEventId === null || ev.parentEventId === undefined);
      const foundSubs = allEvents.filter((ev) => ev.parentEventId !== null && ev.parentEventId !== undefined);

      setMasterEvent(foundMaster || null);
      setSubEvents(foundSubs.length > 0 ? foundSubs : allEvents);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (error) {
      console.error('Failed to sync accounts data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Single Sub-Event Folder PDF Generator
  const generateSubEventPdf = (sub) => {
    const doc = new jsPDF();
    const folderBills = bills.filter(
      (b) =>
        (b.subEventId && String(b.subEventId) === String(sub.id)) ||
        (b.eventName && b.eventName.toLowerCase().trim() === sub.name.toLowerCase().trim())
    );
    const subSpent = folderBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNTS SECTION - SUB-EVENT FINANCIAL FOLDER', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sub-Event: ${sub.name} (${sub.department}) | ID: #${sub.id}`, 14, 27);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Folder Allocation & Expenditure Summary', 14, 45);

    doc.autoTable({
      startY: 50,
      head: [['Department Scope', 'Allocated Budget Cap', 'Total Outflow Spent', 'Net Balance']],
      body: [
        [
          sub.department,
          `Rs. ${sub.budgetCap?.toLocaleString('en-IN')}`,
          `Rs. ${subSpent.toLocaleString('en-IN')}`,
          `Rs. ${(sub.budgetCap - subSpent).toLocaleString('en-IN')}`
        ]
      ],
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] }
    });

    let currentY = doc.lastAutoTable.finalY + 15;
    doc.text('2. Itemized Bills & Vouchers Ledger', 14, currentY);

    const bRows = folderBills.map((b) => [
      `#${b.billNo || b.id}`,
      b.vendorName || 'N/A',
      b.billDate || 'N/A',
      `Rs. ${Number(b.amount).toFixed(2)}`,
      b.status
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Invoice No', 'Vendor Name', 'Bill Date', 'Amount', 'Audit Status']],
      body: bRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    });

    doc.save(`Accounts_Folder_${sub.name.replace(/\s+/g, '_')}.pdf`);
  };

  // 2. Complete Master Event Portfolio PDF Generator (All Sub-Event Folders & Bills)
  const generateMasterEventPdf = () => {
    const doc = new jsPDF();
    const festName = masterEvent ? (masterEvent.name || masterEvent.wingName) : 'WINGS Fest Master Portfolio';

    doc.setFillColor(15, 23, 42); // Dark Slate
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ACCOUNTS DISBURSEMENT MASTER LEDGER', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Master Event: ${festName} | Date: ${new Date().toLocaleDateString()}`, 14, 27);

    // Master Overview
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Master Event Allocation', 14, 45);

    const totalBudget = masterEvent ? masterEvent.budgetCap : subEvents.reduce((acc, s) => acc + (Number(s.budgetCap) || 0), 0);
    const totalSpent = bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    doc.autoTable({
      startY: 50,
      head: [['Master Title', 'Sanctioned Fest Budget', 'Total Audited Outflow', 'Lifecycle Status']],
      body: [[festName, `Rs. ${totalBudget?.toLocaleString('en-IN')}`, `Rs. ${totalSpent.toLocaleString('en-IN')}`, masterEvent?.status || 'ACTIVE']],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });

    // Sub-Events Breakdown
    let currentY = doc.lastAutoTable.finalY + 15;
    doc.text('2. Nested Sub-Event Folders', 14, currentY);

    const subRows = subEvents.map((s) => [
      `#${s.id}`,
      s.name,
      s.department,
      `Rs. ${s.budgetCap?.toLocaleString('en-IN')}`,
      `Rs. ${s.totalSpent?.toLocaleString('en-IN') || 0}`
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Folder ID', 'Sub-Event Name', 'Department', 'Budget Cap', 'Spent Total']],
      body: subRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }
    });

    // All Bills Ledger
    currentY = doc.lastAutoTable.finalY + 15;
    doc.text('3. Master Bills & Vouchers Audit Register', 14, currentY);

    const billRows = bills.map((b) => [
      `#${b.billNo || b.id}`,
      b.vendorName || 'N/A',
      b.eventName || 'General',
      `Rs. ${Number(b.amount).toFixed(2)}`,
      b.status
    ]);

    doc.autoTable({
      startY: currentY + 5,
      head: [['Invoice No', 'Vendor Name', 'Sub-Event', 'Amount', 'Status']],
      body: billRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`${festName.replace(/\s+/g, '_')}_Complete_Accounts_Ledger.pdf`);
  };

  // 3. Approve or Reject Sub-Event Folder Status
  const handleUpdateFolderStatus = async (subEventId, newStatus) => {
    setActionLoading(true);
    try {
      await backendApi.put(`/events/${subEventId}`, {
        status: newStatus,
        description: accountRemark ? `Accounts note: ${accountRemark}` : undefined
      }).catch(() => 
        axios.put(`http://localhost:8080/api/events/${subEventId}`, {
          status: newStatus,
          description: accountRemark ? `Accounts note: ${accountRemark}` : undefined
        })
      );

      alert(`Sub-Event Folder status updated to "${newStatus}"!`);
      setSelectedFolder(null);
      setAccountRemark('');
      fetchData();
    } catch (err) {
      console.error('Failed to update folder status:', err);
      alert('Failed to update folder status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Metric Computations
  const totalFestBudget = masterEvent ? masterEvent.budgetCap : subEvents.reduce((acc, s) => acc + (Number(s.budgetCap) || 0), 0);
  const totalAuditedSpent = bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
              ₹
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-emerald-400">BillStack</span>
              <span className="block bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                Accounts Portal
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            <div className="px-4 py-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>📁</span> Event Folders
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 font-extrabold">
                {subEvents.length}
              </span>
            </div>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-bold text-white">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-200">{user?.name || 'Accounts Officer'}</p>
              <p className="text-[10px] text-slate-400 truncate">FINANCE & ACCOUNTS</p>
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
            <h1 className="text-2xl font-black text-white tracking-tight">Accounts Section Financial Portal</h1>
            <p className="text-xs text-slate-400 mt-1">
              Inspect event folders, review itemized bills, download folder PDFs, and grant final financial settlement authorization.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateMasterEventPdf}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-2"
            >
              🖨️ Download Master Event Ledger (PDF)
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 shadow-sm transition"
            >
              ↻ Sync
            </button>
          </div>
        </header>

        {/* Metric Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sanctioned Fest Allocation</span>
            <h2 className="text-3xl font-black text-white mt-1">₹{totalFestBudget.toLocaleString('en-IN')}</h2>
            <p className="text-xs text-slate-400 mt-1">{subEvents.length} Department Sub-Events</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Audited Expenditure</span>
            <h2 className="text-3xl font-black text-emerald-400 mt-1">₹{totalAuditedSpent.toLocaleString('en-IN')}</h2>
            <p className="text-xs text-slate-400 mt-1">Drawn across all event vouchers</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Master Event Title</span>
            <h2 className="text-xl font-black text-violet-400 mt-1 truncate">
              {masterEvent ? (masterEvent.name || masterEvent.wingName) : 'WINGS 2026'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Lifecycle: {masterEvent?.status || 'ACTIVE'}</p>
          </div>
        </section>

        {/* Sub-Event Folders Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>📁</span> Department Sub-Event Folders ({subEvents.length})
            </h2>
            <span className="text-xs text-slate-400">Click any folder card to view bills and sanction approval/rejection</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400">Syncing event folders...</div>
          ) : subEvents.length === 0 ? (
            <div className="p-12 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No active sub-event folders available.
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

                return (
                  <div
                    key={evt.id}
                    className="bg-slate-800/60 border border-slate-700/80 hover:border-emerald-500 rounded-2xl p-5 space-y-4 transition shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedFolder(evt)} className="cursor-pointer space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {evt.department}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          evt.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          evt.status === 'REJECTED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {evt.status || 'OPEN'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>📁</span> {evt.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400">Sub-Event ID: #{evt.id}</p>
                    </div>

                    <div onClick={() => setSelectedFolder(evt)} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs cursor-pointer">
                      <div className="flex justify-between text-slate-400">
                        <span>Sanctioned Cap:</span>
                        <span className="font-bold text-slate-200">₹{evt.budgetCap?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Spent:</span>
                        <span className="font-bold text-emerald-400">₹{subSpent.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                        <span>Vouchers Uploaded:</span>
                        <span className="font-bold text-violet-400">{folderBills.length}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center text-xs">
                      <button
                        onClick={() => generateSubEventPdf(evt)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                      >
                        🖨️ Folder PDF
                      </button>
                      <span onClick={() => setSelectedFolder(evt)} className="text-emerald-400 font-bold hover:underline cursor-pointer">
                        Inspect & Review →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FOLDER INSPECTION & APPROVAL/REJECTION MODAL */}
        {selectedFolder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto text-slate-100">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📁</span>
                    <h3 className="text-xl font-black text-white">{selectedFolder.name}</h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md">
                      {selectedFolder.department}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Current Audit Status: <strong className="text-emerald-400">{selectedFolder.status || 'OPEN'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => generateSubEventPdf(selectedFolder)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    🖨️ Print Folder PDF
                  </button>
                  <button onClick={() => setSelectedFolder(null)} className="text-slate-400 hover:text-white text-2xl font-bold">✕</button>
                </div>
              </div>

              {/* Folder Spending Position */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Sanctioned Budget</span>
                  <span className="text-base font-black text-white">₹{selectedFolder.budgetCap?.toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Outflow Spent</span>
                  <span className="text-base font-black text-emerald-400">
                    ₹{bills
                      .filter(b => (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) || (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim()))
                      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
                      .toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Net Balance</span>
                  <span className="text-base font-black text-violet-400">
                    ₹{(selectedFolder.budgetCap - bills
                      .filter(b => (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) || (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim()))
                      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Bills Table inside Folder */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📑</span> Invoices & Vouchers in this Folder
                </h4>

                {bills.filter(b => (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) || (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim())).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-xs">
                    No bills uploaded to this folder yet.
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
                          .filter(b => (b.subEventId && String(b.subEventId) === String(selectedFolder.id)) || (b.eventName && b.eventName.toLowerCase().trim() === selectedFolder.name.toLowerCase().trim()))
                          .map((b) => (
                            <tr key={b.id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-mono text-emerald-300 font-bold">#{b.billNo || b.id}</td>
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

              {/* Accounts Action & Remark Section at the bottom of the folder */}
              <div className="pt-4 border-t border-slate-800 space-y-3 bg-slate-950/60 p-4 rounded-xl border">
                <h4 className="text-xs font-black uppercase text-emerald-400">Accounts Final Settlement Authorization</h4>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Accounts Audit Remark / Note:</label>
                  <textarea
                    rows={2}
                    value={accountRemark}
                    onChange={(e) => setAccountRemark(e.target.value)}
                    placeholder="e.g., Verified against original vouchers; cleared for final bank disbursement."
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={() => handleUpdateFolderStatus(selectedFolder.id, 'REJECTED')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 rounded-xl text-xs font-bold transition"
                  >
                    {actionLoading ? 'Processing...' : '✕ Reject Folder Settlement'}
                  </button>
                  <button
                    onClick={() => handleUpdateFolderStatus(selectedFolder.id, 'APPROVED')}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {actionLoading ? 'Processing...' : '✓ Approve & Disburse Folder'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
