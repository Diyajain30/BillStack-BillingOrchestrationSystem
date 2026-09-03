import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi } from '../services/api';

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();

  // Role detection
  const isStorekeeper = user?.role === 'Storekeeper';
  const roleTitle = isStorekeeper ? 'Storekeeper Portal' : 'Executive Control Center (Principal)';

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('Queue');
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Action States
  const [selectedBill, setSelectedBill] = useState(null);
  const [remark, setRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Discrepancy in recorded ledger items');
  const [actionLoading, setActionLoading] = useState(false);

  // Sub-Event Budget Caps for Analytics
  const subEvents = [
    { name: 'Coding Competition', allocated: 30000 },
    { name: 'Web Genesis Hackathon', allocated: 25000 },
    { name: 'Robo-Soccer Arena', allocated: 35000 },
    { name: 'Circuit Design', allocated: 20000 },
  ];

  // Fetch real bills from Spring Boot backend
  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await backendApi.get('/bills');
      if (response.data && Array.isArray(response.data)) {
        setBills(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setRemark('');
    setRejectionReason('Discrepancy in recorded ledger items');
  };

  // Storekeeper Handshake: PENDING_STOREKEEPER -> PENDING_PRINCIPAL
  const handleStorekeeperVerify = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'PENDING_PRINCIPAL',
        remark: remark || 'Verified and stock ledger recorded by Storekeeper',
      });
      alert(`Bill #${selectedBill.billNo} recorded in digital stock book and forwarded to Principal!`);
      closeModals();
      fetchBills();
    } catch (error) {
      console.error('Storekeeper update failed:', error);
      alert(error.response?.data?.message || 'Failed to update status on server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Principal Handshake: PENDING_PRINCIPAL -> APPROVED
  const handlePrincipalApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'APPROVED',
        remark: remark || 'Sanctioned and final expenditure approved by Principal',
      });
      alert(`Bill #${selectedBill.billNo} has received FINAL APPROVAL by the Principal!`);
      closeModals();
      fetchBills();
    } catch (error) {
      console.error('Principal approval failed:', error);
      alert(error.response?.data?.message || 'Failed to sanction bill.');
    } finally {
      setActionLoading(false);
    }
  };

  // Rejection: Kicks bill back to Event Head
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        remark: remark,
        rejectionReason: rejectionReason,
      });
      alert(`Bill #${selectedBill.billNo} rejected. Disapproval sent to coordinator.`);
      closeModals();
      fetchBills();
    } catch (error) {
      console.error('Rejection failed:', error);
      alert(error.response?.data?.message || 'Failed to reject bill.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Audit Voucher PDF
  const downloadVoucher = (bill) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GOVERNMENT COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text('AUDIT VOUCHER & EXPENSE CERTIFICATION', 105, 27, { align: 'center' });
    doc.line(15, 31, 195, 31);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Voucher Ref: BS-AUD-${bill.id}`, 16, 40);
    doc.text(`Bill No: ${bill.billNo || 'N/A'}`, 130, 40);
    doc.text(`Vendor: ${bill.vendorName}`, 16, 48);
    doc.text(`Date: ${bill.billDate || 'N/A'}`, 130, 48);
    doc.text(`Event: ${bill.eventName || 'Wings TechFest'}`, 16, 56);
    doc.text(`Final Status: ${bill.status}`, 130, 56);

    doc.rect(15, 65, 180, 40);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL SETTLEMENT', 20, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(`Taxable Amount: Rs. ${Number(bill.baseAmount || bill.amount).toFixed(2)}`, 20, 84);
    doc.text(`Taxes (CGST + SGST): Rs. ${(Number(bill.cgst || 0) + Number(bill.sgst || 0)).toFixed(2)}`, 110, 84);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gross Total: Rs. ${Number(bill.amount).toFixed(2)}`, 20, 94);
    doc.text(`Progressive Cumulative Total: Rs. ${(bill.runningTotal || bill.amount).toFixed(2)}`, 110, 94);

    doc.save(`Certified_Voucher_${bill.billNo || bill.id}.pdf`);
  };

  // Metrics Calculation
  const totalExpenditure = bills
    .filter((b) => b.status === 'APPROVED')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const pendingStorekeeperBills = bills.filter((b) => b.status === 'PENDING_STOREKEEPER');
  const pendingPrincipalBills = bills.filter((b) => b.status === 'PENDING_PRINCIPAL');
  const approvedBills = bills.filter((b) => b.status === 'APPROVED');
  const rejectedBills = bills.filter((b) => b.status === 'REJECTED');

  // Active Queue Determination
  const activeQueueBills = isStorekeeper ? pendingStorekeeperBills : pendingPrincipalBills;

  // Filtered Master List
  const filteredBills = bills.filter((b) => {
    const matchesStatus = statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch =
      b.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.billNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.eventName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl font-black shadow-lg">
              B
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-indigo-400">BillStack</span>
              <span className="block bg-indigo-900/60 border border-indigo-700 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                {isStorekeeper ? 'Storekeeper' : 'Admin / Principal'}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            {[
              { id: 'Queue', label: isStorekeeper ? 'Store Inventory Queue' : 'Executive Approvals', icon: '📥', count: activeQueueBills.length },
              { id: 'Ledger', label: 'Master Bills Ledger', icon: '📑', count: bills.length },
              { id: 'Budgets', label: 'Event Budgets', icon: '📊', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span>{tab.icon}</span>
                  {tab.label}
                </span>
                {tab.count !== null && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                    tab.count > 0 ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-bold">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-200">{user?.name || 'Authority User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">{roleTitle}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isStorekeeper
                ? 'Verify physical store notes, record ledger serials, and pass to the Principal.'
                : 'High-level financial oversight, budget guardrails, and final expenditure sanctions.'}
            </p>
          </div>
          <button
            onClick={fetchBills}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 shadow-sm transition"
          >
            ↻ Sync Live Database
          </button>
        </header>

        {/* Global Key Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Certified Outflow</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">₹{totalExpenditure.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 mt-1">{approvedBills.length} fully sanctioned vouchers</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storekeeper Queue</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{pendingStorekeeperBills.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting digital stock notes</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Principal Sanction Desk</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{pendingPrincipalBills.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting final authority sign-off</p>
          </div>
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Rejections</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{rejectedBills.length}</p>
            <p className="text-[10px] text-slate-400 mt-1">Returned for coordinator revision</p>
          </div>
        </section>

        {/* TAB 1: ACTION QUEUE (ROLE-TAILORED) */}
        {activeTab === 'Queue' && (
          <section className="mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <span>⚡</span> Active Authorization Queue ({activeQueueBills.length})
                </h2>
                <p className="text-xs text-slate-400">
                  {isStorekeeper
                    ? 'Bills verified by Faculty and waiting for Storekeeper inventory records.'
                    : 'Bills verified by Faculty and Storekeeper waiting for Principal final sanction.'}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">Loading ledger queue...</div>
            ) : activeQueueBills.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                ✓ All caught up! No bills are currently stalled at this review gate.
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
                          Running: ₹{(bill.runningTotal || bill.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl text-xs space-y-1 text-slate-300">
                      <p><strong className="text-slate-400">GSTIN:</strong> {bill.vendorGstin || 'Unregistered'}</p>
                      <p><strong className="text-slate-400">Trail:</strong> {bill.description || 'Auto-verified'}</p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-700/60">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        {isStorekeeper ? 'Record & Forward' : 'Sanction & Approve'}
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

        {/* TAB 2: MASTER BILLS LEDGER */}
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
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 w-full md:w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                >
                  <option value="All">All Statuses</option>
                  <option value="PENDING_FACULTY">Faculty Review</option>
                  <option value="PENDING_STOREKEEPER">Storekeeper Review</option>
                  <option value="PENDING_PRINCIPAL">Principal Review</option>
                  <option value="APPROVED">Sanctioned / Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Invoice No</th>
                    <th className="py-3.5 px-4">Vendor & Sub-Event</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Running Cumulative</th>
                    <th className="py-3.5 px-4">Conveyor Belt Status</th>
                    <th className="py-3.5 px-4 text-center">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                  {filteredBills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">#{b.billNo || b.id}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block">{b.vendorName}</span>
                        <span className="text-[10px] text-slate-400">{b.eventName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-white">₹{Number(b.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-bold text-indigo-400">
                        ₹{Number(b.runningTotal || b.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          b.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : b.status === 'REJECTED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => downloadVoucher(b)}
                          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] font-bold transition shadow-sm"
                          title="Print official audit voucher"
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

        {/* TAB 3: SUB-EVENT BUDGET COMPLIANCE */}
        {activeTab === 'Budgets' && (
          <section className="mt-8 space-y-6">
            <div>
              <h2 className="text-base font-black text-white">Sub-Event Budget Guardrails</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time tracking of allocations vs. expenditures to prevent overspending.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subEvents.map((evt) => {
                const spentForEvent = bills
                  .filter((b) => b.eventName?.includes(evt.name) && b.status === 'APPROVED')
                  .reduce((sum, b) => sum + Number(b.amount), 0);
                const percent = Math.min((spentForEvent / evt.allocated) * 100, 100);
                const isWarning = percent >= 80;

                return (
                  <div key={evt.name} className="bg-slate-800/50 border border-slate-700/80 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-white">{evt.name}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Wings TechFest Folder</p>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                        isWarning ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {percent.toFixed(1)}% Spent
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isWarning ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400 pt-1 font-semibold">
                      <span>Utilized: ₹{spentForEvent.toLocaleString('en-IN')}</span>
                      <span>Allocated Cap: ₹{evt.allocated.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── REVIEW MODAL ─── */}
        {selectedBill && !showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isStorekeeper ? 'Storekeeper Verification Gate' : 'Principal Executive Sanction'}
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
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Running Balance</span>
                  <p className="text-lg font-black text-indigo-400">
                    ₹{Number(selectedBill.runningTotal || selectedBill.amount).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  {isStorekeeper ? 'Stock Book / Register Note:' : 'Sanction Remark / Executive Order:'}
                </label>
                <textarea
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={
                    isStorekeeper
                      ? 'e.g., Logged in Technical Store Book Vol 4, Page 12.'
                      : 'e.g., Sanctioned under Wings Annual Operating Budget.'
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
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
                  onClick={isStorekeeper ? handleStorekeeperVerify : handlePrincipalApprove}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {actionLoading ? 'Updating...' : isStorekeeper ? '✓ Verify & Pass to Principal' : '✓ Sanction & Grant Final Approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MANDATORY REJECTION MODAL ─── */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">Disapproval & Correction Loop</h3>
              <p className="text-xs text-slate-400">
                Specify why Bill #{selectedBill?.billNo} is being kicked back to the Event Coordinator.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Reason for rejection:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium"
                >
                  <option value="Discrepancy in recorded ledger items">Discrepancy in recorded ledger items</option>
                  <option value="Missing physical receipt in department store">
                    Missing physical receipt in department store
                  </option>
                  <option value="Over-budget sub-event quota">Over-budget sub-event quota</option>
                  <option value="Incomplete vendor tax credentials">Incomplete vendor tax credentials</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
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