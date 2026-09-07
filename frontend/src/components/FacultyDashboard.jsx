import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { backendApi } from '../services/api';

export default function FacultyDashboard({ user }) {
  const navigate = useNavigate();

  // Current User & Assigned Sub-Event Context
  const [currentUser, setCurrentUser] = useState(user);
  const [subEvent, setSubEvent] = useState(null);
  const [coordinatorList, setCoordinatorList] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);

  // Bills & Tab State
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [activeTab, setActiveTab] = useState('Pending Approvals');

  // Review Modal & Manual OCR Override State
  const [selectedBill, setSelectedBill] = useState(null);
  const [editVendorName, setEditVendorName] = useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editBaseAmount, setEditBaseAmount] = useState('');
  const [editBillDate, setEditBillDate] = useState('');
  const [editVendorGstin, setEditVendorGstin] = useState('');
  const [editCgst, setEditCgst] = useState(0);
  const [editSgst, setEditSgst] = useState(0);
  const [facultyRemark, setFacultyRemark] = useState('');

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("Amount doesn't match the bill");
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch live sub-event details & assigned student coordinators
  const fetchSubEventData = useCallback(async () => {
    try {
      setLoadingEvent(true);
      let subEventId = currentUser?.assignedSubEventId;

      // Synchronize with database if not in local session
      if (!subEventId && currentUser?.id) {
        const userRes = await axios.get(`http://localhost:8080/api/users/${currentUser.id}`);
        if (userRes.data?.assignedSubEventId) {
          subEventId = userRes.data.assignedSubEventId;
          setCurrentUser(userRes.data);
          localStorage.setItem('user', JSON.stringify(userRes.data));
        }
      }

      if (subEventId) {
        const res = await axios.get(`http://localhost:8080/api/subevents/${subEventId}`);
        setSubEvent(res.data);
        setCoordinatorList(res.data.coordinators || []);
      } else {
        setSubEvent(null);
        setCoordinatorList([]);
      }
    } catch (err) {
      console.error('Failed to load assigned sub-event for faculty:', err);
    } finally {
      setLoadingEvent(false);
    }
  }, [currentUser]);

  // 2. Fetch live bills from Spring Boot backend
  const fetchBills = async () => {
    setLoadingBills(true);
    try {
      const response = await backendApi.get('/bills');
      if (response.data && Array.isArray(response.data)) {
        setBills(response.data);
      } else {
        setBills([]);
      }
    } catch (error) {
      console.error('Failed to fetch bills from backend:', error);
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchSubEventData();
    fetchBills();
  }, [fetchSubEventData]);

  // 3. Strict sub-event data scoping
  const scopedBills = subEvent
    ? bills.filter(
        (b) =>
          b.subEventId === subEvent.id ||
          (b.eventName && b.eventName.toLowerCase().trim() === subEvent.name.toLowerCase().trim())
      )
    : [];

  // 4. Real-time dynamic financial metrics
  const allocatedBudget = subEvent?.budgetCap ? Number(subEvent.budgetCap) : 0;
  const advancePayment = subEvent?.advanceDisbursed ? Number(subEvent.advanceDisbursed) : 0;
  const totalExpenditure = scopedBills.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBalance = allocatedBudget - totalExpenditure;

  // 5. Operational review counts
  const pendingCount = scopedBills.filter((b) => b.status === 'PENDING_FACULTY').length;
  const approvedCount = scopedBills.filter(
    (b) =>
      b.status === 'PENDING_STOREKEEPER' ||
      b.status === 'PENDING_PRINCIPAL' ||
      b.status === 'APPROVED'
  ).length;
  const rejectedCount = scopedBills.filter((b) => b.status === 'REJECTED').length;

  // Filter bills by active tab
  const filteredBills = scopedBills.filter((b) => {
    if (activeTab === 'Pending Approvals') return b.status === 'PENDING_FACULTY';
    if (activeTab === 'Approved Bills') {
      return (
        b.status === 'PENDING_PRINCIPAL' ||
        b.status === 'PENDING_STOREKEEPER' ||
        b.status === 'APPROVED'
      );
    }
    if (activeTab === 'Rejected') return b.status === 'REJECTED';
    return true; // 'All Bills'
  });

  // Open review modal and populate editable manual override fields
  const handleOpenReview = (bill) => {
    setSelectedBill(bill);
    setEditVendorName(bill.vendorName || '');
    setEditBillNo(bill.billNo || '');
    setEditAmount(bill.amount || '');
    setEditBaseAmount(bill.baseAmount || bill.amount || '');
    setEditBillDate(bill.billDate || '');
    setEditVendorGstin(bill.vendorGstin || '');
    setEditCgst(bill.cgst || 0);
    setEditSgst(bill.sgst || 0);
    setFacultyRemark('');
  };

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setFacultyRemark('');
    setRejectionReason("Amount doesn't match the bill");
  };

  // Approve bill and advance conveyor belt
  const handleApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      const payload = {
        status: 'PENDING_PRINCIPAL',
        remark: facultyRemark || 'Verified and approved by Faculty Advisor',
        vendorName: editVendorName,
        billNo: editBillNo,
        amount: parseFloat(editAmount) || selectedBill.amount,
        baseAmount: parseFloat(editBaseAmount) || selectedBill.baseAmount,
        billDate: editBillDate,
        vendorGstin: editVendorGstin,
        cgst: parseFloat(editCgst) || 0,
        sgst: parseFloat(editSgst) || 0,
      };

      await backendApi.put(`/bills/${selectedBill.id}/status`, payload);
      alert(`Bill #${editBillNo || selectedBill.billNo} approved and forwarded to Principal!`);
      closeModals();
      fetchBills();
      fetchSubEventData();
    } catch (error) {
      console.error('Approval failed:', error);
      alert(error.response?.data?.message || 'Failed to update bill status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject bill and kick back to student coordinator
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
    setActionLoading(true);

    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        remark: facultyRemark,
        rejectionReason: rejectionReason,
      });
      alert(`Bill #${selectedBill.billNo} rejected and returned to Coordinator for corrections.`);
      closeModals();
      fetchBills();
      fetchSubEventData();
    } catch (error) {
      console.error('Rejection failed:', error);
      alert(error.response?.data?.message || 'Failed to record rejection.');
    } finally {
      setActionLoading(false);
    }
  };

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
              { label: 'All Bills', icon: '📄', count: scopedBills.length },
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
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'F'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{currentUser?.name || 'Faculty Advisor'}</p>
              <p className="text-xs text-violet-300 truncate">
                {subEvent ? subEvent.department : (currentUser?.department || 'Department')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            className="w-full py-2 bg-violet-900/80 hover:bg-violet-900 rounded-lg text-xs font-semibold text-violet-200 transition"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl space-y-6">
        {/* Dynamic Sub-Event Header */}
        <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-md">
                  {subEvent ? subEvent.department : (currentUser?.department || 'Not allotted yet')}
                </span>
                <span className="text-xs font-semibold text-slate-400">Wings TechFest Faculty Review Gate</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {subEvent ? subEvent.name : 'Not allotted yet'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                subEvent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {subEvent ? `Lifecycle: ${subEvent.status || 'OPEN'}` : 'Not allotted yet'}
              </span>
              <button
                onClick={() => {
                  fetchSubEventData();
                  fetchBills();
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Description</span>
              <p className="text-slate-700 font-medium mt-0.5">
                {subEvent?.description?.trim() ? subEvent.description : 'Not allotted yet'}
              </p>
            </div>
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Assigned Student Coordinator(s)</span>
              <p className="text-violet-900 font-bold mt-0.5">
                {coordinatorList.length > 0
                  ? coordinatorList.map((c) => `${c.name} (${c.institutionalId})`).join(', ')
                  : 'Not allotted yet'}
              </p>
            </div>
          </div>
        </header>

        {/* SECTION 1: 4 Financial Ledger Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Budget Allocated</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              ₹{allocatedBudget.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">{subEvent ? subEvent.name : 'Not allotted yet'}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Advance Payment</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              ₹{advancePayment.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">Physical advance logged</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Expenditure</p>
            <p className="text-2xl font-black text-violet-700 mt-1">
              ₹{totalExpenditure.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">{scopedBills.length} bills in sub-event</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining Balance</p>
            <p className={`text-2xl font-black mt-1 ${remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              ₹{remainingBalance.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">Real-time ledger sync</p>
          </div>
        </section>

        {/* SECTION 2: 3 Operational Queue Cards (from original dashboard) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</p>
            <p className="text-3xl font-extrabold text-violet-950 mt-1">{pendingCount}</p>
            <p className="text-xs text-slate-400 mt-1">Awaiting your approval</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Forwarded</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{approvedCount}</p>
            <p className="text-xs text-slate-400 mt-1">Moved to Storekeeper / Principal</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected (Feedback)</p>
            <p className="text-3xl font-extrabold text-rose-600 mt-1">{rejectedCount}</p>
            <p className="text-xs text-slate-400 mt-1">Returned to students for correction</p>
          </div>
        </section>

        {/* Main Bills Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-violet-950">
              {activeTab} ({filteredBills.length})
            </h2>
            <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-1 rounded-md">
              Sub-Event: {subEvent ? subEvent.name : 'Not allotted yet'}
            </span>
          </div>

          {loadingBills ? (
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
                          onClick={() => handleOpenReview(bill)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                            bill.status === 'PENDING_FACULTY'
                              ? 'bg-violet-600 hover:bg-violet-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {bill.status === 'PENDING_FACULTY' ? 'Review & Edit' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── REVIEW & OCR EDIT OVERRIDE MODAL ─── */}
        {selectedBill && !showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-violet-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Faculty Audit & Verification Portal</h3>
                  <p className="text-xs text-slate-500">
                    Verify physical receipt specs and correct any OCR extraction errors manually
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor Name</label>
                    <input
                      type="text"
                      value={editVendorName}
                      onChange={(e) => setEditVendorName(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Invoice Number</label>
                    <input
                      type="text"
                      value={editBillNo}
                      onChange={(e) => setEditBillNo(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300 font-semibold font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Bill Date</label>
                    <input
                      type="text"
                      value={editBillDate}
                      onChange={(e) => setEditBillDate(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor GSTIN</label>
                    <input
                      type="text"
                      value={editVendorGstin}
                      onChange={(e) => setEditVendorGstin(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Base Taxable Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBaseAmount}
                      onChange={(e) => setEditBaseAmount(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Grand Total Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300 font-black text-violet-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">CGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCgst}
                      onChange={(e) => setEditCgst(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">SGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editSgst}
                      onChange={(e) => setEditSgst(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Faculty Remarks / Audit Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={facultyRemark}
                    onChange={(e) => setFacultyRemark(e.target.value)}
                    placeholder="e.g., Verified against sanctioned sub-event quota."
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
                      {actionLoading ? 'Updating...' : '✓ Confirm, Save & Forward'}
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
                Specify why Bill #{selectedBill?.billNo} is being kicked back to the Student Coordinator.
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