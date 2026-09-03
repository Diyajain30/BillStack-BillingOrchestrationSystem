import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi, ocrApi } from '../services/api';

export default function StudentDashboard({ user }) {
  const navigate = useNavigate();

  // Navigation & Active View
  const [activeTab, setActiveTab] = useState('Upload Bill');
  const sidebarItems = ['Dashboard', 'Upload Bill', 'My Bills', 'Budget Overview'];

  // Event & Sub-Event Folder State
  const [branch, setBranch] = useState('Computer Engineering');
  const [subEvent, setSubEvent] = useState('Coding Competition');

  // Budget Metrics (Sample Allocation for Sub-event)
  const allocatedBudget = 30000;
  const [spentBudget, setSpentBudget] = useState(14750);

  // File & OCR States
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields (Auto-filled by OCR or manually edited)
  const [vendorName, setVendorName] = useState('');
  const [billNo, setBillNo] = useState('');
  const [amount, setAmount] = useState('');
  const [billDate, setBillDate] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [description, setDescription] = useState('');

  // Bills List State
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Fetch submitted bills from Spring Boot backend
  const fetchBills = async () => {
    setLoadingBills(true);
    try {
      const res = await backendApi.get('/bills');
      if (res.data && Array.isArray(res.data)) {
        setBills(res.data);
        const total = res.data.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        if (total > 0) setSpentBudget(total);
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback records:', err);
      setBills([
        {
          id: 1,
          billNo: 'SK/2026/0452',
          vendorName: 'S.K. Graphics & Printers',
          amount: 5354.84,
          billDate: '2026-05-15',
          eventName: 'Computer Engineering - Coding Competition',
          status: 'PENDING_FACULTY',
          runningTotal: 5354.84,
        },
        {
          id: 2,
          billNo: 'CCS/2026/789',
          vendorName: 'City Catering Services',
          amount: 14750.0,
          billDate: '2026-05-16',
          eventName: 'Computer Engineering - Coding Competition',
          status: 'PENDING_STOREKEEPER',
          runningTotal: 20104.84,
        },
      ]);
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Handle File Selection and Trigger Python FastAPI OCR
  const handleFileChange = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    setFileObject(file);
    setSelectedFile(file.name);
    setFilePreview(URL.createObjectURL(file));
    setIsScanning(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await ocrApi.post('', formData);
      const extracted = response.data?.data || response.data || {};

      setVendorName(extracted.vendorName || extracted.vendor_name || '');
      setBillNo(extracted.billNo || extracted.bill_number || '');
      setAmount(extracted.amount || extracted.grand_total || extracted.total_amount || '');
      setBillDate(extracted.billDate || extracted.bill_date || '');
      setVendorGstin(extracted.vendorGstin || extracted.vendor_gstin || '');
      setCgst(extracted.cgst || 0);
      setSgst(extracted.sgst || 0);
      setDescription(`Purchased for ${subEvent}`);
    } catch (error) {
      console.error('OCR Extraction Failed:', error);
      alert('OCR could not parse this file automatically. You can fill the fields manually.');
    } finally {
      setIsScanning(false);
    }
  };

  // Submit Verified Bill to Spring Boot
  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!amount || !vendorName) {
      alert('Please fill at least the Vendor Name and Amount.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      vendorName,
      billNo: billNo || 'GEN-' + Date.now().toString().slice(-4),
      amount: parseFloat(amount),
      billDate: billDate || new Date().toISOString().split('T')[0],
      vendorGstin: vendorGstin || 'N/A',
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      eventName: `${branch} - ${subEvent}`,
      description: description || `Submitted by ${user?.name || 'Coordinator'}`,
      status: 'PENDING_FACULTY',
    };

    try {
      await backendApi.post('/bills', payload);
      alert('Bill successfully submitted to the approval conveyor belt!');
      // Reset form
      setSelectedFile(null);
      setFileObject(null);
      setFilePreview(null);
      setVendorName('');
      setBillNo('');
      setAmount('');
      setBillDate('');
      setVendorGstin('');
      setDescription('');
      fetchBills();
      setActiveTab('My Bills');
    } catch (error) {
      console.error('Backend submission failed:', error);
      alert(error.response?.data?.message || 'Failed to connect to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client-Side PDF Generation: Alternating Duplex Printout
  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();

    // --- PAGE 1: Formal Voucher Form ---
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
    doc.text(`Event / Sub-Event: ${bill.eventName || `${branch} - ${subEvent}`}`, 16, 50);
    doc.text(`Coordinator: ${user?.name || 'Student Head'}`, 130, 50);

    // Ledger Summary Box
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

    // Signature Grid
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
    doc.text('Note: This is Page 1 of the Duplex Audit Record. Physical bill attached on reverse.', 105, 180, { align: 'center' });

    // --- PAGE 2: Physical Bill Receipt (Duplex Reverse) ---
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ATTACHED RECEIPT / TAX INVOICE (BACKSIDE)', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill Ref No: ${bill.billNo || 'N/A'} | Vendor: ${bill.vendorName || 'N/A'}`, 105, 28, { align: 'center' });

    // Receipt Frame
    doc.setDrawColor(180, 180, 180);
    doc.rect(20, 40, 170, 220);
    doc.text('[ Physical Bill Image Affixed Here for Audit Inspection ]', 105, 140, { align: 'center' });

    doc.save(`Voucher_${bill.billNo || 'BillStack'}.pdf`);
  };

  // Helper for Conveyor Belt Status Bar
  const renderConveyorStep = (currentStatus, stepIndex) => {
    const stages = ['PENDING_FACULTY', 'PENDING_STOREKEEPER', 'PENDING_PRINCIPAL', 'APPROVED'];
    const currentIdx = stages.indexOf(currentStatus);
    const isComplete = currentIdx > stepIndex || currentStatus === 'APPROVED';
    const isCurrent = currentIdx === stepIndex;

    if (currentStatus === 'REJECTED') {
      return 'bg-rose-500 text-white border-rose-600';
    }
    if (isComplete) return 'bg-emerald-500 text-white border-emerald-600';
    if (isCurrent) return 'bg-violet-600 text-white border-violet-700 animate-pulse';
    return 'bg-slate-100 text-slate-400 border-slate-200';
  };

  const isBudgetWarning = spentBudget / allocatedBudget >= 0.8;

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
              {user?.name ? user.name[0].toUpperCase() : 'S'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name || 'Student Coordinator'}</p>
              <p className="text-xs text-violet-300 truncate">{branch}</p>
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

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl">
        {/* Header Banner */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Coordinator Dashboard</h2>
            <p className="text-sm text-slate-500 mt-1">
              Wings TechFest Orchestration • Department of {branch}
            </p>
          </div>

          {/* Folder Hierarchy Controls */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wing / Branch</span>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
              >
                <option>Computer Engineering</option>
                <option>Information Technology</option>
                <option>Electronics & Telecomm</option>
                <option>Mechanical Engineering</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub-Event Folder</span>
              <select
                value={subEvent}
                onChange={(e) => setSubEvent(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
              >
                <option>Coding Competition</option>
                <option>Web Genesis Hackathon</option>
                <option>Robo-Soccer</option>
                <option>Circuit Design Arena</option>
              </select>
            </div>
          </div>
        </header>

        {/* Budget Warning Banner (>= 80% Spent) */}
        {isBudgetWarning && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-amber-900 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold">Expenditure Cap Warning (High Utilization)</p>
                <p className="text-xs text-amber-700">
                  {subEvent} has utilized {((spentBudget / allocatedBudget) * 100).toFixed(1)}% of its allocated fund. Remaining: Rs.{' '}
                  {(allocatedBudget - spentBudget).toFixed(2)}.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900">
              AUDIT ALERT
            </span>
          </div>
        )}

        {/* Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Allocated Budget</p>
            <p className="text-2xl font-black text-slate-900 mt-1">₹{allocatedBudget.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-1">{subEvent}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Spent</p>
            <p className="text-2xl font-black text-violet-700 mt-1">₹{spentBudget.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-1">{bills.length} bills recorded</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining Balance</p>
            <p className={`text-2xl font-black mt-1 ${allocatedBudget - spentBudget < 5000 ? 'text-rose-600' : 'text-emerald-600'}`}>
              ₹{(allocatedBudget - spentBudget).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">Real-time ledger sync</p>
          </div>
        </section>

        {/* TAB 1: UPLOAD & OCR SCAN */}
        {activeTab === 'Upload Bill' && (
          <section className="mt-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>📤</span> Upload Receipt for Instant OCR Scan
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload image or scan. Python OCR will parse invoice details and auto-fill the audit voucher.
              </p>
            </div>

            {/* Drag & Drop File Zone */}
            <div className="border-2 border-dashed border-violet-200 hover:border-violet-500 bg-violet-50/40 rounded-2xl p-8 text-center transition flex flex-col items-center justify-center">
              <span className="text-4xl mb-2">📄</span>
              <p className="text-sm font-bold text-slate-800">
                {selectedFile ? `Selected: ${selectedFile}` : 'Drag & drop bill receipt image or browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Routing to: <span className="font-semibold text-violet-800">{branch}</span> •{' '}
                <span className="font-semibold text-violet-800">{subEvent}</span>
              </p>

              <label className="cursor-pointer bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow">
                Browse Bill
                <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
              </label>
            </div>

            {/* OCR Processing Loader */}
            {isScanning && (
              <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 text-center text-violet-800 text-sm font-bold animate-pulse flex items-center justify-center gap-2">
                <span>🔍</span> Reading bill metadata with OCR AI... Please wait.
              </div>
            )}

            {/* Extracted Bill Review & Confirmation Form */}
            {(vendorName || fileObject) && !isScanning && (
              <form onSubmit={handleSubmitBill} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Verify Extracted Audit Details
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800">
                    Auto-Extracted via OCR
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor Name</label>
                    <input
                      type="text"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="e.g., S.K. Graphics & Printers"
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Invoice / Bill Number</label>
                    <input
                      type="text"
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      placeholder="e.g., SK/2026/0452"
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Total Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white font-black text-violet-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Bill Date</label>
                    <input
                      type="text"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      placeholder="YYYY-MM-DD or DD-MM-YYYY"
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600">Vendor GSTIN (Tax ID)</label>
                    <input
                      type="text"
                      value={vendorGstin}
                      onChange={(e) => setVendorGstin(e.target.value)}
                      placeholder="e.g., 29ABCDE1234F1Z5"
                      className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600">CGST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={cgst}
                        onChange={(e) => setCgst(e.target.value)}
                        className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">SGST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={sgst}
                        onChange={(e) => setSgst(e.target.value)}
                        className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">Expense Purpose & Line Item Details</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what items were purchased and for what activity..."
                    className="w-full mt-1 p-2.5 text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-sm font-bold shadow transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Submitting to Approval Conveyor Belt...' : '✓ Confirm & Forward to Faculty Review'}
                </button>
              </form>
            )}
          </section>
        )}

        {/* TAB 2 & 3: MY BILLS & TRACKING PIPELINE */}
        {(activeTab === 'My Bills' || activeTab === 'Dashboard') && (
          <section className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>📑</span> Sequential Approval Conveyor Belt
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track bill verification progress: Event Head → Faculty → Storekeeper → Principal
                </p>
              </div>
              <button
                onClick={fetchBills}
                className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 shadow-sm"
              >
                ↻ Refresh Ledger
              </button>
            </div>

            {loadingBills ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-400">Loading bills...</div>
            ) : bills.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                No bills uploaded for this event folder yet.
              </div>
            ) : (
              <div className="space-y-4">
                {bills.map((bill) => (
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
                            Running Total: ₹{(bill.runningTotal || bill.amount).toFixed(2)}
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

                    {/* Conveyor Belt Visual Timeline */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: 'Event Head', role: 'SUBMITTED' },
                          { label: 'Faculty Review', role: 'PENDING_FACULTY' },
                          { label: 'Storekeeper Note', role: 'PENDING_STOREKEEPER' },
                          { label: 'Principal Approval', role: 'PENDING_PRINCIPAL' },
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
          <section className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>💰</span> Sub-Event Fund Allocation & Compliance
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Utilization Rate</span>
                <span className={isBudgetWarning ? 'text-rose-600' : 'text-violet-900'}>
                  {((spentBudget / allocatedBudget) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isBudgetWarning ? 'bg-rose-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${Math.min((spentBudget / allocatedBudget) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-slate-400 font-bold uppercase">Assigned Faculty Advisor</p>
                <p className="text-sm font-bold text-slate-800 mt-1">Prof. Technical Coordinator</p>
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