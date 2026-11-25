import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import MasterEventExplorer from './MasterEventExplorer';
import { MasterEventAnalytics } from './AnalyticsCharts';

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

export default function PrincipalDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Folders'); // 'Folders' | 'Queue' | 'Rejected' | 'Profile'
  const [bills, setBills] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Sanction & Rejection Modals (strictly read-only OCR details)
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [sanctionRemark, setSanctionRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(
    'Exceeds sanctioned budget cap'
  );
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showMessage = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev.text === text ? { type: '', text: '' } : prev));
    }, 5000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, eventsRes] = await Promise.all([
        backendApi.get('/bills').catch(() => ({ data: [] })),
        backendApi
          .get('/events')
          .catch(() => backendApi.get('/subevents').catch(() => ({ data: [] }))),
      ]);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      setAllEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } catch (error) {
      console.error('Failed to load Principal dashboard data:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to sync dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const closeModals = () => {
    setSelectedBill(null);
    setShowRejectModal(false);
    setSanctionRemark('');
    setRejectionRemark('');
    setRejectionReason('Exceeds sanctioned budget cap');
  };

  const isBillEventClosed = (bill) => {
    if (!bill) return false;
    const subId = bill.subEventId ?? bill.sub_event_id ?? bill.eventId ?? bill.event_id;
    if (subId == null) return false;
    const sub = allEvents.find((ev) => String(ev.id) === String(subId));
    if (!sub) return false;
    if (String(sub.status || '').toUpperCase() === 'CLOSED') return true;
    if (sub.parentEventId != null) {
      const parent = allEvents.find(
        (ev) => String(ev.id) === String(sub.parentEventId)
      );
      if (parent && String(parent.status || '').toUpperCase() === 'CLOSED') {
        return true;
      }
    }
    return false;
  };

  const handleSanction = async () => {
    if (!selectedBill || isBillEventClosed(selectedBill)) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'APPROVED',
        role: 'PRINCIPAL',
        actorId: user?.id,
        remark:
          sanctionRemark ||
          'Sanctioned by Principal and forwarded to Storekeeper.',
      });
      showMessage(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} sanctioned and routed to Storekeeper.`
      );
      closeModals();
      await fetchData();
    } catch (error) {
      console.error('Principal sanction failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to sanction bill.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Step-back rejection loop: compulsory remark, returns to previous stage and appears in Rejected
  const handleConfirmReject = async () => {
    if (!selectedBill || isBillEventClosed(selectedBill)) return;
    if (!rejectionRemark.trim()) {
      showMessage(
        'error',
        'A rejection remark is compulsory when disapproving/rejecting a bill.'
      );
      return;
    }

    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'REJECTED',
        stepBack: true,
        role: 'PRINCIPAL',
        actorId: user?.id,
        remark: rejectionRemark.trim(),
        rejectionReason,
        rejectedBy: 'PRINCIPAL',
      });
      showMessage(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} stepped back and moved to Rejected bills.`
      );
      closeModals();
      await fetchData();
    } catch (error) {
      console.error('Principal rejection failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to record rejection.'
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

  const masterEvents = allEvents.filter(
    (ev) => ev.parentEventId === null || ev.parentEventId === undefined
  );
  const subEvents = allEvents.filter(
    (ev) => ev.parentEventId !== null && ev.parentEventId !== undefined
  );

  const pendingPrincipalBills = bills.filter(
    (b) => b.status === 'PENDING_PRINCIPAL' && !isSteppedBackOrRejected(b)
  );
  const rejectedBills = bills.filter((b) => isSteppedBackOrRejected(b));

  const totalBudgetSanctioned = (
    masterEvents.length > 0 ? masterEvents : subEvents
  ).reduce((acc, ev) => acc + (Number(ev.budgetCap) || 0), 0);
  const totalApprovedSpend = bills
    .filter((b) => b.status === 'APPROVED')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const navItems = [
    { id: 'Folders', label: 'Master Events', count: masterEvents.length },
    {
      id: 'Queue',
      label: 'Sanction Queue',
      count: pendingPrincipalBills.length,
    },
    { id: 'Rejected', label: 'Rejected Bills', count: rejectedBills.length },
    { id: 'Profile', label: 'Profile' },
  ];

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

  const canActOnSelectedPrincipal =
    selectedBill &&
    !isBillEventClosed(selectedBill) &&
    selectedBill.status === 'PENDING_PRINCIPAL' &&
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
                Principal Sanction Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {user?.name || user?.username || 'Principal'}
            </span>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Sync
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
                      item.id === 'Queue' && item.count > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : item.id === 'Rejected' && item.count > 0
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

        <main className="flex-1 p-6 md:p-8 overflow-y-auto min-w-0">
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

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Total Budget Sanctioned
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalBudgetSanctioned.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {masterEvents.length} Master &middot; {subEvents.length}{' '}
                  Sub-Events
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Approved Expenditure
                </p>
                <p className="text-2xl font-semibold text-sage-800 mt-1.5">
                  INR {totalApprovedSpend.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400 mt-1">Approved bills only</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Awaiting Sanction
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  {pendingPrincipalBills.length}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Pending Principal sign-off
                </p>
              </div>
            </section>

            {/* MASTER EVENTS DRILL-DOWN TAB */}
            {activeTab === 'Folders' &&
              (loading ? (
                <div className="bg-white p-10 rounded-xl border border-sage-200 text-center text-xs text-stone-500">
                  Loading master event files...
                </div>
              ) : (
                <div className="space-y-6">
                  <MasterEventAnalytics
                    masterEvents={masterEvents}
                    subEvents={subEvents}
                    bills={bills}
                  />

                  <MasterEventExplorer
                    allEvents={allEvents}
                    bills={bills}
                    pendingStatus="PENDING_PRINCIPAL"
                    onReviewBill={(b) => setSelectedBill(b)}
                    onAuditLogs={(billId) => setSelectedBillForAudit(billId)}
                    reviewButtonLabel={(b) =>
                      b.status === 'PENDING_PRINCIPAL' &&
                      !isSteppedBackOrRejected(b) &&
                      !isBillEventClosed(b)
                        ? 'Inspect & Sanction'
                        : 'View'
                    }
                  />
                </div>
              ))}

            {/* SANCTION QUEUE TAB */}
            {activeTab === 'Queue' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Bills Awaiting Principal Sanction (
                  {pendingPrincipalBills.length})
                </h2>

                {loading ? (
                  <div className="py-10 text-center text-xs text-stone-500">
                    Loading bills...
                  </div>
                ) : pendingPrincipalBills.length === 0 ? (
                  <div className="py-10 text-center bg-sage-50/50 border border-sage-200/80 rounded-lg text-xs text-stone-500">
                    No bills pending Principal sanction right now.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-sage-200 rounded-lg">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-sage-200 bg-sage-50 text-stone-600 text-xs font-medium">
                          <th className="py-3 px-4">Invoice No</th>
                          <th className="py-3 px-4">Vendor &amp; Event</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100 text-stone-800">
                        {pendingPrincipalBills.map((bill) => (
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
                                {bill.eventName || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-stone-900">
                              INR {Number(bill.amount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getStatusBadgeClass(
                                  bill
                                )}`}
                              >
                                {bill.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedBill(bill)}
                                  className="px-3 py-1 bg-sage-600 hover:bg-sage-700 text-white rounded-md text-xs font-medium cursor-pointer"
                                >
                                  Inspect &amp; Sanction
                                </button>
                                <button
                                  onClick={() => setSelectedBillForAudit(bill.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
                                >
                                  Logs
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* REJECTED / STEPPED-BACK BILLS TAB */}
            {activeTab === 'Rejected' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Rejected &amp; Stepped-Back Bills ({rejectedBills.length})
                </h2>

                {rejectedBills.length === 0 ? (
                  <div className="py-10 text-center bg-sage-50/50 border border-sage-200/80 rounded-lg text-xs text-stone-500">
                    No rejected or stepped-back bills.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-sage-200 rounded-lg">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-sage-200 bg-sage-50 text-stone-600 text-xs font-medium">
                          <th className="py-3 px-4">Invoice No</th>
                          <th className="py-3 px-4">Vendor &amp; Event</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Remark / Reason</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100 text-stone-800">
                        {rejectedBills.map((bill) => (
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
                                {bill.eventName || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-stone-900">
                              INR {Number(bill.amount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-xs text-rose-700">
                              {bill.rejectionReason ||
                                bill.remark ||
                                'Rejected / stepped back'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => setSelectedBill(bill)}
                                  className="px-3 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => setSelectedBillForAudit(bill.id)}
                                  className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
                                >
                                  Logs
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'Profile' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-lg space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Profile
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Full Name</span>
                    <span className="font-medium text-stone-900">
                      {user?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Username</span>
                    <span className="font-mono text-stone-800">
                      {user?.username || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Role</span>
                    <span className="font-medium text-sage-800">
                      {user?.role || 'PRINCIPAL'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Department</span>
                    <span className="text-stone-800">
                      {user?.department || 'Institutional'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-stone-500">Staff ID</span>
                    <span className="font-mono text-stone-800">
                      {user?.institutionalId || 'N/A'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* SIDE-BY-SIDE SANCTION MODAL (STRICTLY READ-ONLY OCR DETAILS) */}
      {selectedBill && !showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 w-full max-w-5xl rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Principal Sanction Review
                </h3>
                <p className="text-xs text-stone-500">
                  Inspect the scanned receipt side-by-side with read-only particulars before sanctioning.
                </p>
              </div>
              <button
                onClick={closeModals}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
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
                <div className="bg-sage-50/60 border border-sage-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 block">Vendor Name</span>
                    <span className="font-semibold text-stone-900">
                      {selectedBill.vendorName || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Invoice Number</span>
                    <span className="font-mono font-medium text-stone-900">
                      {selectedBill.billNo || selectedBill.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Bill Date</span>
                    <span className="font-medium text-stone-900">
                      {selectedBill.billDate || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Vendor GSTIN</span>
                    <span className="font-mono text-stone-900">
                      {selectedBill.vendorGstin || 'Unregistered'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Base Amount</span>
                    <span className="font-medium text-stone-900">
                      INR {Number(selectedBill.baseAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">CGST / SGST</span>
                    <span className="font-medium text-stone-900">
                      INR {Number(selectedBill.cgst || 0).toFixed(2)} / INR{' '}
                      {Number(selectedBill.sgst || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-sage-200 flex justify-between items-center">
                    <span className="font-semibold text-stone-700">
                      Grand Total
                    </span>
                    <span className="text-base font-bold text-sage-900">
                      INR{' '}
                      {Number(selectedBill.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {selectedBill.rejectionReason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    <strong className="text-rose-900">Rejection Reason:</strong>{' '}
                    {selectedBill.rejectionReason}
                  </div>
                )}

                {selectedBill.description && (
                  <div className="p-3 bg-white border border-sage-200 rounded-lg text-xs text-stone-600">
                    <strong className="text-stone-800">
                      Prior Audit Notes:
                    </strong>{' '}
                    {selectedBill.description}
                  </div>
                )}

                {canActOnSelectedPrincipal && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1.5">
                      Sanction Note
                    </label>
                    <textarea
                      rows={2}
                      value={sanctionRemark}
                      onChange={(e) => setSanctionRemark(e.target.value)}
                      placeholder="Optional sanction remarks..."
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-sage-100 bg-sage-50/50 flex justify-end gap-2.5">
              <button
                onClick={closeModals}
                className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              {canActOnSelectedPrincipal && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Disapprove
                  </button>
                  <button
                    onClick={handleSanction}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {actionLoading ? 'Sanctioning...' : 'Sanction Bill'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DISAPPROVE MODAL (COMPULSORY REMARK) */}
      {selectedBill && showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 w-full max-w-md rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-6 space-y-4">
            <h3 className="text-base font-semibold text-stone-900">
              Disapproval Feedback
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
                <option value="Exceeds sanctioned budget cap">
                  Exceeds sanctioned budget cap
                </option>
                <option value="Not aligned with institutional norms">
                  Not aligned with institutional norms
                </option>
                <option value="Insufficient supporting documentation">
                  Insufficient supporting documentation
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
                placeholder="Enter compulsory remark explaining why this bill is being stepped back..."
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                {actionLoading ? 'Submitting...' : 'Confirm Disapproval'}
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