import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import { MasterEventAnalytics, SubEventAnalytics } from './AnalyticsCharts';

function formatDateDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function parseIdList(csvOrArray) {
  if (!csvOrArray) return [];
  if (Array.isArray(csvOrArray)) {
    return csvOrArray
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  return String(csvOrArray)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

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

export default function MainEventHeadDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  // Always opens on the Overview page on login
  const [activeTab, setActiveTab] = useState('overview');
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Folder inspector modal state
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Bill Review & OCR Override modal state
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [editVendorName, setEditVendorName] = useState('');
  const [editBillNo, setEditBillNo] = useState('');
  const [editBillDate, setEditBillDate] = useState('');
  const [editVendorGstin, setEditVendorGstin] = useState('');
  const [editBaseAmount, setEditBaseAmount] = useState('');
  const [editCgst, setEditCgst] = useState(0);
  const [editSgst, setEditSgst] = useState(0);
  const [editAmount, setEditAmount] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(
    "Amount doesn't match the bill"
  );
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [closingMasterId, setClosingMasterId] = useState(null);

  const todayStr = formatDateDDMMYYYY();
  const currentUserId = Number(user?.id);

  const showBanner = useCallback((type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof onLogout === 'function') onLogout();
    navigate('/', { replace: true });
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, billsRes] = await Promise.all([
        backendApi.get('/subevents', {
          params: {
            userId: user?.id,
            role: user?.role || 'MAIN_EVENT_HEAD',
          },
        }),
        backendApi.get('/bills').catch(() => ({ data: [] })),
      ]);

      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (err) {
      console.error('Failed to load Main Event Head data:', err);
      showBanner('error', 'Failed to load assigned Master Event data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, showBanner]);

  useEffect(() => {
    setActiveTab('overview');
    fetchDashboardData();
  }, [user?.id, fetchDashboardData]);

  const assignedMasterEvents = useMemo(() => {
    if (!Number.isFinite(currentUserId)) return [];
    return events
      .filter((ev) => {
        if (ev.parentEventId != null) return false;
        const mainHeadList = parseIdList(ev.mainHeadIds);
        const isMain =
          (ev.mainHeadId != null && Number(ev.mainHeadId) === currentUserId) ||
          mainHeadList.includes(currentUserId);
        const isStudentHead = parseIdList(ev.studentHeadIds).includes(
          currentUserId
        );
        return isMain || isStudentHead;
      })
      .sort((a, b) => (Number(b.eventYear) || 0) - (Number(a.eventYear) || 0));
  }, [events, currentUserId]);

  const assignedMasterIds = useMemo(
    () => new Set(assignedMasterEvents.map((m) => Number(m.id))),
    [assignedMasterEvents]
  );

  const masterStatusById = useMemo(() => {
    const map = new Map();
    assignedMasterEvents.forEach((m) => {
      map.set(Number(m.id), String(m.status || '').toUpperCase());
    });
    return map;
  }, [assignedMasterEvents]);

  const isSubEventClosed = useCallback(
    (se) => {
      if (!se) return false;
      if (String(se.status || '').toUpperCase() === 'CLOSED') return true;
      if (se.parentEventId != null) {
        return masterStatusById.get(Number(se.parentEventId)) === 'CLOSED';
      }
      return false;
    },
    [masterStatusById]
  );

  const scopedSubEvents = useMemo(() => {
    return events.filter(
      (ev) =>
        ev.parentEventId != null &&
        assignedMasterIds.has(Number(ev.parentEventId))
    );
  }, [events, assignedMasterIds]);

  const scopedSubEventIds = useMemo(
    () => new Set(scopedSubEvents.map((se) => Number(se.id))),
    [scopedSubEvents]
  );

  const scopedBills = useMemo(() => {
    return bills.filter((b) => {
      const subId = b.subEventId ?? b.sub_event_id ?? b.eventId ?? b.event_id;
      return subId != null && scopedSubEventIds.has(Number(subId));
    });
  }, [bills, scopedSubEventIds]);

  const pendingMainHeadBills = useMemo(
    () =>
      scopedBills.filter(
        (b) => b.status === 'PENDING_MAIN_HEAD' && !isSteppedBackOrRejected(b)
      ),
    [scopedBills]
  );

  const rejectedScopedBills = useMemo(
    () => scopedBills.filter((b) => isSteppedBackOrRejected(b)),
    [scopedBills]
  );

  // Check whether a Master Event can be closed: all sub-event bills exist and are APPROVED
  const masterClosureEligibility = useMemo(() => {
    const map = new Map();
    assignedMasterEvents.forEach((m) => {
      const mId = Number(m.id);
      const alreadyClosed = String(m.status || '').toUpperCase() === 'CLOSED';
      const children = scopedSubEvents.filter(
        (se) => Number(se.parentEventId) === mId
      );
      const childIds = new Set(children.map((c) => Number(c.id)));
      const childBills = scopedBills.filter((b) => {
        const subId = b.subEventId ?? b.sub_event_id ?? b.eventId ?? b.event_id;
        return subId != null && childIds.has(Number(subId));
      });
      const canClose =
        !alreadyClosed &&
        childBills.length > 0 &&
        childBills.every((b) => b.status === 'APPROVED');
      map.set(mId, {
        alreadyClosed,
        canClose,
        totalBills: childBills.length,
        approvedBills: childBills.filter((b) => b.status === 'APPROVED').length,
      });
    });
    return map;
  }, [assignedMasterEvents, scopedSubEvents, scopedBills]);

  const handleCloseMasterEvent = async (masterEvent) => {
    if (!masterEvent?.id) return;
    const info = masterClosureEligibility.get(Number(masterEvent.id));
    if (!info?.canClose) {
      showBanner(
        'error',
        'All bills across all sub-events in this Master Event must be approved before closing.'
      );
      return;
    }

    setClosingMasterId(masterEvent.id);
    try {
      await backendApi.post(`/subevents/${masterEvent.id}/close-master`, {
        userId: user?.id,
        role: user?.role || 'MAIN_EVENT_HEAD',
      });
      showBanner(
        'success',
        `Master Event "${masterEvent.name}" is now CLOSED and read-only.`
      );
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to close Master Event.'
      );
    } finally {
      setClosingMasterId(null);
    }
  };

  // Dynamic totals calculated strictly from fully APPROVED bills
  const totals = useMemo(() => {
    const budget = scopedSubEvents.reduce(
      (sum, se) => sum + (Number(se.budgetCap) || 0),
      0
    );
    const spent = scopedBills
      .filter((b) => b.status === 'APPROVED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const advance = scopedSubEvents.reduce(
      (sum, se) => sum + (Number(se.advanceDisbursed) || 0),
      0
    );
    return { budget, spent, advance };
  }, [scopedSubEvents, scopedBills]);

  const getApprovedSpentForSubEvent = (subEventId) =>
    scopedBills
      .filter(
        (b) =>
          Number(b.subEventId) === Number(subEventId) && b.status === 'APPROVED'
      )
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const handleOpenFolder = async (subEvent) => {
    setSelectedFolder(subEvent);
    setFolderDetail(null);
    setLoadingFolder(true);
    try {
      const res = await backendApi.get(`/subevents/${subEvent.id}`, {
        params: {
          userId: user?.id,
          role: user?.role || 'MAIN_EVENT_HEAD',
        },
      });
      setFolderDetail(res.data);
    } catch (err) {
      console.error('Failed to inspect sub-event folder:', err);
      showBanner(
        'error',
        err.response?.data?.message || 'Unable to open folder.'
      );
      setSelectedFolder(null);
    } finally {
      setLoadingFolder(false);
    }
  };

  const handleOpenReview = (bill) => {
    setSelectedBill(bill);
    setEditVendorName(bill.vendorName || '');
    setEditBillNo(bill.billNo || '');
    setEditBillDate(bill.billDate || '');
    setEditVendorGstin(bill.vendorGstin || '');
    setEditBaseAmount(bill.baseAmount ?? bill.amount ?? '');
    setEditCgst(bill.cgst ?? 0);
    setEditSgst(bill.sgst ?? 0);
    setEditAmount(bill.amount ?? '');
    setReviewRemark('');
    setRejectionRemark('');
  };

  const closeReviewModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setReviewRemark('');
    setRejectionRemark('');
    setRejectionReason("Amount doesn't match the bill");
  };

  const handleApproveBill = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'APPROVED',
        role: 'MAIN_EVENT_HEAD',
        actorId: user?.id,
        remark: reviewRemark || 'Verified and forwarded by Main Event Head',
        vendorName: editVendorName,
        billNo: editBillNo,
        billDate: editBillDate,
        vendorGstin: editVendorGstin,
        baseAmount: parseFloat(editBaseAmount) || selectedBill.baseAmount,
        cgst: parseFloat(editCgst) || 0,
        sgst: parseFloat(editSgst) || 0,
        amount: parseFloat(editAmount) || selectedBill.amount,
      });
      showBanner(
        'success',
        `Bill #${editBillNo || selectedBill.billNo} approved and forwarded to Principal.`
      );
      closeReviewModals();
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to approve bill.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Step-back rejection loop: compulsory remark, returns to previous stage and appears in Rejected
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
    if (!rejectionRemark.trim()) {
      showBanner(
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
        role: 'MAIN_EVENT_HEAD',
        actorId: user?.id,
        remark: rejectionRemark.trim(),
        rejectionReason,
        rejectedBy: 'MAIN_EVENT_HEAD',
      });
      showBanner(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} rejected and moved to Rejected bills.`
      );
      closeReviewModals();
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to reject bill.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const folderBills = useMemo(() => {
    if (!selectedFolder) return [];
    return scopedBills.filter((b) => {
      const subId = b.subEventId ?? b.sub_event_id ?? b.eventId ?? b.event_id;
      return Number(subId) === Number(selectedFolder.id);
    });
  }, [scopedBills, selectedFolder]);

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition disabled:bg-sage-50 disabled:text-stone-600';

  const navItems = [
    { id: 'overview', label: 'Overview' },
    {
      id: 'pending',
      label: 'Pending Approvals',
      count: pendingMainHeadBills.length,
    },
    {
      id: 'rejected',
      label: 'Rejected Bills',
      count: rejectedScopedBills.length,
    },
    { id: 'all', label: 'All Scoped Bills', count: scopedBills.length },
    { id: 'folders', label: 'Sub-Event Folders', count: scopedSubEvents.length },
    { id: 'profile', label: 'Profile' },
  ];

  const displayedBills =
    activeTab === 'pending'
      ? pendingMainHeadBills
      : activeTab === 'rejected'
      ? rejectedScopedBills
      : scopedBills;

  const isPendingMainHead =
    selectedBill?.status === 'PENDING_MAIN_HEAD' &&
    !isSteppedBackOrRejected(selectedBill) &&
    !isSubEventClosed(
      scopedSubEvents.find(
        (se) => Number(se.id) === Number(selectedBill?.subEventId)
      )
    );

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
                Main Event Head Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {user?.name || user?.username}
            </span>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Refresh
            </button>
            <button
              type="button"
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
            {navItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-sage-100 text-sage-900 border border-sage-200'
                    : 'text-stone-600 hover:bg-sage-50 hover:text-stone-900'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md border ${
                      tab.id === 'pending' && tab.count > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : tab.id === 'rejected' && tab.count > 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-stone-600 border-sage-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto min-w-0">
          <div className="max-w-6xl mx-auto space-y-6">
            {feedback && (
              <div
                className={`px-4 py-3 rounded-lg text-xs font-medium border ${
                  feedback.type === 'success'
                    ? 'bg-sage-100 text-sage-900 border-sage-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {loading ? (
              <div className="text-sm text-stone-500">
                Loading assigned Master Events...
              </div>
            ) : assignedMasterEvents.length === 0 ? (
              <div className="bg-white border border-sage-200 rounded-xl p-6 text-sm text-stone-600">
                No Master Event is assigned to your account yet. Once an Admin assigns you to a Master Event, its sub-events and bills will appear here.
              </div>
            ) : (
              <>
                <div className="bg-white border border-sage-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                        Scoped Master Event(s)
                      </div>
                      <div className="text-base font-semibold text-stone-900 mt-0.5">
                        {assignedMasterEvents
                          .map(
                            (m) =>
                              `${m.name}${m.eventYear ? ` (${m.eventYear})` : ''}`
                          )
                          .join(', ')}
                      </div>
                    </div>
                    <div className="text-xs text-stone-500">
                      Date: {todayStr} &middot; {scopedSubEvents.length}{' '}
                      Sub-Event{scopedSubEvents.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-sage-100">
                    {assignedMasterEvents.map((m) => {
                      const info = masterClosureEligibility.get(Number(m.id)) || {};
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sage-50/70 border border-sage-200 text-xs"
                        >
                          <span className="font-medium text-stone-900">
                            {m.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-medium ${
                              info.alreadyClosed
                                ? 'bg-stone-200 text-stone-800 border-stone-300'
                                : 'bg-white text-sage-800 border-sage-200'
                            }`}
                          >
                            {info.alreadyClosed
                              ? 'CLOSED (Read-Only)'
                              : m.status || 'ACTIVE'}
                          </span>
                          {!info.alreadyClosed && info.canClose && (
                            <button
                              type="button"
                              disabled={closingMasterId === m.id}
                              onClick={() => handleCloseMasterEvent(m)}
                              className="px-3 py-1 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-md text-xs font-medium cursor-pointer"
                            >
                              {closingMasterId === m.id
                                ? 'Closing...'
                                : 'Close Master Event'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Scoped Budget Cap
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-1.5">
                          INR {totals.budget.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Approved Expenditure
                        </div>
                        <div className="text-2xl font-semibold text-sage-800 mt-1.5">
                          INR {totals.spent.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Remaining Balance
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-1.5">
                          INR{' '}
                          {(totals.budget - totals.spent).toLocaleString(
                            'en-IN'
                          )}
                        </div>
                      </div>
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Advance Disbursed
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-1.5">
                          INR {totals.advance.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <MasterEventAnalytics
                      masterEvents={assignedMasterEvents}
                      subEvents={scopedSubEvents}
                      bills={scopedBills}
                    />
                  </div>
                )}

                {(activeTab === 'pending' ||
                  activeTab === 'rejected' ||
                  activeTab === 'all') && (
                  <section className="bg-white p-6 rounded-xl border border-sage-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-sage-100">
                      <h2 className="text-base font-semibold text-stone-900">
                        {activeTab === 'pending'
                          ? `Pending Main Event Head Review (${pendingMainHeadBills.length})`
                          : activeTab === 'rejected'
                          ? `Rejected / Stepped-Back Bills (${rejectedScopedBills.length})`
                          : `All Scoped Bills (${scopedBills.length})`}
                      </h2>
                    </div>

                    {displayedBills.length === 0 ? (
                      <div className="py-10 text-center text-xs text-stone-500 bg-sage-50/50 border border-sage-200/80 rounded-lg">
                        No bills found in this view.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-sage-200 rounded-lg">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-sage-50 text-stone-600 text-xs font-medium border-b border-sage-200">
                              <th className="py-3 px-4">Bill No</th>
                              <th className="py-3 px-4">Vendor &amp; Sub-Event</th>
                              <th className="py-3 px-4">Amount</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sage-100">
                            {displayedBills.map((bill) => {
                              const rejectedFlag = isSteppedBackOrRejected(bill);
                              const parentClosed = isSubEventClosed(
                                scopedSubEvents.find(
                                  (se) => Number(se.id) === Number(bill.subEventId)
                                )
                              );
                              const canReviewRow =
                                !parentClosed &&
                                bill.status === 'PENDING_MAIN_HEAD' &&
                                !rejectedFlag;
                              return (
                                <tr
                                  key={bill.id}
                                  className="hover:bg-sage-50/50"
                                >
                                  <td className="py-3 px-4 font-mono text-xs text-stone-600">
                                    {bill.billNo || bill.id}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="font-medium text-stone-900 block">
                                      {bill.vendorName}
                                    </span>
                                    <span className="text-xs text-stone-500">
                                      {bill.eventName || 'Sub-Event'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-medium text-stone-900">
                                    INR {Number(bill.amount || 0).toFixed(2)}
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
                                        {canReviewRow
                                          ? 'Review & Edit'
                                          : 'View'}
                                      </button>
                                      <button
                                        onClick={() =>
                                          setSelectedBillForAudit(bill.id)
                                        }
                                        className="px-2.5 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
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

                {activeTab === 'folders' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scopedSubEvents.length === 0 ? (
                      <div className="col-span-full bg-white border border-sage-200 rounded-xl p-6 text-sm text-stone-500">
                        No sub-events created under your Master Event(s) yet. Student Heads create sub-events from their portal.
                      </div>
                    ) : (
                      scopedSubEvents.map((se) => {
                        const approvedSpent = getApprovedSpentForSubEvent(se.id);
                        const closed = isSubEventClosed(se);
                        return (
                          <div
                            key={se.id}
                            className="bg-white border border-sage-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-semibold text-stone-900">
                                  {se.name}
                                </h3>
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                                    closed
                                      ? 'bg-stone-100 border-stone-300 text-stone-800'
                                      : 'bg-sage-50 border-sage-200 text-sage-800'
                                  }`}
                                >
                                  {closed ? 'CLOSED' : se.status || 'ACTIVE'}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-1">
                                {se.department || 'General'}
                              </p>
                              <div className="mt-3 text-xs text-stone-700 flex justify-between">
                                <span>
                                  Approved Spend: INR{' '}
                                  {approvedSpent.toLocaleString('en-IN')}
                                </span>
                                <span>
                                  Cap: INR{' '}
                                  {(Number(se.budgetCap) || 0).toLocaleString(
                                    'en-IN'
                                  )}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenFolder(se)}
                              className="w-full py-2 text-xs font-medium rounded-lg bg-white hover:bg-sage-50 border border-sage-200 text-sage-800 cursor-pointer"
                            >
                              Open Folder
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <section className="bg-white border border-sage-200 rounded-xl p-6 max-w-lg space-y-3 text-sm">
                    <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                      Profile
                    </h2>
                    <div className="flex justify-between py-2 border-b border-sage-100">
                      <span className="text-stone-500">Name</span>
                      <span className="font-medium text-stone-900">
                        {user?.name || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-sage-100">
                      <span className="text-stone-500">Username</span>
                      <span className="font-mono text-stone-800">
                        {user?.username || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-sage-100">
                      <span className="text-stone-500">Department</span>
                      <span className="text-stone-800">
                        {user?.department || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-stone-500">Institutional ID</span>
                      <span className="font-mono text-stone-800">
                        {user?.institutionalId || '—'}
                      </span>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* FOLDER INSPECTOR MODAL */}
      {selectedFolder && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-40">
          <div className="bg-white border border-sage-200 rounded-xl max-w-5xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-sage-100">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Folder: {selectedFolder.name}
                </h3>
                <p className="text-xs text-stone-500">
                  Status:{' '}
                  {isSubEventClosed(selectedFolder)
                    ? 'CLOSED (Read-Only)'
                    : selectedFolder.status || 'ACTIVE'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFolder(null);
                  setFolderDetail(null);
                }}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            {loadingFolder ? (
              <p className="text-xs text-stone-500">Loading folder details...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-sage-50/60 p-4 rounded-lg border border-sage-100">
                  <div>
                    <div className="font-semibold text-stone-700 mb-1">
                      Assigned Coordinators
                    </div>
                    {folderDetail?.coordinators?.length
                      ? folderDetail.coordinators
                          .map((c) => `${c.name} (${c.username})`)
                          .join(', ')
                      : 'None assigned'}
                  </div>
                  <div>
                    <div className="font-semibold text-stone-700 mb-1">
                      Assigned Faculty Heads
                    </div>
                    {folderDetail?.facultyHeads?.length
                      ? folderDetail.facultyHeads
                          .map((f) => `${f.name} (${f.username})`)
                          .join(', ')
                      : 'None assigned'}
                  </div>
                </div>

                <SubEventAnalytics
                  allocatedBudget={Number(selectedFolder.budgetCap) || 0}
                  bills={folderBills}
                />

                <div className="space-y-2">
                  <div className="font-semibold text-sm text-stone-800">
                    Bills in Folder ({folderBills.length})
                  </div>
                  {folderBills.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      No bills linked to this folder.
                    </p>
                  ) : (
                    <div className="border border-sage-200 rounded-lg divide-y divide-sage-100 text-xs">
                      {folderBills.map((b) => {
                        const rejectedFlag = isSteppedBackOrRejected(b);
                        return (
                          <div
                            key={b.id}
                            className="p-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-medium text-stone-900">
                                {b.vendorName}{' '}
                                <span className="font-mono text-stone-500">
                                  #{b.billNo || b.id}
                                </span>
                              </div>
                              <div className="text-stone-500">
                                Status:{' '}
                                {rejectedFlag ? 'REJECTED' : b.status}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-stone-900">
                                INR{' '}
                                {Number(b.amount || 0).toLocaleString('en-IN')}
                              </span>
                              <button
                                onClick={() => handleOpenReview(b)}
                                className="px-3 py-1 bg-sage-600 hover:bg-sage-700 text-white rounded text-xs font-medium cursor-pointer"
                              >
                                {b.status === 'PENDING_MAIN_HEAD' &&
                                !rejectedFlag &&
                                !isSubEventClosed(selectedFolder)
                                  ? 'Review'
                                  : 'View'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE BILL REVIEW & OCR OVERRIDE MODAL */}
      {selectedBill && !showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-5xl rounded-xl border border-sage-200 shadow-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-sage-100 flex justify-between items-center bg-sage-50/60">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Main Event Head Review &amp; OCR Verification
                </h3>
                <p className="text-xs text-stone-500">
                  Verify the scanned bill side-by-side and override OCR details if needed before forwarding to Principal.
                </p>
              </div>
              <button
                onClick={closeReviewModals}
                className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-sage-100 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                      disabled={!isPendingMainHead}
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
                      disabled={!isPendingMainHead}
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
                      disabled={!isPendingMainHead}
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
                      disabled={!isPendingMainHead}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Base Amount (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editBaseAmount}
                      onChange={(e) => setEditBaseAmount(e.target.value)}
                      disabled={!isPendingMainHead}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Grand Total (INR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      disabled={!isPendingMainHead}
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
                      disabled={!isPendingMainHead}
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
                      disabled={!isPendingMainHead}
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
                    <strong className="text-stone-800">Prior Notes:</strong>{' '}
                    {selectedBill.description}
                  </div>
                )}

                {isPendingMainHead && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Main Event Head Audit Remark
                    </label>
                    <textarea
                      rows={2}
                      value={reviewRemark}
                      onChange={(e) => setReviewRemark(e.target.value)}
                      placeholder="Verification remarks..."
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-sage-100 bg-sage-50/50 flex justify-end gap-2.5">
              <button
                onClick={closeReviewModals}
                className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              {isPendingMainHead && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApproveBill}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {actionLoading
                      ? 'Forwarding...'
                      : 'Approve & Forward to Principal'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL (COMPULSORY REMARK) */}
      {selectedBill && showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-xl border border-sage-200 p-6 space-y-4">
            <h3 className="text-base font-semibold text-stone-900">
              Rejection Feedback
            </h3>
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
                placeholder="Enter compulsory remark explaining why this bill is being rejected..."
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-white border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
              </button>
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