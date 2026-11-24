import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import MasterEventExplorer from './MasterEventExplorer';
import { MasterEventAnalytics } from './AnalyticsCharts';

function getStatusBadgeClass(status) {
  if (status === 'APPROVED') return 'bg-sage-100 text-sage-800 border-sage-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function StorekeeperDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Folders'); // 'Folders' | 'Queue' | 'Ledger' | 'Profile'
  const [bills, setBills] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Filters for Ledger
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Verification & Rejection Modals (strictly read-only OCR details)
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);
  const [auditRemark, setAuditRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(
    'Discrepancy in recorded ledger'
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

      setAllEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (error) {
      console.error('Failed to sync Storekeeper data:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to sync data.'
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
    setAuditRemark('');
    setRejectionRemark('');
    setRejectionReason('Discrepancy in recorded ledger');
  };

  const handleStorekeeperApprove = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await backendApi.put(`/bills/${selectedBill.id}/status`, {
        status: 'APPROVED',
        role: 'STOREKEEPER',
        actorId: user?.id,
        remark:
          auditRemark ||
          'Physical inventory verified and logged in store register book.',
      });
      showMessage(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} recorded in stock book and fully approved.`
      );
      closeModals();
      await fetchData();
    } catch (error) {
      console.error('Storekeeper logging failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to record bill.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Step-back rejection loop: compulsory remark, steps back to Principal stage
  const handleConfirmReject = async () => {
    if (!selectedBill) return;
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
        role: 'STOREKEEPER',
        actorId: user?.id,
        remark: rejectionRemark.trim(),
        rejectionReason,
        rejectedBy: 'STOREKEEPER',
      });
      showMessage(
        'success',
        `Bill #${selectedBill.billNo || selectedBill.id} rejected and stepped back with compulsory remark.`
      );
      closeModals();
      await fetchData();
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

  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GOVERNMENT COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text('STORE REGISTER & AUDIT CERTIFICATION', 105, 28, {
      align: 'center',
    });
    doc.line(15, 32, 195, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Voucher ID: BS-STK-${bill.id}`, 16, 42);
    doc.text(`Invoice No: ${bill.billNo || 'N/A'}`, 130, 42);
    doc.text(`Vendor: ${bill.vendorName || 'N/A'}`, 16, 50);
    doc.text(`Date: ${bill.billDate || 'N/A'}`, 130, 50);
    doc.text(`Event Folder: ${bill.eventName || 'Event'}`, 16, 58);
    doc.text(`Workflow Stage: ${bill.status}`, 130, 58);

    doc.rect(15, 66, 180, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL AUDIT PARTICULARS', 20, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Taxable Base: INR ${Number(bill.baseAmount || bill.amount || 0).toFixed(2)}`,
      20,
      84
    );
    doc.text(
      `Tax (CGST+SGST): INR ${(
        Number(bill.cgst || 0) + Number(bill.sgst || 0)
      ).toFixed(2)}`,
      110,
      84
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Grand Total Amount: INR ${Number(bill.amount || 0).toFixed(2)}`,
      20,
      96
    );
    doc.text(
      `Approved Running Total: INR ${Number(bill.runningTotal || 0).toFixed(2)}`,
      110,
      96
    );

    doc.save(`Store_Voucher_${bill.billNo || bill.id}.pdf`);
  };

  const masterEvents = allEvents.filter(
    (ev) => ev.parentEventId === null || ev.parentEventId === undefined
  );
  const subEvents = allEvents.filter(
    (ev) => ev.parentEventId !== null && ev.parentEventId !== undefined
  );

  const generateMasterEventPdf = () => {
    const doc = new jsPDF();
    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('STORE REGISTER MASTER PORTFOLIO', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Master Events: ${masterEvents.length} | Sub-Events: ${subEvents.length} | Generated: ${new Date().toLocaleDateString()}`,
      14,
      27
    );

    const totalBudget = (
      masterEvents.length > 0 ? masterEvents : subEvents
    ).reduce((acc, ev) => acc + (Number(ev.budgetCap) || 0), 0);
    const totalSpent = bills
      .filter((b) => b.status === 'APPROVED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Financial Overview', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      `Total Budget: INR ${totalBudget.toLocaleString('en-IN')} | Approved Spend: INR ${totalSpent.toLocaleString('en-IN')}`,
      14,
      54
    );

    doc.save('BillStack_Store_Register.pdf');
  };

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof onLogout === 'function') onLogout();
    navigate('/', { replace: true });
  };

  const totalFestBudget = (
    masterEvents.length > 0 ? masterEvents : subEvents
  ).reduce((acc, ev) => acc + (Number(ev.budgetCap) || 0), 0);
  const totalFestAdvance = subEvents.reduce(
    (acc, s) => acc + (Number(s.advanceDisbursed) || 0),
    0
  );
  const pendingStorekeeperBills = bills.filter(
    (b) => b.status === 'PENDING_STOREKEEPER'
  );
  const totalApprovedOutflow = bills
    .filter((b) => b.status === 'APPROVED')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const filteredMasterBills = bills.filter((b) => {
    const matchesStatus =
      statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch =
      b.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.billNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.eventName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const navItems = [
    { id: 'Folders', label: 'Master Events', count: masterEvents.length },
    {
      id: 'Queue',
      label: 'Storekeeper Queue',
      count: pendingStorekeeperBills.length,
    },
    { id: 'Ledger', label: 'Master Bills Ledger', count: bills.length },
    { id: 'Profile', label: 'Profile' },
  ];

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

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
                Storekeeper Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {user?.name || user?.username || 'Storekeeper'}
            </span>
            <button
              onClick={generateMasterEventPdf}
              className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Export Register
            </button>
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

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Total Budget
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalFestBudget.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {masterEvents.length} Master &middot; {subEvents.length}{' '}
                  Sub-Events
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Advances Disbursed
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalFestAdvance.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400 mt-1">Cash advances</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Storekeeper Queue
                </p>
                <p className="text-2xl font-semibold text-sage-700 mt-1.5">
                  {pendingStorekeeperBills.length}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  Awaiting stock logging
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Approved Expenditure
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalApprovedOutflow.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-stone-400 mt-1">Logged bills only</p>
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
                    pendingStatus="PENDING_STOREKEEPER"
                    onReviewBill={(b) => setSelectedBill(b)}
                    onDownloadPdf={(b) => generateVoucherPdf(b)}
                    onAuditLogs={(billId) => setSelectedBillForAudit(billId)}
                    reviewButtonLabel={(b) =>
                      b.status === 'PENDING_STOREKEEPER'
                        ? 'Review & Log'
                        : 'View'
                    }
                  />
                </div>
              ))}

            {/* STOREKEEPER QUEUE TAB */}
            {activeTab === 'Queue' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Pending Store Register Logging (
                  {pendingStorekeeperBills.length})
                </h2>

                {loading ? (
                  <div className="py-10 text-center text-xs text-stone-500">
                    Loading queue...
                  </div>
                ) : pendingStorekeeperBills.length === 0 ? (
                  <div className="py-10 text-center bg-sage-50/50 border border-sage-200/80 rounded-lg text-xs text-stone-500">
                    No bills currently pending Storekeeper verification.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingStorekeeperBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="bg-sage-50/35 border border-sage-200 p-5 rounded-xl space-y-4"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <span className="text-sm font-semibold text-stone-900 block">
                              {bill.vendorName}
                            </span>
                            <span className="text-[11px] font-mono text-stone-500">
                              Invoice #{bill.billNo || bill.id}
                            </span>
                            <p className="text-xs text-stone-500 mt-1">
                              {bill.eventName || 'General'} &middot;{' '}
                              {bill.billDate || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-semibold text-stone-900 block">
                              INR {Number(bill.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setSelectedBill(bill)}
                            className="flex-1 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            Review &amp; Log
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBill(bill);
                              setRejectionRemark('');
                              setShowRejectModal(true);
                            }}
                            className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedBillForAudit(bill.id)}
                            className="px-3 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            Logs
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* MASTER BILLS LEDGER TAB */}
            {activeTab === 'Ledger' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-sage-100">
                  <h2 className="text-base font-semibold text-stone-900">
                    Master Bills Ledger ({filteredMasterBills.length})
                  </h2>
                  <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Search vendor, invoice, event..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-white border border-sage-200 rounded-lg px-3.5 py-2 text-xs text-stone-800 placeholder-stone-400 w-full md:w-60 outline-none focus:border-sage-500"
                    />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-sage-200 rounded-lg px-3 py-2 text-xs font-medium text-stone-700 outline-none focus:border-sage-500"
                    >
                      <option value="All">All Statuses</option>
                      <option value="PENDING_FACULTY">Faculty Review</option>
                      <option value="PENDING_MAIN_HEAD">Main Head</option>
                      <option value="PENDING_PRINCIPAL">Principal</option>
                      <option value="PENDING_STOREKEEPER">Storekeeper</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>

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
                      {filteredMasterBills.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-sage-50/50 transition"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-stone-600">
                            {b.billNo || b.id}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-stone-900 block">
                              {b.vendorName}
                            </span>
                            <span className="text-xs text-stone-500">
                              {b.eventName || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-900">
                            INR {Number(b.amount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getStatusBadgeClass(
                                b.status
                              )}`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => setSelectedBill(b)}
                                className="px-2.5 py-1 bg-sage-600 hover:bg-sage-700 text-white rounded-md text-xs font-medium cursor-pointer"
                              >
                                {b.status === 'PENDING_STOREKEEPER'
                                  ? 'Review'
                                  : 'View'}
                              </button>
                              <button
                                onClick={() => generateVoucherPdf(b)}
                                className="text-sage-700 text-xs font-medium hover:text-sage-900 cursor-pointer"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => setSelectedBillForAudit(b.id)}
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
                      {user?.role || 'STOREKEEPER'}
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

      {/* SIDE-BY-SIDE VERIFY & LOG MODAL (STRICTLY READ-ONLY OCR DETAILS) */}
      {selectedBill && !showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 w-full max-w-5xl rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Store Register Verification
                </h3>
                <p className="text-xs text-stone-500">
                  Verify the scanned receipt against final sanctioned particulars (read-only) before logging into the store register.
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

                {selectedBill.description && (
                  <div className="p-3 bg-white border border-sage-200 rounded-lg text-xs text-stone-600">
                    <strong className="text-stone-800">
                      Prior Audit Notes:
                    </strong>{' '}
                    {selectedBill.description}
                  </div>
                )}

                {selectedBill.status === 'PENDING_STOREKEEPER' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1.5">
                      Stock Register Note
                    </label>
                    <textarea
                      rows={2}
                      value={auditRemark}
                      onChange={(e) => setAuditRemark(e.target.value)}
                      placeholder="Stock entry reference..."
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
              {selectedBill.status === 'PENDING_STOREKEEPER' && (
                <>
                  <button
                    onClick={() => {
                      setRejectionRemark('');
                      setShowRejectModal(true);
                    }}
                    className="px-4 py-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleStorekeeperApprove}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {actionLoading ? 'Processing...' : 'Log & Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (COMPULSORY REMARK) */}
      {selectedBill && showRejectModal && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 w-full max-w-md rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-6 space-y-4">
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
                <option value="Discrepancy in recorded ledger">
                  Discrepancy in recorded ledger
                </option>
                <option value="Missing physical receipt">
                  Missing physical receipt
                </option>
                <option value="Budget quota exceeded">
                  Budget quota exceeded
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