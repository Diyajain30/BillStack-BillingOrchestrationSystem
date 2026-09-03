import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';

export default function FacultyDashboard({ user }) {
  const navigate = useNavigate();

  // State Management
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Pending Approvals');
  const [eventFilter, setEventFilter] = useState('All');

  // Modals & Review State
  const [selectedBill, setSelectedBill] = useState(null);
  const [facultyRemark, setFacultyRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("Amount doesn't match the bill");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch real bills from Spring Boot backend
  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await backendApi.get('/bills');
      if (response.data && Array.isArray(response.data)) {
        setBills(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch bills from Spring Boot:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Filter Logic
  const filteredBills = bills.filter((b) => {
    const isPending = b.status === 'PENDING_FACULTY';
    const isApproved =
      b.status === 'PENDING_STOREKEEPER' ||
      b.status === 'PENDING_PRINCIPAL' ||
      b.status === 'APPROVED';
    const isRejected = b.status === 'REJECTED';

    let matchesTab = true;
    if (activeTab === 'Pending Approvals') matchesTab = isPending;
    if (activeTab === 'Approved Bills') matchesTab = isApproved;
    if (activeTab === 'Rejected') matchesTab = isRejected;

    const matchesEvent = eventFilter === 'All' ? true : b.eventName?.includes(eventFilter);
    return matchesTab && matchesEvent;
  });

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setFacultyRemark('');
    setRejectionReason("Amount doesn't match the bill");
  };

  // Advance bill on conveyor belt to Storekeeper
  const handleApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'PENDING_STOREKEEPER',
        remark: facultyRemark || 'Verified and approved by Faculty Coordinator',
      });
      alert(`Bill #${selectedBill.billNo} approved and forwarded to Storekeeper!`);
      closeModals();
      fetchBills();
    } catch (error) {
      console.error('Approval failed:', error);
      alert(error.response?.data?.message || 'Failed to update bill status on server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject bill and send feedback loop back to Event Head
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        remark: facultyRemark,
        rejectionReason: rejectionReason,
      });
      alert(`Bill #${selectedBill.billNo} rejected and kicked back to Event Head for corrections.`);
      closeModals();
      fetchBills();
    } catch (error) {
      console.error('Rejection failed:', error);
      alert(error.response?.data?.message || 'Failed to record rejection on server.');
    } finally {
      setActionLoading(false);
    }
  };

  // Metric Calculations
  const pendingCount = bills.filter((b) => b.status === 'PENDING_FACULTY').length;
  const approvedCount = bills.filter(
    (b) =>
      b.status === 'PENDING_STOREKEEPER' ||
      b.status === 'PENDING_PRINCIPAL' ||
      b.status === 'APPROVED'
  ).length;
  const rejectedCount = bills.filter((b) => b.status === 'REJECTED').length;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-violet-950 text-white flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-xl font-black shadow-lg">
              B
            </div>
            <div>
              <span className="text-xl font-black tracking-wide text-violet-400">BillStack</span>
              <span className="block bg-violet-800 text-violet-200 text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit mt-0.5">
                Faculty Portal
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            {[
              { label: 'Pending Approvals', icon: '⏳', count: pendingCount },
              { label: 'All Bills', icon: '📄', count: bills.length },
              { label: 'Approved Bills', icon: '✓', count: approvedCount },
              { label: 'Rejected', icon: '✕', count: rejectedCount },
            ].map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-between ${
                  activeTab === tab.label
                    ? 'bg-violet-800 text-white shadow-sm'
                    : 'text-violet-200 hover:bg-violet-900/50 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span>{tab.icon}</span>
                  {tab.label}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/80 font-bold">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-violet-800/60">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-sm font-bold">
              {user?.name ? user.name[0].toUpperCase() : 'F'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name || 'Prof. Faculty Advisor'}</p>
              <p className="text-xs text-violet-300 truncate">Verification Gate</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-2 bg-violet-900/80 hover:bg-violet-900 rounded-lg text-xs font-semibold text-violet-200 transition"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-violet-950">Review & Approve Expenses</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Inspect OCR-extracted bills and authorize movement to the Storekeeper.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Event Filter
              </span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
              >
                <option>All</option>
                <option>Wings Technical Fest</option>
                <option>Coding Competition</option>
                <option>Web Genesis</option>
              </select>
            </div>
            <button
              onClick={fetchBills}
              className="mt-4 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Review
            </p>
            <p className="text-3xl font-extrabold text-violet-950 mt-1">{pendingCount}</p>
            <p className="text-xs text-slate-400 mt-1">Awaiting your approval</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved Forwarded
            </p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{approvedCount}</p>
            <p className="text-xs text-slate-400 mt-1">Moved to Storekeeper / Principal</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Rejected (Feedback)
            </p>
            <p className="text-3xl font-extrabold text-red-600 mt-1">{rejectedCount}</p>
            <p className="text-xs text-slate-400 mt-1">Returned to students for correction</p>
          </div>
        </section>

        {/* Main Bills Table */}
        <div className="bg-white p-6 rounded-2xl border border-violet-100 shadow-sm space-y-4 mt-8">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-violet-950">
              {activeTab} ({filteredBills.length})
            </h2>
            <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-1 rounded-md">
              Showing: {eventFilter}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-400">
              Fetching records from Spring Boot backend...
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No bills found under this status tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Bill No</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Running Total</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-violet-50/50 transition font-medium">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{bill.billNo || bill.id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {bill.vendorName}
                        <span className="block text-[10px] text-slate-400">{bill.eventName}</span>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        ₹{Number(bill.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-bold text-violet-800">
                        ₹{Number(bill.runningTotal || bill.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{bill.billDate || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            bill.status === 'PENDING_FACULTY'
                              ? 'bg-amber-100 text-amber-800'
                              : bill.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                            bill.status === 'PENDING_FACULTY'
                              ? 'bg-violet-600 hover:bg-violet-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {bill.status === 'PENDING_FACULTY' ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── REVIEW & APPROVAL MODAL ─── */}
        {selectedBill && !showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-violet-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Audit Verification Portal</h3>
                  <p className="text-xs text-slate-500">
                    Verify OCR extracted details against physical receipt specs
                  </p>
                </div>
                <button
                  onClick={closeModals}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Vendor</span>
                    <p className="font-bold text-slate-900">{selectedBill.vendorName}</p>
                    <span className="text-xs font-mono text-slate-500">
                      GSTIN: {selectedBill.vendorGstin || 'Not Provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Invoice ID</span>
                    <p className="font-bold text-slate-900">{selectedBill.billNo}</p>
                    <span className="text-xs text-slate-500">Date: {selectedBill.billDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Bill Amount</span>
                    <p className="text-xl font-black text-violet-900">
                      ₹{Number(selectedBill.amount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Running Total Position
                    </span>
                    <p className="text-xl font-black text-slate-800">
                      ₹{Number(selectedBill.runningTotal || selectedBill.amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Tax Breakdown */}
                <div className="flex gap-4 text-xs font-semibold text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                  <span>Base: ₹{Number(selectedBill.baseAmount || selectedBill.amount).toFixed(2)}</span>
                  <span>CGST: ₹{Number(selectedBill.cgst || 0).toFixed(2)}</span>
                  <span>SGST: ₹{Number(selectedBill.sgst || 0).toFixed(2)}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Faculty Remarks / Audit Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={facultyRemark}
                    onChange={(e) => setFacultyRemark(e.target.value)}
                    placeholder="e.g., Verified against sanctioned quota for coding competition."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                {selectedBill.status === 'PENDING_FACULTY' && (
                  <>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-sm transition"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-sm transition"
                    >
                      {actionLoading ? 'Updating...' : '✓ Approve & Forward'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── MANDATORY REJECTION MODAL ─── */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Mandatory Rejection Feedback</h3>
              <p className="text-xs text-slate-500">
                Specify the discrepancy for rejecting Bill #{selectedBill?.billNo}. This will trigger
                the revision loop back to the Event Head.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for rejection:
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800"
                >
                  <option value="Amount doesn't match the bill">Amount doesn't match the bill</option>
                  <option value="Missing or unreadable receipt image">
                    Missing or unreadable receipt image
                  </option>
                  <option value="Unapproved vendor / Event out-of-scope">
                    Unapproved vendor / Event out-of-scope
                  </option>
                  <option value="Sub-event budget allocation exceeded">
                    Sub-event budget allocation exceeded
                  </option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md transition"
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