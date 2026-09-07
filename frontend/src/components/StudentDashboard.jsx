import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi, ocrApi } from '../services/api';
import axios from 'axios';

export default function StudentDashboard({ user }) {
  const navigate = useNavigate();

  // Navigation
  const [activeTab, setActiveTab] = useState('Dashboard');
  const sidebarItems = ['Dashboard', 'Upload Bill', 'My Bills', 'Budget Overview'];

  // Current User & Assigned Sub-Event Context
  const [currentUser, setCurrentUser] = useState(user);
  const [subEvent, setSubEvent] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);

  // File & OCR States
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extracted Bill Details (Locked read-only for coordinators)
  const [vendorName, setVendorName] = useState('');
  const [billNo, setBillNo] = useState('');
  const [amount, setAmount] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [billDate, setBillDate] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [description, setDescription] = useState('');

  // Bills State
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // 1. Fetch sub-event profile for coordinator
  const fetchSubEventData = useCallback(async () => {
    try {
      setLoadingEvent(true);
      let subEventId = currentUser?.assignedSubEventId;

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
        setFacultyList(res.data.facultyHeads || []);
        fetchBills(res.data.id);
      } else {
        setSubEvent(null);
        setFacultyList([]);
        setBills([]);
      }
    } catch (err) {
      console.error('Failed to fetch assigned sub-event:', err);
    } finally {
      setLoadingEvent(false);
    }
  }, [currentUser]);

  // 2. Fetch bills scoped to this subEventId from backend
  const fetchBills = async (targetSubEventId) => {
    const sId = targetSubEventId || subEvent?.id || currentUser?.assignedSubEventId;
    if (!sId) {
      setBills([]);
      return;
    }

    setLoadingBills(true);
    try {
      const res = await backendApi.get('/bills', {
        params: { subEventId: sId },
      });
      setBills(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Backend unavailable, setting empty bills list:', err);
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchSubEventData();
  }, [fetchSubEventData]);

  // 3. Strict Defensive Sub-Event Scoping
  const scopedBills = subEvent
    ? bills.filter((b) => {
        const matchesId =
          b.subEventId && subEvent.id && String(b.subEventId) === String(subEvent.id);
        const matchesName =
          b.eventName &&
          subEvent.name &&
          b.eventName.toLowerCase().trim() === subEvent.name.toLowerCase().trim();
        return matchesId || matchesName;
      })
    : [];

  // 4. Real-time metrics calculated strictly from scopedBills
  const allocatedBudget = subEvent?.budgetCap ? Number(subEvent.budgetCap) : 0;
  const advancePayment = subEvent?.advanceDisbursed ? Number(subEvent.advanceDisbursed) : 0;
  const totalExpenditure = scopedBills
    .filter((b) => b.status !== 'REJECTED')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBalance = allocatedBudget - totalExpenditure;
  const isBudgetWarning = allocatedBudget > 0 && totalExpenditure / allocatedBudget >= 0.8;

  // File Selection & OCR Extraction
  const handleFileChange = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setFileObject(file);
    setSelectedFile(file.name);
    setFilePreview(URL.createObjectURL(file));
    setIsScanning(true);
    setOcrError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await ocrApi.post('', formData);
      const extracted = response.data?.data || response.data || {};

      setVendorName(extracted.vendorName || extracted.vendor_name || 'Vendor Not Detected');
      setBillNo(extracted.billNo || extracted.bill_number || `GEN-${Date.now().toString().slice(-4)}`);
      setAmount(extracted.amount || extracted.grand_total || extracted.total_amount || '0.00');
      setBaseAmount(extracted.baseAmount || extracted.base_amount || extracted.amount || '0.00');
      setBillDate(extracted.billDate || extracted.bill_date || new Date().toISOString().split('T')[0]);
      setVendorGstin(extracted.vendorGstin || extracted.vendor_gstin || 'Unregistered / None');
      setCgst(extracted.cgst || 0);
      setSgst(extracted.sgst || 0);
      setDescription(`Purchased for ${subEvent?.name || 'Assigned Sub-Event'}`);
    } catch (error) {
      console.error('OCR Extraction Failed:', error);
      setOcrError('OCR microservice is offline or unreachable on port 5000.');
    } finally {
      setIsScanning(false);
    }
  };

  // Submit Bill with Explicit Sub-Event Identity
  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!amount || !vendorName) {
      alert('Cannot submit an empty bill. Please re-upload a clear receipt.');
      return;
    }
    if (!subEvent?.id) {
      alert('You have not been assigned to a sub-event folder yet.');
      return;
    }

    setIsSubmitting(true);
    const parsedAmount = parseFloat(amount) || 0;
    const parsedBaseAmount = parseFloat(baseAmount) || parsedAmount;

    const payload = {
      vendorName,
      billNo: billNo || 'GEN-' + Date.now().toString().slice(-4),
      amount: parsedAmount,
      baseAmount: parsedBaseAmount,
      billDate: billDate || new Date().toISOString().split('T')[0],
      vendorGstin: vendorGstin || 'Unregistered',
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      eventName: subEvent.name,
      subEventId: subEvent.id, // Enforces folder isolation
      description: description || `Submitted by Coordinator ${currentUser?.name || ''}`,
      status: 'PENDING_FACULTY',
    };

    try {
      await backendApi.post('/bills', payload);
      alert('Bill successfully submitted to the approval conveyor belt!');
      setSelectedFile(null);
      setFileObject(null);
      setFilePreview(null);
      setVendorName('');
      setBillNo('');
      setAmount('');
      setBaseAmount('');
      setBillDate('');
      setVendorGstin('');
      setCgst(0);
      setSgst(0);
      setDescription('');
      setOcrError('');
      fetchBills(subEvent.id);
      fetchSubEventData();
      setActiveTab('My Bills');
    } catch (error) {
      console.error('Backend submission failed:', error);
      alert(error.response?.data?.message || 'Failed to connect to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Duplex PDF Voucher Generator
  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GOVERNMENT COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('WINGS TECHNICAL FEST - EXPENSE VOUCHER', 105, 28, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(15, 32, 195, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Voucher ID: BS-V-${bill.id || 'TEMP'}`, 16, 42);
    doc.text(`Date of Submission: ${bill.billDate || 'N/A'}`, 130, 42);
    doc.text(`Event / Sub-Event: ${bill.eventName || subEvent?.name || 'N/A'}`, 16, 50);
    doc.text(`Coordinator: ${currentUser?.name || 'Coordinator'}`, 130, 50);

    doc.rect(15, 56, 180, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSE AUDIT PARTICULARS', 20, 64);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vendor Name: ${bill.vendorName || 'N/A'}`, 20, 74);
    doc.text(`Vendor GSTIN: ${bill.vendorGstin || 'Unregistered / N/A'}`, 110, 74);
    doc.text(`Bill / Invoice No: ${bill.billNo || 'N/A'}`, 20, 84);
    doc.text(`Current Bill Amount: Rs. ${Number(bill.amount).toFixed(2)}`, 110, 84);
    doc.text(`Allocated Sub-Event Budget: Rs. ${allocatedBudget.toFixed(2)}`, 20, 94);
    doc.text(`Running Total Incurred: Rs. ${(bill.runningTotal || bill.amount).toFixed(2)}`, 110, 94);

    const sigY = 130;
    doc.rect(15, sigY, 180, 35);
    doc.line(60, sigY, 60, sigY + 35);
    doc.line(105, sigY, 105, sigY + 35);
    doc.line(150, sigY, 150, sigY + 35);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('EVENT HEAD', 25, sigY + 8);
    doc.text('FACULTY HEAD', 68, sigY + 8);
    doc.text('STOREKEEPER', 114, sigY + 8);
    doc.text('PRINCIPAL', 160, sigY + 8);

    doc.setFont('helvetica', 'italic');
    doc.text('Signed Digitally', 24, sigY + 28);
    doc.text(bill.status !== 'PENDING_FACULTY' ? 'Approved' : 'Pending', 72, sigY + 28);
    doc.text(bill.status === 'APPROVED' ? 'Recorded' : 'Pending', 118, sigY + 28);
    doc.text(bill.status === 'APPROVED' ? 'Approved' : 'Pending', 162, sigY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Note: Page 1 of Duplex Audit Record. Physical bill attached on reverse.', 105, 180, { align: 'center' });

    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ATTACHED RECEIPT / TAX INVOICE (BACKSIDE)', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill Ref No: ${bill.billNo || 'N/A'} | Vendor: ${bill.vendorName || 'N/A'}`, 105, 28, { align: 'center' });

    doc.setDrawColor(180, 180, 180);
    doc.rect(20, 40, 170, 220);
    doc.text('[ Physical Bill Image Affixed Here for Audit Inspection ]', 105, 140, { align: 'center' });

    doc.save(`Voucher_${bill.billNo || 'BillStack'}.pdf`);
  };

  const renderConveyorStep = (currentStatus, stepIndex) => {
    const stages = ['PENDING_FACULTY', 'PENDING_PRINCIPAL', 'PENDING_STOREKEEPER', 'APPROVED'];
    const currentIdx = stages.indexOf(currentStatus);
    const isComplete = currentIdx > stepIndex || currentStatus === 'APPROVED';
    const isCurrent = currentIdx === stepIndex;

    if (currentStatus === 'REJECTED') return 'bg-rose-500 text-white border-rose-600';
    if (isComplete) return 'bg-emerald-500 text-white border-emerald-600';
    if (isCurrent) return 'bg-violet-600 text-white border-violet-700 animate-pulse';
    return 'bg-slate-100 text-slate-400 border-slate-200';
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
              <h1 className="text-lg font-bold tracking-tight text-white">BillStack</h1>
              <p className="text-xs text-violet-300 font-medium">Event Coordinator</p>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            {sidebarItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-3 ${
                  activeTab === item
                    ? 'bg-violet-800 text-white shadow-sm'
                    : 'text-violet-200 hover:bg-violet-900/50 hover:text-white'
                }`}
              >
                <span>{item === 'Dashboard' ? '📊' : item === 'Upload Bill' ? '📤' : item === 'My Bills' ? '📑' : '💰'}</span>
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-violet-800/60">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-sm font-bold">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'C'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{currentUser?.name || 'Coordinator'}</p>
              <p className="text-xs text-violet-300 truncate">{currentUser?.department || 'Department'}</p>
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

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl space-y-6">
        {/* Dynamic Sub-Event Header */}
        <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-md">
                  {subEvent ? subEvent.department : (currentUser?.department || 'Not allotted yet')}
                </span>
                <span className="text-xs font-semibold text-slate-400">Wings TechFest Orchestration</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {subEvent ? subEvent.name : 'Not allotted yet'}
              </h2>
            </div>

            <div className="text-right">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${subEvent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {subEvent ? `Lifecycle: ${subEvent.status || 'OPEN'}` : 'Not allotted yet'}
              </span>
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
              <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Assigned Faculty Head(s)</span>
              <p className="text-violet-900 font-bold mt-0.5">
                {facultyList.length > 0
                  ? facultyList.map((f) => f.name).join(', ')
                  : 'Not allotted yet'}
              </p>
            </div>
          </div>
        </header>

        {/* High Utilization Alert */}
        {isBudgetWarning && (
          <div className="p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-amber-900 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold">Expenditure Cap Warning (High Utilization)</p>
                <p className="text-xs text-amber-700">
                  {subEvent?.name} has utilized {((totalExpenditure / allocatedBudget) * 100).toFixed(1)}% of its allocated fund.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900">
              AUDIT ALERT
            </span>
          </div>
        )}

        {/* 4 Real-Time Metric Cards (Strictly Scoped) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Budget Allocated</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              ₹{allocatedBudget.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">{subEvent ? subEvent.name : 'Not allotted yet'}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Advance Payment</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              ₹{advancePayment.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">Cash in hand logged</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Expenditure</p>
            <p className="text-2xl font-black text-violet-700 mt-1">
              ₹{totalExpenditure.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">{scopedBills.length} bills recorded</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining Balance</p>
            <p className={`text-2xl font-black mt-1 ${remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              ₹{remainingBalance.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">Real-time ledger sync</p>
          </div>
        </section>

        {/* TAB 1: UPLOAD BILL */}
        {activeTab === 'Upload Bill' && (
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>📤</span> Upload Receipt for Instant OCR Scan
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload image or scan. Python OCR will parse invoice details and auto-fill the audit voucher.
              </p>
            </div>

            <div className="border-2 border-dashed border-violet-200 hover:border-violet-500 bg-violet-50/40 rounded-2xl p-8 text-center transition flex flex-col items-center justify-center">
              <span className="text-4xl mb-2">📄</span>
              <p className="text-sm font-bold text-slate-800">
                {selectedFile ? `Selected: ${selectedFile}` : 'Drag & drop bill receipt image or browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Assigning to folder:{' '}
                <span className="font-semibold text-violet-800">{subEvent ? subEvent.name : 'Not allotted yet'}</span>
              </p>

              <label className="cursor-pointer bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow">
                Browse Bill
                <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
              </label>
            </div>

            {isScanning && (
              <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 text-center text-violet-800 text-sm font-bold animate-pulse flex items-center justify-center gap-2">
                <span>🔍</span> Reading bill metadata with OCR AI... Please wait.
              </div>
            )}

            {ocrError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                ⚠️ {ocrError}
              </div>
            )}

            {(vendorName || fileObject) && !isScanning && (
              <form onSubmit={handleSubmitBill} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Extracted Voucher Particulars
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      🔒 Read-only for Event Coordinators. Any misdetected values will be corrected by your Faculty Advisor.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Auto-Captured via OCR
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor Name</label>
                    <input
                      type="text"
                      value={vendorName}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-800 cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Invoice / Bill Number</label>
                    <input
                      type="text"
                      value={billNo}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-800 cursor-not-allowed font-mono select-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Base Taxable Amount (₹)</label>
                    <input
                      type="text"
                      value={baseAmount}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-800 cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Grand Total Amount (₹)</label>
                    <input
                      type="text"
                      value={amount}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 font-black text-violet-900 cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Bill Date</label>
                    <input
                      type="text"
                      value={billDate}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-800 cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor GSTIN (Tax ID)</label>
                    <input
                      type="text"
                      value={vendorGstin}
                      readOnly
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 text-xs font-mono text-slate-700 cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600">CGST (₹)</label>
                      <input
                        type="text"
                        value={cgst}
                        readOnly
                        className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed select-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">SGST (₹)</label>
                      <input
                        type="text"
                        value={sgst}
                        readOnly
                        className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed select-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Expense Purpose / Activity Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what items were purchased..."
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-violet-700 hover:bg-violet-800 disabled:bg-violet-400 text-white rounded-xl text-sm font-bold shadow transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Forwarding to Faculty Review...' : '✓ Confirm & Forward to Faculty Review'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* TAB 2 & 3: MY BILLS & TRACKING PIPELINE (Render scopedBills Only) */}
        {(activeTab === 'My Bills' || activeTab === 'Dashboard') && (
          <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>📑</span> Sequential Approval Conveyor Belt
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track bill verification progress: Event Head → Faculty → Principal → Storekeeper
                </p>
              </div>
              <button
                onClick={() => fetchSubEventData()}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 shadow-sm"
              >
                ↻ Refresh Ledger
              </button>
            </div>

            {loadingBills ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-400">Loading bills...</div>
            ) : scopedBills.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                No bills uploaded for this event folder yet.
              </div>
            ) : (
              <div className="space-y-4">
                {scopedBills.map((bill) => (
                  <div key={bill.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{bill.vendorName}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                            #{bill.billNo}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {bill.eventName} • Incurred on: {bill.billDate}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-base font-black text-slate-900">₹{Number(bill.amount).toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            Folder Running Total: ₹{(bill.runningTotal || bill.amount).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => generateVoucherPdf(bill)}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                          title="Generate Government-compliant duplex alternating PDF"
                        >
                          <span>🖨️</span> Close & Print
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: 'Event Head', role: 'SUBMITTED' },
                          { label: 'Faculty Review', role: 'PENDING_FACULTY' },
                          { label: 'Principal Approval', role: 'PENDING_PRINCIPAL' },
                          { label: 'Storekeeper Note', role: 'PENDING_STOREKEEPER' },
                        ].map((stage, idx) => (
                          <div key={stage.label} className="flex flex-col items-center">
                            <div
                              className={`w-full py-1 text-[11px] font-extrabold rounded-md border ${renderConveyorStep(
                                bill.status,
                                idx
                              )}`}
                            >
                              {stage.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: BUDGET OVERVIEW */}
        {activeTab === 'Budget Overview' && (
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>💰</span> Sub-Event Fund Allocation & Compliance
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Utilization Rate</span>
                <span className={isBudgetWarning ? 'text-rose-600' : 'text-violet-900'}>
                  {allocatedBudget > 0 ? ((totalExpenditure / allocatedBudget) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isBudgetWarning ? 'bg-rose-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${allocatedBudget > 0 ? Math.min((totalExpenditure / allocatedBudget) * 100, 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-400 font-bold uppercase">Assigned Faculty Advisor(s)</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {facultyList.length > 0 ? facultyList.map((f) => f.name).join(', ') : 'Not allotted yet'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-400 font-bold uppercase">Storekeeper Ledger Status</p>
                <p className="text-sm font-bold text-slate-800 mt-1">Digital Book Synchronized</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}