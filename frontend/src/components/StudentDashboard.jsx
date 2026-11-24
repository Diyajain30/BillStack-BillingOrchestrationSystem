import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { backendApi, ocrApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import { SubEventAnalytics } from './AnalyticsCharts';

const APPROVAL_STAGES = [
  { key: 'PENDING_FACULTY', label: 'Faculty' },
  { key: 'PENDING_MAIN_HEAD', label: 'Main Head' },
  { key: 'PENDING_PRINCIPAL', label: 'Principal' },
  { key: 'PENDING_STOREKEEPER', label: 'Storekeeper' },
];

function getStageIndex(status) {
  switch (status) {
    case 'PENDING_FACULTY':
      return 0;
    case 'PENDING_MAIN_HEAD':
      return 1;
    case 'PENDING_PRINCIPAL':
      return 2;
    case 'PENDING_STOREKEEPER':
      return 3;
    case 'APPROVED':
      return 4;
    default:
      return -1;
  }
}

function getStatusBadgeClass(status) {
  if (status === 'APPROVED') {
    return 'bg-sage-100 text-sage-800 border-sage-200';
  }
  if (status === 'REJECTED') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () =>
        resolve(typeof ev.target?.result === 'string' ? ev.target.result : '');
      img.src = ev.target?.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export default function StudentDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'upload' | 'bills' | 'profile'
  const [currentUser, setCurrentUser] = useState(user);
  const [subEvent, setSubEvent] = useState(null);
  const [coordinatorList, setCoordinatorList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Upload & OCR state
  const [selectedFile, setSelectedFile] = useState(null);
  const [receiptImage, setReceiptImage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [vendorName, setVendorName] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [cgst, setCgst] = useState('');
  const [sgst, setSgst] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reuploadRemark, setReuploadRemark] = useState('');

  // Modals
  const [selectedRejectedBill, setSelectedRejectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);

  const showMessage = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev.text === text ? { type: '', text: '' } : prev));
    }, 5000);
  };

  // Shared across all Student Coordinators on the same sub-event
  const fetchBills = useCallback(async (targetSubEvent) => {
    const subEventId =
      typeof targetSubEvent === 'object' ? targetSubEvent?.id : targetSubEvent;
    const subEventName =
      typeof targetSubEvent === 'object' ? targetSubEvent?.name : '';

    if (!subEventId && !subEventName) {
      setBills([]);
      return;
    }

    setLoadingBills(true);
    try {
      const res = await backendApi.get('/bills', {
        params: subEventId ? { subEventId } : {},
      });
      const rawList = Array.isArray(res.data) ? res.data : [];
      const sharedSubEventBills =
        subEventId || subEventName
          ? rawList.filter((b) => {
              const sid =
                b.subEventId ?? b.sub_event_id ?? b.eventId ?? b.event_id;
              if (subEventId && sid != null && String(sid) === String(subEventId)) {
                return true;
              }
              return (
                subEventName &&
                b.eventName &&
                b.eventName.toLowerCase().trim() ===
                  subEventName.toLowerCase().trim()
              );
            })
          : rawList;
      setBills(sharedSubEventBills);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
      setBills([]);
    } finally {
      setLoadingBills(false);
    }
  }, []);

  const fetchSubEventData = useCallback(async () => {
    try {
      setLoadingEvent(true);
      let subEventId =
        currentUser?.assignedSubEventId || currentUser?.subEventId;

      if (currentUser?.id) {
        try {
          const userRes = await backendApi.get(`/users/${currentUser.id}`);
          if (userRes.data) {
            subEventId = userRes.data.assignedSubEventId || subEventId;
            setCurrentUser(userRes.data);
            localStorage.setItem('user', JSON.stringify(userRes.data));
          }
        } catch (err) {
          console.warn('Could not refresh user assignment:', err);
        }
      }

      if (subEventId) {
        const res = await backendApi.get(`/subevents/${subEventId}`);
        setSubEvent(res.data);
        setCoordinatorList(res.data?.coordinators || []);
        setFacultyList(res.data?.facultyHeads || []);
        await fetchBills(res.data);
      } else {
        setSubEvent(null);
        setCoordinatorList([]);
        setFacultyList([]);
        setBills([]);
      }
    } catch (err) {
      console.error('Failed to load sub-event data:', err);
    } finally {
      setLoadingEvent(false);
    }
  }, [
    currentUser?.id,
    currentUser?.assignedSubEventId,
    currentUser?.subEventId,
    fetchBills,
  ]);

  useEffect(() => {
    fetchSubEventData();
  }, [fetchSubEventData]);

  const resetForm = () => {
    setSelectedFile(null);
    setReceiptImage('');
    setVendorName('');
    setBillNo('');
    setBillDate('');
    setVendorGstin('');
    setBaseAmount('');
    setCgst('');
    setSgst('');
    setAmount('');
    setRemarks('');
    setReuploadRemark('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsScanning(true);
    setFeedback({ type: '', text: '' });

    const dataUrl = await fileToCompressedDataUrl(file);
    setReceiptImage(dataUrl);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await ocrApi.post('', formData);
      const extracted = response.data?.data || response.data || {};

      setVendorName(extracted.vendorName || extracted.vendor_name || '');
      setBillNo(extracted.billNo || extracted.bill_number || '');
      setBillDate(extracted.billDate || extracted.bill_date || '');
      setVendorGstin(extracted.vendorGstin || extracted.vendor_gstin || '');
      setBaseAmount(
        extracted.baseAmount !== undefined && extracted.baseAmount !== null
          ? String(extracted.baseAmount)
          : extracted.base_amount !== undefined
          ? String(extracted.base_amount)
          : ''
      );
      setCgst(
        extracted.cgst !== undefined && extracted.cgst !== null
          ? String(extracted.cgst)
          : ''
      );
      setSgst(
        extracted.sgst !== undefined && extracted.sgst !== null
          ? String(extracted.sgst)
          : ''
      );
      setAmount(
        extracted.amount !== undefined && extracted.amount !== null
          ? String(extracted.amount)
          : extracted.grand_total !== undefined
          ? String(extracted.grand_total)
          : ''
      );

      showMessage(
        'success',
        'OCR scan completed. Extracted fields are locked; Faculty Head or Main Event Head can correct any discrepancies during review.'
      );
    } catch (error) {
      console.error('OCR Extraction Failed:', error);
      showMessage(
        'error',
        'Could not scan document via OCR service. Ensure the Python OCR server is running and try uploading a clearer image.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmitBill = async (e) => {
    e.preventDefault();

    if (!subEvent?.id) {
      showMessage(
        'error',
        'You are not assigned to a sub-event yet. Contact your Student Head to assign your sub-event.'
      );
      return;
    }

    if (!vendorName.trim() || !amount) {
      showMessage(
        'error',
        'Please upload a receipt so OCR can populate Vendor Name and Grand Total Amount.'
      );
      return;
    }

    if (selectedRejectedBill && !reuploadRemark.trim()) {
      showMessage(
        'error',
        'A remark is compulsory when re-uploading/resubmitting a rejected bill.'
      );
      return;
    }

    setIsSubmitting(true);
    const parsedAmount = parseFloat(amount) || 0;
    const parsedBase =
      baseAmount !== '' ? parseFloat(baseAmount) || 0 : parsedAmount;
    const parsedCgst = cgst !== '' ? parseFloat(cgst) || 0 : 0;
    const parsedSgst = sgst !== '' ? parseFloat(sgst) || 0 : 0;

    const payload = {
      vendorName: vendorName.trim(),
      billNo: billNo.trim() || `INV-${Date.now().toString().slice(-4)}`,
      billDate: billDate || new Date().toISOString().split('T')[0],
      vendorGstin: vendorGstin.trim() || 'Unregistered',
      baseAmount: parsedBase,
      cgst: parsedCgst,
      sgst: parsedSgst,
      amount: parsedAmount,
      eventName: subEvent.name,
      subEventId: subEvent.id,
      description: remarks.trim() || '',
      remark: selectedRejectedBill ? reuploadRemark.trim() : remarks.trim() || '',
      receiptImage: receiptImage || selectedRejectedBill?.receiptImage || null,
      uploadedById: currentUser?.id,
      uploadedByName: currentUser?.name || currentUser?.username,
      uploadedByRole: 'STUDENT_COORDINATOR',
      status: 'PENDING_FACULTY',
    };

    try {
      if (selectedRejectedBill) {
        await backendApi.put(
          `/bills/${selectedRejectedBill.id}/reupload`,
          payload
        );
        showMessage(
          'success',
          `Bill #${payload.billNo} re-submitted for Faculty approval.`
        );
        setSelectedRejectedBill(null);
      } else {
        await backendApi.post('/bills', payload);
        showMessage(
          'success',
          `Bill #${payload.billNo} submitted for Faculty approval.`
        );
      }

      resetForm();
      await fetchSubEventData();
      setActiveTab('bills');
    } catch (error) {
      console.error('Failed to submit bill:', error);
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to submit bill. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReuploadModal = (bill) => {
    setSelectedRejectedBill(bill);
    setReceiptImage(bill.receiptImage || '');
    setVendorName(bill.vendorName || '');
    setBillNo(bill.billNo || '');
    setBillDate(bill.billDate || '');
    setVendorGstin(bill.vendorGstin || '');
    setBaseAmount(bill.baseAmount ?? bill.amount ?? '');
    setCgst(bill.cgst ?? 0);
    setSgst(bill.sgst ?? 0);
    setAmount(bill.amount ?? '');
    setRemarks(bill.description || '');
    setReuploadRemark('');
  };

  const generateVoucherPdf = (bill) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('GOVERNMENT COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('EXPENSE VOUCHER', 105, 28, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(15, 32, 195, 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Voucher ID: BS-V-${bill.id || 'TEMP'}`, 16, 42);
    doc.text(`Bill Date: ${bill.billDate || 'N/A'}`, 130, 42);
    doc.text(
      `Sub-Event: ${bill.eventName || subEvent?.name || 'N/A'}`,
      16,
      50
    );
    doc.text(`Coordinator: ${currentUser?.name || 'Coordinator'}`, 130, 50);

    doc.rect(15, 56, 180, 56);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSE AUDIT PARTICULARS', 20, 64);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vendor Name: ${bill.vendorName || 'N/A'}`, 20, 74);
    doc.text(
      `Vendor GSTIN: ${bill.vendorGstin || 'Unregistered'}`,
      110,
      74
    );
    doc.text(`Invoice No: ${bill.billNo || 'N/A'}`, 20, 84);
    doc.text(
      `Base Amount: INR ${Number(bill.baseAmount || bill.amount || 0).toFixed(2)}`,
      110,
      84
    );
    doc.text(
      `CGST + SGST: INR ${(
        Number(bill.cgst || 0) + Number(bill.sgst || 0)
      ).toFixed(2)}`,
      20,
      94
    );
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Grand Total: INR ${Number(bill.amount || 0).toFixed(2)}`,
      110,
      94
    );
    doc.text(
      `Approved Running Total: INR ${Number(bill.runningTotal || 0).toFixed(2)}`,
      20,
      104
    );

    const sigY = 132;
    doc.rect(15, sigY, 180, 35);
    doc.line(60, sigY, 60, sigY + 35);
    doc.line(105, sigY, 105, sigY + 35);
    doc.line(150, sigY, 150, sigY + 35);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('COORDINATOR', 25, sigY + 8);
    doc.text('FACULTY HEAD', 68, sigY + 8);
    doc.text('PRINCIPAL', 117, sigY + 8);
    doc.text('STOREKEEPER', 158, sigY + 8);

    doc.setFont('helvetica', 'italic');
    doc.text('Submitted', 28, sigY + 28);
    doc.text(
      bill.status !== 'PENDING_FACULTY' ? 'Verified' : 'Pending',
      74,
      sigY + 28
    );
    doc.text(
      bill.status === 'PENDING_STOREKEEPER' || bill.status === 'APPROVED'
        ? 'Sanctioned'
        : 'Pending',
      118,
      sigY + 28
    );
    doc.text(
      bill.status === 'APPROVED' ? 'Logged' : 'Pending',
      164,
      sigY + 28
    );

    doc.save(`Voucher_${bill.billNo || bill.id}.pdf`);
  };

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof onLogout === 'function') onLogout();
    navigate('/', { replace: true });
  };

  const rejectedBills = bills.filter((b) => b.status === 'REJECTED');
  const allocatedBudget = subEvent?.budgetCap ? Number(subEvent.budgetCap) : 0;
  const advancePayment = subEvent?.advanceDisbursed
    ? Number(subEvent.advanceDisbursed)
    : 0;
  const totalExpenditure = bills
    .filter((b) => b.status === 'APPROVED')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBalance = allocatedBudget - totalExpenditure;
  const utilizationPct =
    allocatedBudget > 0
      ? Math.min(
          Number(((totalExpenditure / allocatedBudget) * 100).toFixed(1)),
          100
        )
      : 0;
  const isBudgetWarning =
    allocatedBudget > 0 && totalExpenditure / allocatedBudget >= 0.8;

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

  const readOnlyOcrClass =
    'w-full px-3.5 py-2 bg-sage-50/80 border border-sage-200 rounded-lg text-sm text-stone-700 cursor-not-allowed outline-none';

  const navItems = [
    { id: 'summary', label: 'Event Summary' },
    { id: 'upload', label: 'Upload Bill' },
    { id: 'bills', label: 'Track My Bills', count: bills.length },
    { id: 'profile', label: 'Profile' },
  ];

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
                Student Coordinator Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {currentUser?.name || currentUser?.username || 'Coordinator'}
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
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white border border-sage-200 text-stone-600">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
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
                          : 'Not Allotted Yet'}
                      </h2>
                    </div>
                    <span className="text-xs font-medium px-3 py-1.5 bg-sage-50 border border-sage-200 text-sage-800 rounded-lg self-start sm:self-auto">
                      Status:{' '}
                      {subEvent ? subEvent.status || 'OPEN' : 'Unassigned'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-sage-100 text-sm">
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Description
                      </span>
                      <p className="text-stone-800">
                        {subEvent?.description?.trim()
                          ? subEvent.description
                          : 'Not allotted yet'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Assigned Faculty Head(s)
                      </span>
                      <p className="text-stone-900 font-medium">
                        {facultyList.length > 0
                          ? facultyList.map((f) => f.name).join(', ')
                          : 'Not allotted yet'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-stone-500 block mb-1">
                        Co-Assigned Coordinators
                      </span>
                      <p className="text-stone-900 font-medium">
                        {coordinatorList.length > 0
                          ? coordinatorList.map((c) => c.name).join(', ')
                          : currentUser?.name || 'Not allotted yet'}
                      </p>
                    </div>
                  </div>
                </section>

                {isBudgetWarning && (
                  <div className="px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <strong className="font-semibold">Budget Warning:</strong>{' '}
                    {subEvent?.name} has utilized {utilizationPct}% of its
                    sanctioned allocation (approved bills).
                  </div>
                )}

                {rejectedBills.length > 0 && (
                  <section className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-rose-800">
                      Action Required: Rejected Bills ({rejectedBills.length})
                    </h3>
                    <div className="space-y-2.5">
                      {rejectedBills.map((bill) => (
                        <div
                          key={bill.id}
                          className="bg-white border border-rose-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-stone-900">
                              {bill.vendorName}{' '}
                              <span className="font-mono text-xs text-stone-500">
                                #{bill.billNo}
                              </span>
                            </p>
                            <p className="text-xs text-rose-700 mt-1">
                              Reason:{' '}
                              {bill.rejectionReason ||
                                bill.remark ||
                                'Correction required.'}
                            </p>
                          </div>
                          <button
                            onClick={() => openReuploadModal(bill)}
                            className="px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
                          >
                            Re-upload Bill
                          </button>
                        </div>
                      ))}
                    </div>
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
                  bills={bills}
                />
              </div>
            )}

            {/* UPLOAD BILL TAB */}
            {activeTab === 'upload' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
                <div className="pb-4 border-b border-sage-100 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-stone-900">
                    Upload &amp; Scan Invoice
                  </h2>
                  <span className="text-xs font-medium text-sage-800 bg-sage-50 border border-sage-200 px-2.5 py-1 rounded-md">
                    {subEvent ? subEvent.name : 'Unassigned'}
                  </span>
                </div>

                <form onSubmit={handleSubmitBill} className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1.5">
                      Receipt Document (Image / PDF) *
                    </label>
                    <div className="p-4 bg-sage-50/70 border border-dashed border-sage-300 rounded-lg space-y-3">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-sage-200 file:text-xs file:font-medium file:bg-white file:text-sage-800 hover:file:bg-sage-100 file:cursor-pointer"
                      />
                      {selectedFile && (
                        <p className="text-[11px] text-stone-500 truncate">
                          Selected:{' '}
                          <span className="font-medium text-stone-700">
                            {selectedFile.name}
                          </span>
                        </p>
                      )}
                      {receiptImage &&
                        !receiptImage.startsWith('data:application/pdf') && (
                          <img
                            src={receiptImage}
                            alt="Uploaded receipt preview"
                            className="max-h-48 rounded border border-sage-200 bg-white object-contain"
                          />
                        )}
                    </div>
                  </div>

                  {isScanning && (
                    <div className="px-3.5 py-2.5 bg-sage-50 border border-sage-200 rounded-lg text-xs text-sage-800">
                      Scanning document and extracting fields...
                    </div>
                  )}

                  <div className="px-3.5 py-2 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                    OCR fields below are auto-populated and read-only. Only Faculty Head and Main Event Head can override extracted values during review.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Vendor Name (OCR)
                      </label>
                      <input
                        type="text"
                        value={vendorName}
                        readOnly
                        placeholder="Auto-filled after upload"
                        className={readOnlyOcrClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Invoice Number (OCR)
                      </label>
                      <input
                        type="text"
                        value={billNo}
                        readOnly
                        placeholder="Auto-filled after upload"
                        className={`${readOnlyOcrClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Bill Date (OCR)
                      </label>
                      <input
                        type="text"
                        value={billDate}
                        readOnly
                        placeholder="Auto-filled after upload"
                        className={readOnlyOcrClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Vendor GSTIN (OCR)
                      </label>
                      <input
                        type="text"
                        value={vendorGstin}
                        readOnly
                        placeholder="Auto-filled after upload"
                        className={`${readOnlyOcrClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Base Amount (INR, OCR)
                      </label>
                      <input
                        type="text"
                        value={baseAmount}
                        readOnly
                        placeholder="0.00"
                        className={readOnlyOcrClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Grand Total Amount (INR, OCR)
                      </label>
                      <input
                        type="text"
                        value={amount}
                        readOnly
                        placeholder="0.00"
                        className={`${readOnlyOcrClass} font-semibold`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        CGST (INR, OCR)
                      </label>
                      <input
                        type="text"
                        value={cgst}
                        readOnly
                        placeholder="0.00"
                        className={readOnlyOcrClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        SGST (INR, OCR)
                      </label>
                      <input
                        type="text"
                        value={sgst}
                        readOnly
                        placeholder="0.00"
                        className={readOnlyOcrClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Remarks (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional notes about items purchased or OCR discrepancies for Faculty review..."
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={
                        isSubmitting || isScanning || !vendorName || !amount
                      }
                      className="px-6 py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white text-sm font-medium rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 text-sm font-medium rounded-lg transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* TRACK MY BILLS TAB */}
            {activeTab === 'bills' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-sage-100">
                  <div>
                    <h2 className="text-base font-semibold text-stone-900">
                      Sub-Event Bills ({bills.length})
                    </h2>
                    <p className="text-xs text-stone-500">
                      Visible to all Student Coordinators assigned to{' '}
                      {subEvent?.name || 'this sub-event'}.
                    </p>
                  </div>
                </div>

                {loadingBills ? (
                  <div className="py-10 text-center text-xs text-stone-500">
                    Loading bills...
                  </div>
                ) : bills.length === 0 ? (
                  <div className="py-10 px-4 text-center bg-sage-50/50 border border-sage-200/80 rounded-lg text-xs text-stone-500">
                    No bills uploaded for this sub-event yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bills.map((bill) => {
                      const stageIdx = getStageIndex(bill.status);
                      const isRejected = bill.status === 'REJECTED';

                      return (
                        <div
                          key={bill.id}
                          className="p-5 bg-sage-50/35 border border-sage-200 rounded-xl space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-stone-900">
                                  {bill.vendorName}
                                </span>
                                <span className="text-[11px] font-mono text-stone-500 bg-white border border-sage-200 px-2 py-0.5 rounded">
                                  #{bill.billNo || bill.id}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getStatusBadgeClass(
                                    bill.status
                                  )}`}
                                >
                                  {bill.status}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-1">
                                Date: {bill.billDate || 'N/A'} &middot; GSTIN:{' '}
                                {bill.vendorGstin || 'Unregistered'}
                                {bill.uploadedByName
                                  ? ` · By ${bill.uploadedByName}`
                                  : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-base font-semibold text-stone-900">
                                  INR {Number(bill.amount || 0).toFixed(2)}
                                </p>
                                <p className="text-[11px] text-stone-500">
                                  {bill.status === 'APPROVED'
                                    ? `Approved Total: INR ${Number(
                                        bill.runningTotal || 0
                                      ).toFixed(2)}`
                                    : 'Pending final approval'}
                                </p>
                              </div>
                              <button
                                onClick={() => generateVoucherPdf(bill)}
                                className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => setSelectedBillForAudit(bill.id)}
                                className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium transition cursor-pointer"
                              >
                                Logs
                              </button>
                            </div>
                          </div>

                          {isRejected ? (
                            <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-700">
                              <span>
                                Rejected:{' '}
                                {bill.rejectionReason ||
                                  bill.remark ||
                                  'Returned for correction.'}
                              </span>
                              <button
                                onClick={() => openReuploadModal(bill)}
                                className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-md font-medium hover:bg-rose-50 cursor-pointer self-start sm:self-auto"
                              >
                                Re-upload Bill
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-sage-200/70">
                              {APPROVAL_STAGES.map((stage, idx) => {
                                const done = stageIdx > idx;
                                const active = stageIdx === idx;
                                return (
                                  <div key={stage.key} className="space-y-1">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        done
                                          ? 'bg-sage-600'
                                          : active
                                          ? 'bg-sage-300'
                                          : 'bg-sage-100'
                                      }`}
                                    />
                                    <p
                                      className={`text-[11px] truncate ${
                                        done
                                          ? 'text-sage-800 font-medium'
                                          : active
                                          ? 'text-stone-700 font-medium'
                                          : 'text-stone-400'
                                      }`}
                                    >
                                      {stage.label}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    <span className="text-stone-500">Roll / ID</span>
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
                      {subEvent ? subEvent.name : 'Not Allotted Yet'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* REUPLOAD MODAL (Re-scan receipt + compulsory remark) */}
      {selectedRejectedBill && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60 flex justify-between items-center">
              <h3 className="text-base font-semibold text-stone-900">
                Re-upload Rejected Bill
              </h3>
              <button
                onClick={() => {
                  setSelectedRejectedBill(null);
                  resetForm();
                }}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmitBill}
              className="p-6 overflow-y-auto space-y-4"
            >
              <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                <strong>Rejection Reason:</strong>{' '}
                {selectedRejectedBill.rejectionReason ||
                  selectedRejectedBill.remark ||
                  'Correction required.'}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Upload Clearer / Updated Receipt (OCR Re-Scan)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="w-full text-xs text-stone-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Vendor Name (OCR)
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    readOnly
                    className={readOnlyOcrClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Invoice Number (OCR)
                  </label>
                  <input
                    type="text"
                    value={billNo}
                    readOnly
                    className={`${readOnlyOcrClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Grand Total (INR, OCR)
                  </label>
                  <input
                    type="text"
                    value={amount}
                    readOnly
                    className={readOnlyOcrClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Resubmission Remark *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reuploadRemark}
                  onChange={(e) => setReuploadRemark(e.target.value)}
                  placeholder="Explain the fix made for this rejection..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRejectedBill(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isScanning}
                  className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Re-submit Bill'}
                </button>
              </div>
            </form>
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