import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import MasterEventExplorer from './MasterEventExplorer';

export default function AccountsDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Folders'); // 'Folders' | 'Settlements' | 'Profile'
  const [bills, setBills] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Read-only bill inspection & audit logs
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);

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
      console.error('Failed to sync Accounts data:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to load accounts ledger.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const getApprovedSpentForSubEvent = (se) =>
    bills
      .filter(
        (b) =>
          b.status === 'APPROVED' &&
          ((b.subEventId !== null &&
            b.subEventId !== undefined &&
            String(b.subEventId) === String(se.id)) ||
            (b.eventName &&
              se.name &&
              b.eventName.toLowerCase().trim() === se.name.toLowerCase().trim()))
      )
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const handleDisburseSubEvent = async (subEvent) => {
    const approvedSpent = getApprovedSpentForSubEvent(subEvent);
    const advance = Number(subEvent.advanceDisbursed) || 0;
    const netSettlement = approvedSpent - advance;
    const label =
      netSettlement >= 0
        ? `Reimburse INR ${netSettlement.toLocaleString('en-IN')}`
        : `Recover INR ${Math.abs(netSettlement).toLocaleString('en-IN')}`;

    if (
      !window.confirm(
        `Authorize final disbursement for "${subEvent.name}"?\nApproved Spend: INR ${approvedSpent.toLocaleString('en-IN')}\nAdvance Disbursed: INR ${advance.toLocaleString('en-IN')}\nNet Settlement: ${label}`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await backendApi.post(`/subevents/${subEvent.id}/disburse`);
      showMessage(
        'success',
        `Disbursement authorized for "${subEvent.name}" (${label}).`
      );
      await fetchData();
    } catch (error) {
      console.error('Disbursement failed:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to authorize disbursement.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const generateSubEventPdf = (subEvent, approvedSpent) => {
    const doc = new jsPDF();
    const advance = Number(subEvent.advanceDisbursed) || 0;
    const cap = Number(subEvent.budgetCap) || 0;
    const netSettlement = approvedSpent - advance;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ACCOUNTS SECTION — SUB-EVENT SETTLEMENT STATEMENT', 105, 20, {
      align: 'center',
    });
    doc.line(15, 26, 195, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Sub-Event: ${subEvent.name}`, 16, 36);
    doc.text(`Department: ${subEvent.department || 'Institutional'}`, 16, 44);
    doc.text(`Status: ${subEvent.status || 'OPEN'}`, 130, 36);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 130, 44);

    doc.rect(15, 52, 180, 44);
    doc.text(`Sanctioned Budget Cap: INR ${cap.toLocaleString('en-IN')}`, 20, 62);
    doc.text(`Approved Expenditure: INR ${approvedSpent.toLocaleString('en-IN')}`, 20, 72);
    doc.text(`Advance Disbursed: INR ${advance.toLocaleString('en-IN')}`, 20, 82);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Net Settlement (${netSettlement >= 0 ? 'Payable' : 'Refundable'}): INR ${Math.abs(netSettlement).toLocaleString('en-IN')}`,
      20,
      92
    );

    doc.save(`Accounts_Settlement_${(subEvent.name || 'SubEvent').replace(/\s+/g, '_')}.pdf`);
  };

  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ACCOUNTS AUDIT VOUCHER', 105, 20, { align: 'center' });
    doc.line(15, 26, 195, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Invoice No: ${bill.billNo || bill.id}`, 16, 36);
    doc.text(`Date: ${bill.billDate || 'N/A'}`, 130, 36);
    doc.text(`Vendor: ${bill.vendorName || 'N/A'}`, 16, 44);
    doc.text(`GSTIN: ${bill.vendorGstin || 'Unregistered'}`, 130, 44);
    doc.text(`Sub-Event: ${bill.eventName || 'N/A'}`, 16, 52);
    doc.text(`Status: ${bill.status}`, 130, 52);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: INR ${Number(bill.amount || 0).toFixed(2)}`, 16, 64);

    doc.save(`Accounts_Voucher_${bill.billNo || bill.id}.pdf`);
  };

  const generateMasterLedgerPdf = () => {
    const doc = new jsPDF();
    const totalBudget = (masterEvents.length > 0 ? masterEvents : subEvents).reduce(
      (acc, ev) => acc + (Number(ev.budgetCap) || 0),
      0
    );
    const totalApproved = bills
      .filter((b) => b.status === 'APPROVED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const totalAdvance = subEvents.reduce(
      (sum, s) => sum + (Number(s.advanceDisbursed) || 0),
      0
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ACCOUNTS MASTER DISBURSEMENT LEDGER', 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Total Master Budget: INR ${totalBudget.toLocaleString('en-IN')}`, 14, 40);
    doc.text(`Total Approved Expenditure: INR ${totalApproved.toLocaleString('en-IN')}`, 14, 48);
    doc.text(`Total Cash Advances: INR ${totalAdvance.toLocaleString('en-IN')}`, 14, 56);
    doc.text(
      `Net Settlement Position: INR ${(totalApproved - totalAdvance).toLocaleString('en-IN')}`,
      14,
      64
    );

    doc.save('BillStack_Accounts_Master_Ledger.pdf');
  };

  // Approved-only top KPIs
  const totalBudget = (masterEvents.length > 0 ? masterEvents : subEvents).reduce(
    (acc, ev) => acc + (Number(ev.budgetCap) || 0),
    0
  );
  const totalAdvance = subEvents.reduce(
    (acc, s) => acc + (Number(s.advanceDisbursed) || 0),
    0
  );
  const totalApprovedSpend = bills
    .filter((b) => b.status === 'APPROVED')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const netSettlementTotal = totalApprovedSpend - totalAdvance;

  const navItems = [
    { id: 'Folders', label: 'Master Events', count: masterEvents.length },
    { id: 'Settlements', label: 'Settlement Tracker', count: subEvents.length },
    { id: 'Profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-sage-50 text-stone-800 flex flex-col font-sans">
      <header className="bg-white border-b border-sage-200 sticky top-0 z-30">
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-sage-600" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sage-900">BillStack</span>
              <span className="text-stone-300">/</span>
              <h1 className="text-sm font-medium text-stone-700">Accounts Section Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {user?.name || user?.username || 'Accounts'}
            </span>
            <button
              onClick={generateMasterLedgerPdf}
              className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Export Ledger
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
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white text-stone-600 border border-sage-200">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Mobile Nav */}
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
                <p className="text-xs font-medium text-stone-500">Total Master Budget</p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalBudget.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">Approved Expenditure</p>
                <p className="text-2xl font-semibold text-sage-800 mt-1.5">
                  INR {totalApprovedSpend.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">Advances Disbursed</p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {totalAdvance.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <p className="text-xs font-medium text-stone-500">
                  Net Settlement ({netSettlementTotal >= 0 ? 'Payable' : 'Refundable'})
                </p>
                <p className="text-2xl font-semibold text-stone-900 mt-1.5">
                  INR {Math.abs(netSettlementTotal).toLocaleString('en-IN')}
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
                <MasterEventExplorer
                  allEvents={allEvents}
                  bills={bills}
                  onReviewBill={(b) => setSelectedBill(b)}
                  onDownloadPdf={(b) => generateVoucherPdf(b)}
                  onAuditLogs={(billId) => setSelectedBillForAudit(billId)}
                  reviewButtonLabel={() => 'View Bill'}
                  renderSubEventActions={(subEvent, approvedSpent) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateSubEventPdf(subEvent, approvedSpent)}
                        className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Export Statement PDF
                      </button>
                      {subEvent.status !== 'DISBURSED' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleDisburseSubEvent(subEvent)}
                          className="px-3.5 py-1.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white rounded-lg text-xs font-medium cursor-pointer"
                        >
                          Authorize Disbursement
                        </button>
                      )}
                    </div>
                  )}
                />
              ))}

            {/* SETTLEMENT TRACKER TAB */}
            {activeTab === 'Settlements' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Sub-Event Disbursement &amp; Settlement Tracker ({subEvents.length})
                </h2>

                {subEvents.length === 0 ? (
                  <div className="py-10 text-center text-xs text-stone-500 bg-sage-50/50 border border-sage-200/80 rounded-lg">
                    No sub-events recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-sage-200 rounded-lg">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-sage-50 text-stone-600 text-xs font-medium border-b border-sage-200">
                        <tr>
                          <th className="py-3 px-4">Sub-Event</th>
                          <th className="py-3 px-4">Budget Cap</th>
                          <th className="py-3 px-4">Approved Spend</th>
                          <th className="py-3 px-4">Advance</th>
                          <th className="py-3 px-4">Net Settlement</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sage-100 text-stone-800">
                        {subEvents.map((se) => {
                          const approvedSpent = getApprovedSpentForSubEvent(se);
                          const advance = Number(se.advanceDisbursed) || 0;
                          const net = approvedSpent - advance;

                          return (
                            <tr key={se.id} className="hover:bg-sage-50/40">
                              <td className="py-3 px-4">
                                <span className="font-medium text-stone-900 block">
                                  {se.name}
                                </span>
                                <span className="text-xs text-stone-500">
                                  {se.department || 'Institutional'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs">
                                INR {Number(se.budgetCap || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-xs font-medium text-sage-800">
                                INR {approvedSpent.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-xs">
                                INR {advance.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold">
                                {net >= 0 ? 'Pay ' : 'Recover '}INR{' '}
                                {Math.abs(net).toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md border text-[11px] font-medium bg-sage-50 border-sage-200 text-sage-800">
                                  {se.status || 'OPEN'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => generateSubEventPdf(se, approvedSpent)}
                                    className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
                                  >
                                    PDF
                                  </button>
                                  {se.status !== 'DISBURSED' && (
                                    <button
                                      onClick={() => handleDisburseSubEvent(se)}
                                      disabled={actionLoading}
                                      className="px-3 py-1 bg-sage-600 hover:bg-sage-700 text-white rounded-md text-xs font-medium cursor-pointer"
                                    >
                                      Disburse
                                    </button>
                                  )}
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
                      {user?.role || 'ACCOUNTS'}
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

      {/* SIDE-BY-SIDE READ-ONLY BILL VIEWER MODAL */}
      {selectedBill && (
        <div className="fixed inset-0 bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 w-full max-w-5xl rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60 flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Bill Audit Details (Read-Only)
                </h3>
                <p className="text-xs text-stone-500">
                  Scanned invoice side-by-side with verified particulars.
                </p>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
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
                    <span className="font-semibold text-stone-700">Grand Total</span>
                    <span className="text-base font-bold text-sage-900">
                      INR {Number(selectedBill.amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {selectedBill.description && (
                  <div className="p-3 bg-white border border-sage-200 rounded-lg text-xs text-stone-600">
                    <strong className="text-stone-800">Audit Notes:</strong>{' '}
                    {selectedBill.description}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-sage-100 bg-sage-50/50 flex justify-end gap-2.5">
              <button
                onClick={() => generateVoucherPdf(selectedBill)}
                className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-sage-800 rounded-lg text-xs font-medium cursor-pointer"
              >
                Export Voucher PDF
              </button>
              <button
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Close
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