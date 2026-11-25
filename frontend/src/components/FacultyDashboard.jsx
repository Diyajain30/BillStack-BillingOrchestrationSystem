import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import { SubEventAnalytics } from './AnalyticsCharts';

function isSteppedBackOrRejected(bill) {
  if (!bill) return false;
  if (bill.status === 'REJECTED') return true;
  return Boolean(bill.rejectionReason || bill.rejectedBy);
}

function getStatusBadgeClass(bill) {
  if (isSteppedBackOrRejected(bill)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (bill?.status === 'APPROVED') {
    return 'bg-sage-100 text-sage-800 border-sage-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function FacultyDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('pending'); // 'summary' | 'pending' | 'all' | 'approved' | 'rejected' | 'profile'
  const [currentUser, setCurrentUser] = useState(user);
  const [subEvent, setSubEvent] = useState(null);
  const [coordinatorList, setCoordinatorList] = useState([]);
  const [facultyHeadList, setFacultyHeadList] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Review / Override Modal
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [editVendorName, setEditVendorName] = useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editBaseAmount, setEditBaseAmount] = useState('');
  const [editBillDate, setEditBillDate] = useState('');
  const [editVendorGstin, setEditVendorGstin] = useState('');
  const [editCgst, setEditCgst] = useState(0);
  const [editSgst, setEditSgst] = useState(0);
  const [facultyRemark, setFacultyRemark] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(
    "Amount doesn't match the bill"
  );
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showMessage = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev.text === text ? { type: '', text: '' } : prev));
    }, 5000);
  };

  const fetchBills = useCallback(async (targetSubEvent) => {
    const subEventId =
      typeof targetSubEvent === 'object' ? targetSubEvent?.id : targetSubEvent;
    setLoadingBills(true);
    try {
      const response = await backendApi.get('/bills', {
        params: subEventId ? { subEventId } : {},
      });
      setBills(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const fetchSubEventData = useCallback(async () => {
    try {
      setLoadingEvent(true);
      let subEventId = currentUser?.assignedSubEventId;

      if (currentUser?.id) {
        try {
          const userRes = await backendApi.get(`/users/${currentUser.id}`);
          if (userRes.data) {
            subEventId = userRes.data.assignedSubEventId || subEventId;
            setCurrentUser(userRes.data);
            localStorage.setItem('user', JSON.stringify(userRes.data));
          }
        } catch (err) {
          console.warn('Could not refresh faculty user assignment:', err);
        }
      }

      if (subEventId) {
        const res = await backendApi.get(`/subevents/${subEventId}`);
        setSubEvent(res.data);
        setCoordinatorList(res.data?.coordinators || []);
        setFacultyHeadList(res.data?.facultyHeads || []);
        await fetchBills(res.data);
      } else {
        setSubEvent(null);
        setCoordinatorList([]);
        setFacultyHeadList([]);
        await fetchBills(null);
      }
    } catch (err) {
      console.error('Failed to load assigned sub-event for faculty:', err);
    } finally {
      setLoadingEvent(false);
    }
  }, [currentUser?.id, currentUser?.assignedSubEventId, fetchBills]);

  useEffect(() => {
    fetchSubEventData();
  }, [fetchSubEventData]);

  const scopedBills = subEvent
    ? bills.filter(
        (b) =>
          String(b.subEventId) === String(subEvent.id) ||
          (b.eventName &&
            subEvent.name &&
            b.eventName.toLowerCase().trim() ===
              subEvent.name.toLowerCase().trim())
      )
    : [];

  const isEventClosed =
    String(subEvent?.status || '').toUpperCase() === 'CLOSED' ||
    Boolean(subEvent?.readOnly);

  // Budget totals calculated strictly from fully APPROVED bills
  const allocatedBudget = subEvent?.budgetCap ? Number(subEvent.budgetCap) : 0;
  const advancePayment = subEvent?.advanceDisbursed
    ? Number(subEvent.advanceDisbursed)
    : 0;
  const totalExpenditure = scopedBills
    .filter((b) => b.status === 'APPROVED')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBalance = allocatedBudget - totalExpenditure;

  const pendingCount = scopedBills.filter(
    (b) => b.status === 'PENDING_FACULTY' && !isSteppedBackOrRejected(b)
  ).length;
  const approvedCount = scopedBills.filter(
    (b) =>
      !isSteppedBackOrRejected(b) &&
      (b.status === 'PENDING_MAIN_HEAD' ||
        b.status === 'PENDING_PRINCIPAL' ||
        b.status === 'PENDING_STOREKEEPER' ||
        b.status === 'APPROVED')
  ).length;
  const rejectedCount = scopedBills.filter((b) =>
    isSteppedBackOrRejected(b)
  ).length;

  const filteredBills = scopedBills.filter((b) => {
    if (activeTab === 'pending') {
      return b.status === 'PENDING_FACULTY' && !isSteppedBackOrRejected(b);
    }
    if (activeTab === 'approved') {
      return (
        !isSteppedBackOrRejected(b) &&
        (b.status === 'PENDING_MAIN_HEAD' ||
          b.status === 'PENDING_PRINCIPAL' ||
          b.status === 'PENDING_STOREKEEPER' ||
          b.status === 'APPROVED')
      );
    }
    if (activeTab === 'rejected') return isSteppedBackOrRejected(b);
    return true;
  });

  const handleOpenReview = (bill) => {
    setSelectedBill(bill);
    setEditVendorName(bill.vendorName || '');
    setEditBillNo(bill.billNo || '');
    setEditAmount(bill.amount ?? '');
    setEditBaseAmount(bill.baseAmount ?? bill.amount ?? '');
    setEditBillDate(bill.billDate || '');
    setEditVendorGstin(bill.vendorGstin || '');
    setEditCgst(bill.cgst ?? 0);
    setEditSgst(bill.sgst ?? 0);
    setFacultyRemark('');
    setRejectionRemark('');
  };

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setFacultyRemark('');
    setRejectionRemark('');
    setRejectionReason("Amount doesn't match the bill");
  };

  const handleApprove = async () => {
    if (!selectedBill || isEventClosed) return;
    setActionLoading(true);
    try {
      const payload = {
        status: 'APPROVED',
        role: 'FACULTY',
        actorId: currentUser?.id,
        remark: facultyRemark || 'Verified and approved by Faculty Head',
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
      showMessage(
        'success',
        `Bill #${editBillNo || selectedBill.billNo} approved and forwarded to Main Event Head.`
      );
      closeModals();
      await fetchSubEventData();
    } catch (error) {
      console.error('Approval failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to update bill status.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedBill || isEventClosed) return;
    if (!rejectionRemark.trim()) {
      showMessage(
        'error',
        'A rejection remark is compulsory when rejecting a bill.'
      );
      return;
    }

    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        stepBack: true,
        role: 'FACULTY',
        actorId: currentUser?.id,
        remark: rejectionRemark.trim(),
        rejectionReason: rejectionReason,
        rejectedBy: 'FACULTY',
      });
      showMessage(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} rejected and moved to Rejected bills.`
      );
      closeModals();
      await fetchSubEventData();
    } catch (error) {
      console.error('Rejection failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to record rejection.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyClosure = async () => {
    if (!subEvent?.id || isEventClosed) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/subevents/${subEvent.id}/verify-closure`, {
        role: 'FACULTY',
        userId: String(currentUser?.id || ''),
      });
      showMessage('success', `Closure approval recorded for "${subEvent.name}".`);
      await fetchSubEventData();
    } catch (err) {
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to verify closure.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof onLogout === 'function') onLogout();
    navigate('/', { replace: true });
  };

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition disabled:bg-sage-50 disabled:text-stone-600';

  const navItems = [
    { id: 'summary', label: 'Event Summary' },
    { id: 'pending', label: 'Pending Approvals', count: pendingCount },
    { id: 'all', label: 'All Bills', count: scopedBills.length },
    { id: 'approved', label: 'Forwarded / Approved', count: approvedCount },
    { id: 'rejected', label: 'Rejected', count: rejectedCount },
    { id: 'profile', label: 'Profile' },
  ];

  const tabTitles = {
    pending: 'Pending Approvals',
    all: 'All Bills',
    approved: 'Forwarded & Approved Bills',
    rejected: 'Rejected & Stepped-Back Bills',
  };

  const isPendingFaculty =
    !isEventClosed &&
    selectedBill?.status === 'PENDING_FACULTY' &&
    !isSteppedBackOrRejected(selectedBill);

  return (
    <div className="min-h-screen bg-sage-50 text-stone-800 flex flex-col font-sans">
      <header className="bg-white border-b border-sage-200 sticky top-0 z-30">
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-sage-600" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sage-900">
                BillStack
              </span>
              <span className="text-stone-300">/</span>
              <h1 className="text-sm font-medium text-stone-700">
                Faculty Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {currentUser?.name || currentUser?.username || 'Faculty Head'}
            </span>
            <button
              onClick={fetchSubEventData}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-60 bg-white border-r border-sage-200 p-4 shrink-0 hidden md:block">
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-sage-100 text-sage-900 border border-sage-200'
                    : 'text-stone-600 hover:bg-sage-50 hover:text-stone-900'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border ${
                      item.id === 'pending' && item.count > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : item.id === 'rejected' && item.count > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-stone-600 border-sage-200'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-sage-600 text-white'
                      : 'bg-white border border-sage-200 text-stone-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {feedback.text && (
              <div
                className={`px-4 py-3 rounded-lg border text-xs font-medium ${
                  feedback.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-sage-100 border-sage-200 text-sage-900'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* EVENT SUMMARY TAB */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-medium px-2.5 py-0.5 bg-sage-100 border border-sage-200 text-sage-800 rounded-md">
                        {subEvent?.department ||
                          currentUser?.department ||
                          'Unassigned'}
                      </span>
                      <h2 className="text-xl font-semibold text-stone-900 mt-2">
                        {loadingEvent
                          ? 'Loading...'
                          : subEvent
                          ? subEvent.name
                          : 'Unassigned'}
                      </h2>
                    </div>
                    <span
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg self-start sm:self-auto border ${
                        isEventClosed
                          ? 'bg-stone-100 border-stone-300 text-stone-800'
                          : 'bg-sage-50 border-sage-200 text-sage-800'
                      }`}
                    >
                      Status:{' '}
                      {subEvent ? subEvent.status || 'ACTIVE' : 'Unassigned'}
                    </span>
                  </div>

                  {isEventClosed && (
                    <div className="px-3.5 py-2.5 bg-stone-100 border border-stone-300 rounded-lg text-xs text-stone-700">
                      This sub-event is <strong>CLOSED</strong> and read-only.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-sage-100 text-sm">
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Description
                      </span>
                      <p className="text-stone-800">
                        {subEvent?.description?.trim()
                          ? subEvent.description
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Student Coordinator(s)
                      </span>
                      <p className="text-stone-900 font-medium">
                        {coordinatorList.length > 0
                          ? coordinatorList
                              .map((c) => `${c.name} (${c.institutionalId})`)
                              .join(', ')
                          : 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Co-Assigned Faculty Head(s)
                      </span>
                      <p className="text-stone-900 font-medium">
                        {facultyHeadList.length > 0
                          ? facultyHeadList.map((f) => f.name).join(', ')
                          : currentUser?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </section>

                {!isEventClosed &&
                  subEvent?.closureRequested &&
                  !subEvent?.facultyClosureApproved && (
                    <section className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-amber-900">
                          Sub-Event Closure Requested
                        </h3>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Review approved spend and confirm closure for{' '}
                          {subEvent.name}. Student Head approval:{' '}
                          <strong>
                            {subEvent.studentHeadClosureApproved
                              ? 'Approved'
                              : 'Pending'}
                          </strong>
                          .
                        </p>
                      </div>
                      <button
                        onClick={handleVerifyClosure}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
                      >
                        Confirm Sub-Event Closure
                      </button>
                    </section>
                  )}

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-stone-500">
                      Budget Allocated
                    </p>
                    <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                      INR {allocatedBudget.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-stone-500">
                      Advance Payment
                    </p>
                    <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                      INR {advancePayment.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-stone-500">
                      Approved Expenditure
                    </p>
                    <p className="text-2xl font-semibold text-sage-800 mt-1.5">
                      INR {totalExpenditure.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-stone-500">
                      Remaining Balance
                    </p>
                    <p
                      className={`text-2xl font-semibold mt-1.5 ${
                        remainingBalance < 0
                          ? 'text-rose-700'
                          : 'text-stone-900'
                      }`}
                    >
                      INR {remainingBalance.toLocaleString('en-IN')}
                    </p>
                  </div>
                </section>

                <SubEventAnalytics
                  allocatedBudget={allocatedBudget}
                  bills={scopedBills}
                />
              </div>
            )}

            {/* BILLS TABS */}
            {(activeTab === 'pending' ||
              activeTab === 'all' ||
              activeTab === 'approved' ||
              activeTab === 'rejected') && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sage-100">
                  <h2 className="text-base font-semibold text-stone-900">
                    {tabTitles[activeTab]} ({filteredBills.length})
                  </h2>
                  <span className="text-xs font-medium text-sage-800 bg-sage-50 px-2.5 py-1 rounded-md border border-sage-200 self-start sm:self-auto">
                    Sub-Event: {subEvent ? subEvent.name : 'Unassigned'} (
                    {subEvent?.status || 'ACTIVE'})
                  </span>
                </div>

                {loadingBills ? (
                  <div className="py-10 text-center text-xs text-stone-500">
                    Fetching records...
                  </div>
                ) : filteredBills.length === 0 ? (
                  <div className="py-10 px-4 text-center text-stone-500 text-xs border border-sage-200/80 bg-sage-50/50 rounded-lg">
                    No bills found under this view.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-sage-200 rounded-lg">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-sage-50 text-stone-600 text-xs font-medium border-b border-sage-200">
                          <th className="py-3 px-4">Bill No</th>
                          <th className="py-3 px-4">Vendor</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Approved Total</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100 text-stone-800">
                        {filteredBills.map((bill) => {
                          const rejectedFlag = isSteppedBackOrRejected(bill);
                          const canReviewRow =
                            !isEventClosed &&
                            bill.status === 'PENDING_FACULTY' &&
                            !rejectedFlag;
                          return (
                            <tr
                              key={bill.id}
                              className="hover:bg-sage-50/50 transition"
                            >
                              <td className="py-3 px-4 font-mono text-xs text-stone-600">
                                {bill.billNo || bill.id}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-stone-900 block">
                                  {bill.vendorName}
                                </span>
                                <span className="text-xs text-stone-500">
                                  {bill.eventName}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-stone-900">
                                INR {Number(bill.amount || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-stone-600 text-xs">
                                {bill.status === 'APPROVED'
                                  ? `INR ${Number(
                                      bill.runningTotal || 0
                                    ).toFixed(2)}`
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-xs text-stone-500">
                                {bill.billDate || 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getStatusBadgeClass(
                                    bill
                                  )}`}
                                >
                                  {rejectedFlag ? 'REJECTED' : bill.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenReview(bill)}
                                    className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-md text-xs font-medium transition cursor-pointer"
                                  >
                                    {canReviewRow ? 'Review & Edit' : 'View'}
                                  </button>
                                  <button
                                    onClick={() => setSelectedBillForAudit(bill.id)}
                                    className="px-2.5 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium transition cursor-pointer"
                                  >
                                    Logs
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-lg space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Profile
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Full Name</span>
                    <span className="font-medium text-stone-900">
                      {currentUser?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Username</span>
                    <span className="font-mono text-stone-800">
                      {currentUser?.username || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Staff ID</span>
                    <span className="font-mono text-stone-800">
                      {currentUser?.institutionalId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Department</span>
                    <span className="text-stone-800">
                      {currentUser?.department || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-stone-500">Assigned Sub-Event</span>
                    <span className="font-medium text-sage-800">
                      {subEvent ? subEvent.name : 'Unassigned'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* SIDE-BY-SIDE REVIEW & OVERRIDE MODAL */}
      {selectedBill && !showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-5xl rounded-xl border border-sage-200 shadow-[0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-sage-100 flex justify-between items-center bg-sage-50/60">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Review &amp; Verify Invoice
                </h3>
                <p className="text-xs text-stone-500">
                  Compare the uploaded receipt against OCR values. Faculty Head can correct any discrepancies before forwarding.
                </p>
              </div>
              <button
                onClick={closeModals}
                className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-sage-100 rounded-md transition cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 text-sm">
              <div className="lg:col-span-6">
                <ReceiptPreviewPane
                  receiptImage={selectedBill.receiptImage}
                  billNo={selectedBill.billNo || selectedBill.id}
                />
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Vendor Name
                    </label>
                    <input
                      type="text"
                      value={editVendorName}
                      onChange={(e) => setEditVendorName(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={editBillNo}
                      onChange={(e) => setEditBillNo(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Bill Date
                    </label>
                    <input
                      type="text"
                      value={editBillDate}
                      onChange={(e) => setEditBillDate(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Vendor GSTIN
                    </label>
                    <input
                      type="text"
                      value={editVendorGstin}
                      onChange={(e) => setEditVendorGstin(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Base Taxable Amount (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBaseAmount}
                      onChange={(e) => setEditBaseAmount(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Grand Total Amount (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={`${inputClass} font-semibold`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      CGST (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCgst}
                      onChange={(e) => setEditCgst(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      SGST (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editSgst}
                      onChange={(e) => setEditSgst(e.target.value)}
                      disabled={!isPendingFaculty}
                      className={inputClass}
                    />
                  </div>
                </div>

                {selectedBill.rejectionReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    <strong className="text-rose-900">Rejection Reason:</strong>{' '}
                    {selectedBill.rejectionReason}
                  </div>
                )}

                {selectedBill.description && (
                  <div className="p-3 bg-sage-50 border border-sage-200 rounded-lg text-xs text-stone-600">
                    <strong className="text-stone-800">Notes:</strong>{' '}
                    {selectedBill.description}
                  </div>
                )}

                {isPendingFaculty && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Audit Notes
                    </label>
                    <textarea
                      rows={2}
                      value={facultyRemark}
                      onChange={(e) => setFacultyRemark(e.target.value)}
                      placeholder="Verification remarks..."
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-sage-100 bg-sage-50/50 flex justify-end gap-2.5">
              <button
                onClick={closeModals}
                className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>
              {isPendingFaculty && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    {actionLoading ? 'Updating...' : 'Confirm & Forward'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL (COMPULSORY REMARK) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-xl border border-sage-200 shadow-[0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60">
              <h3 className="text-base font-semibold text-stone-900">
                Rejection Feedback
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Reason
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className={inputClass}
                >
                  <option value="Amount doesn't match the bill">
                    Amount doesn&apos;t match the bill
                  </option>
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

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Compulsory Rejection Remark *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  placeholder="Enter compulsory remark explaining why this bill is rejected..."
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBillForAudit && (
        <AuditLogModal
          billId={selectedBillForAudit}
          onClose={() => setSelectedBillForAudit(null)}
        />
      )}
    </div>
  );
}