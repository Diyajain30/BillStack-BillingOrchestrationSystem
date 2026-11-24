import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi, ocrApi } from '../services/api';
import AuditLogModal from './AuditLogModal';
import ReceiptPreviewPane from './ReceiptPreviewPane';
import { MasterEventAnalytics, SubEventAnalytics } from './AnalyticsCharts';

const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Electronics & Telecommunication',
  'MCA',
  'MTech',
  'Institutional',
];

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

function getStatusBadgeClass(status) {
  if (status === 'APPROVED') return 'bg-sage-100 text-sage-800 border-sage-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
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

export default function StudentHeadDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'create' | 'upload' | 'folders' | 'profile'
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Eligible leads for Create Sub-Event (filtered by single-sub-event-per-Master-Event rule)
  const [availableLeads, setAvailableLeads] = useState({
    coordinators: [],
    faculty: [],
  });
  const [newSubEvent, setNewSubEvent] = useState({
    parentEventId: '',
    name: '',
    department: 'Computer Engineering',
    description: '',
    budgetCap: '',
    advanceDisbursed: '',
    coordinatorIds: [],
    facultyIds: [],
  });

  // Student Head Bill Upload state (routes directly to Main Event Head)
  const [headBillForm, setHeadBillForm] = useState({
    subEventId: '',
    vendorName: '',
    billNo: '',
    billDate: '',
    vendorGstin: '',
    baseAmount: '',
    cgst: '',
    sgst: '',
    amount: '',
    description: '',
    receiptImage: '',
    receiptFileName: '',
  });
  const [isScanningBill, setIsScanningBill] = useState(false);

  // Folder inspector modal state
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Bill inspector & audit modal state
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedBillForAudit, setSelectedBillForAudit] = useState(null);

  // Advance update modal state
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState('');

  // Edit sub-event modal state
  const [editTarget, setEditTarget] = useState(null);
  const [editLeads, setEditLeads] = useState({
    coordinators: [],
    faculty: [],
  });
  const [editForm, setEditForm] = useState({
    name: '',
    department: 'Computer Engineering',
    description: '',
    budgetCap: '',
    advanceDisbursed: '',
    coordinatorIds: [],
    facultyIds: [],
  });

  const todayStr = useMemo(() => formatDateDDMMYYYY(new Date()), []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentUserId = Number(user?.id);

  const showBanner = useCallback((type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
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
            role: user?.role || 'STUDENT_HEAD',
          },
        }),
        backendApi.get('/bills').catch(() => ({ data: [] })),
      ]);

      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (err) {
      console.error('Failed to load Student Head data:', err);
      showBanner('error', 'Failed to load assigned events from backend.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, showBanner]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const assignedMasterEvents = useMemo(() => {
    if (!Number.isFinite(currentUserId)) return [];
    return events
      .filter((ev) => {
        if (ev.parentEventId != null) return false;
        const headIds = parseIdList(ev.studentHeadIds);
        const mainIds = parseIdList(ev.mainHeadIds);
        const isMainHead =
          (ev.mainHeadId != null && Number(ev.mainHeadId) === currentUserId) ||
          mainIds.includes(currentUserId);
        return headIds.includes(currentUserId) || isMainHead;
      })
      .sort((a, b) => (Number(b.eventYear) || 0) - (Number(a.eventYear) || 0));
  }, [events, currentUserId]);

  useEffect(() => {
    if (assignedMasterEvents.length > 0 && !newSubEvent.parentEventId) {
      setNewSubEvent((prev) => ({
        ...prev,
        parentEventId: String(assignedMasterEvents[0].id),
      }));
    }
  }, [assignedMasterEvents, newSubEvent.parentEventId]);

  const fetchAvailableLeads = useCallback(
    async (parentEventId, excludeSubEventId = null) => {
      if (!parentEventId) return { coordinators: [], faculty: [] };
      try {
        const params = { parentEventId };
        if (excludeSubEventId) params.excludeSubEventId = excludeSubEventId;
        const res = await backendApi.get('/subevents/available-leads', {
          params,
        });
        return {
          coordinators: Array.isArray(res.data?.coordinators)
            ? res.data.coordinators
            : [],
          faculty: Array.isArray(res.data?.faculty) ? res.data.faculty : [],
        };
      } catch (err) {
        console.error('Failed to load available leads:', err);
        return { coordinators: [], faculty: [] };
      }
    },
    []
  );

  useEffect(() => {
    if (!newSubEvent.parentEventId) return;
    fetchAvailableLeads(newSubEvent.parentEventId).then(setAvailableLeads);
  }, [newSubEvent.parentEventId, events, fetchAvailableLeads]);

  const assignedMasterIds = useMemo(
    () => new Set(assignedMasterEvents.map((m) => Number(m.id))),
    [assignedMasterEvents]
  );

  const scopedSubEvents = useMemo(() => {
    return events.filter(
      (ev) =>
        ev.parentEventId != null &&
        assignedMasterIds.has(Number(ev.parentEventId))
    );
  }, [events, assignedMasterIds]);

  useEffect(() => {
    if (scopedSubEvents.length > 0 && !headBillForm.subEventId) {
      setHeadBillForm((prev) => ({
        ...prev,
        subEventId: String(scopedSubEvents[0].id),
      }));
    }
  }, [scopedSubEvents, headBillForm.subEventId]);

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

  const getApprovedSpentForSubEvent = (subEventId) =>
    scopedBills
      .filter(
        (b) =>
          Number(b.subEventId) === Number(subEventId) && b.status === 'APPROVED'
      )
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const metrics = useMemo(() => {
    const totalBudget = scopedSubEvents.reduce(
      (sum, se) => sum + (Number(se.budgetCap) || 0),
      0
    );
    const totalSpent = scopedBills
      .filter((b) => b.status === 'APPROVED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const totalAdvance = scopedSubEvents.reduce(
      (sum, se) => sum + (Number(se.advanceDisbursed) || 0),
      0
    );
    const burnRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    return { totalBudget, totalSpent, totalAdvance, burnRate };
  }, [scopedSubEvents, scopedBills]);

  const closureQueue = useMemo(() => {
    return scopedSubEvents.filter(
      (se) =>
        (se.closureRequested ||
          se.status === 'CLOSURE_PENDING' ||
          se.status === 'CLOSURE_REQUESTED') &&
        !se.studentHeadClosureApproved
    );
  }, [scopedSubEvents]);

  const toggleCreateId = (field, idVal) => {
    const numId = Number(idVal);
    setNewSubEvent((prev) => ({
      ...prev,
      [field]: prev[field].includes(numId)
        ? prev[field].filter((x) => x !== numId)
        : [...prev[field], numId],
    }));
  };

  const handleCreateSubEvent = async (e) => {
    e.preventDefault();
    const parentId = Number(newSubEvent.parentEventId);
    if (!assignedMasterIds.has(parentId)) {
      showBanner('error', 'Select one of your assigned Master Events.');
      return;
    }
    if (!newSubEvent.name.trim()) {
      showBanner('error', 'Sub-event name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const parentMaster = assignedMasterEvents.find(
        (m) => Number(m.id) === parentId
      );
      await backendApi.post('/subevents', {
        parentEventId: parentId,
        name: newSubEvent.name.trim(),
        department: newSubEvent.department,
        description: newSubEvent.description.trim(),
        budgetCap: Number(newSubEvent.budgetCap) || 0,
        advanceDisbursed: Number(newSubEvent.advanceDisbursed) || 0,
        coordinatorIds: newSubEvent.coordinatorIds,
        facultyIds: newSubEvent.facultyIds,
        createdDate: todayStr,
        eventYear: parentMaster?.eventYear || currentYear,
        actorUserId: user?.id,
        actorRole: user?.role || 'STUDENT_HEAD',
      });

      showBanner(
        'success',
        `Sub-event "${newSubEvent.name.trim()}" created and leads assigned.`
      );
      setNewSubEvent((prev) => ({
        ...prev,
        name: '',
        description: '',
        budgetCap: '',
        advanceDisbursed: '',
        coordinatorIds: [],
        facultyIds: [],
      }));
      await fetchDashboardData();
      setActiveTab('folders');
    } catch (err) {
      console.error('Failed to create sub-event:', err);
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to create sub-event.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleHeadReceiptChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningBill(true);
    const dataUrl = await fileToCompressedDataUrl(file);
    setHeadBillForm((prev) => ({
      ...prev,
      receiptImage: dataUrl,
      receiptFileName: file.name,
    }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      const ocrRes = await ocrApi.post('', formData);
      const extracted = ocrRes.data?.data || ocrRes.data || {};
      setHeadBillForm((prev) => ({
        ...prev,
        vendorName: extracted.vendorName || extracted.vendor_name || prev.vendorName,
        billNo: extracted.billNo || extracted.bill_number || prev.billNo,
        billDate: extracted.billDate || extracted.bill_date || prev.billDate,
        vendorGstin: extracted.vendorGstin || extracted.vendor_gstin || prev.vendorGstin,
        baseAmount:
          extracted.baseAmount !== undefined && extracted.baseAmount !== null
            ? String(extracted.baseAmount)
            : extracted.base_amount !== undefined
            ? String(extracted.base_amount)
            : prev.baseAmount,
        cgst:
          extracted.cgst !== undefined && extracted.cgst !== null
            ? String(extracted.cgst)
            : prev.cgst,
        sgst:
          extracted.sgst !== undefined && extracted.sgst !== null
            ? String(extracted.sgst)
            : prev.sgst,
        amount:
          extracted.amount !== undefined && extracted.amount !== null
            ? String(extracted.amount)
            : extracted.grand_total !== undefined
            ? String(extracted.grand_total)
            : prev.amount,
      }));
    } catch {
      // Allow manual entry if OCR is unavailable
    } finally {
      setIsScanningBill(false);
    }
  };

  // Student Head bill upload routes directly to PENDING_MAIN_HEAD
  const handleStudentHeadUploadBill = async (e) => {
    e.preventDefault();
    const targetSub = scopedSubEvents.find(
      (se) => String(se.id) === String(headBillForm.subEventId)
    );
    if (!targetSub) {
      showBanner('error', 'Select a sub-event under your assigned Master Event.');
      return;
    }
    if (!headBillForm.vendorName.trim() || !headBillForm.amount) {
      showBanner('error', 'Vendor name and total amount are required.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedAmount = parseFloat(headBillForm.amount) || 0;
      const parsedBase =
        headBillForm.baseAmount !== ''
          ? parseFloat(headBillForm.baseAmount) || 0
          : parsedAmount;
      const parsedCgst =
        headBillForm.cgst !== '' ? parseFloat(headBillForm.cgst) || 0 : 0;
      const parsedSgst =
        headBillForm.sgst !== '' ? parseFloat(headBillForm.sgst) || 0 : 0;

      await backendApi.post('/bills', {
        vendorName: headBillForm.vendorName.trim(),
        billNo:
          headBillForm.billNo.trim() || `INV-${Date.now().toString().slice(-4)}`,
        billDate: headBillForm.billDate || new Date().toISOString().split('T')[0],
        vendorGstin: headBillForm.vendorGstin.trim() || 'Unregistered',
        baseAmount: parsedBase,
        cgst: parsedCgst,
        sgst: parsedSgst,
        amount: parsedAmount,
        eventName: targetSub.name,
        subEventId: targetSub.id,
        description: headBillForm.description.trim() || '',
        receiptImage: headBillForm.receiptImage || null,
        uploadedById: user?.id,
        uploadedByName: user?.name || user?.username,
        uploadedByRole: 'STUDENT_HEAD',
        status: 'PENDING_MAIN_HEAD',
      });

      showBanner(
        'success',
        `Bill submitted for "${targetSub.name}" and routed directly to Main Event Head.`
      );
      setHeadBillForm((prev) => ({
        ...prev,
        vendorName: '',
        billNo: '',
        billDate: '',
        vendorGstin: '',
        baseAmount: '',
        cgst: '',
        sgst: '',
        amount: '',
        description: '',
        receiptImage: '',
        receiptFileName: '',
      }));
      await fetchDashboardData();
      setActiveTab('folders');
    } catch (err) {
      console.error('Student Head bill upload failed:', err);
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to submit bill.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFolder = async (subEvent) => {
    setSelectedFolder(subEvent);
    setFolderDetail(null);
    setLoadingFolder(true);
    try {
      const res = await backendApi.get(`/subevents/${subEvent.id}`, {
        params: {
          userId: user?.id,
          role: user?.role || 'STUDENT_HEAD',
        },
      });
      setFolderDetail(res.data);
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Unable to inspect sub-event folder.'
      );
      setSelectedFolder(null);
    } finally {
      setLoadingFolder(false);
    }
  };

  const handleApproveClosure = async (subEventId) => {
    try {
      await backendApi.put(`/subevents/${subEventId}/verify-closure`, {
        role: 'STUDENT_HEAD',
        userId: user?.id,
      });
      showBanner('success', 'Student Head closure approval recorded.');
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to approve sub-event closure.'
      );
    }
  };

  const openAdvanceModal = (subEvent) => {
    setAdvanceTarget(subEvent);
    setAdvanceAmount(String(subEvent.advanceDisbursed ?? 0));
  };

  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!advanceTarget) return;
    const numericVal = Number(advanceAmount);
    if (!Number.isFinite(numericVal) || numericVal < 0) {
      showBanner('error', 'Enter a valid non-negative advance amount.');
      return;
    }

    try {
      await backendApi.patch(`/subevents/${advanceTarget.id}/advance`, {
        advanceDisbursed: numericVal,
        actorUserId: user?.id,
        actorRole: user?.role || 'STUDENT_HEAD',
      });
      showBanner('success', `Advance updated for "${advanceTarget.name}".`);
      setAdvanceTarget(null);
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to update advance.'
      );
    }
  };

  const openEditModal = async (subEvent) => {
    setEditTarget(subEvent);
    const [detailRes, leads] = await Promise.all([
      backendApi
        .get(`/subevents/${subEvent.id}`, {
          params: { userId: user?.id, role: user?.role || 'STUDENT_HEAD' },
        })
        .catch(() => ({ data: subEvent })),
      fetchAvailableLeads(subEvent.parentEventId, subEvent.id),
    ]);

    const detail = detailRes.data || subEvent;
    const assignedCoordIds = detail.coordinators
      ? detail.coordinators.map((c) => Number(c.id))
      : parseIdList(detail.coordinatorIds);
    const assignedFacIds = detail.facultyHeads
      ? detail.facultyHeads.map((f) => Number(f.id))
      : parseIdList(detail.facultyIds);

    setEditLeads(leads);
    setEditForm({
      name: detail.name || '',
      department: detail.department || 'Computer Engineering',
      description: detail.description || '',
      budgetCap: detail.budgetCap ?? 0,
      advanceDisbursed: detail.advanceDisbursed ?? 0,
      coordinatorIds: assignedCoordIds,
      facultyIds: assignedFacIds,
    });
  };

  const toggleEditId = (field, idVal) => {
    const numId = Number(idVal);
    setEditForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(numId)
        ? prev[field].filter((x) => x !== numId)
        : [...prev[field], numId],
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await backendApi.put(`/subevents/${editTarget.id}`, {
        name: editForm.name.trim(),
        department: editForm.department,
        description: editForm.description.trim(),
        budgetCap: Number(editForm.budgetCap) || 0,
        advanceDisbursed: Number(editForm.advanceDisbursed) || 0,
        coordinatorIds: editForm.coordinatorIds,
        facultyIds: editForm.facultyIds,
        actorUserId: user?.id,
        actorRole: user?.role || 'STUDENT_HEAD',
      });
      showBanner('success', `Updated sub-event "${editForm.name}".`);
      setEditTarget(null);
      await fetchDashboardData();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.message || 'Failed to update sub-event.'
      );
    } finally {
      setSubmitting(false);
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
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'create', label: 'Create Sub-Event' },
    { id: 'upload', label: 'Upload Bill' },
    { id: 'folders', label: 'Sub-Event Folders', count: scopedSubEvents.length },
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
                Student Head Portal
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
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
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
                Loading assigned event data...
              </div>
            ) : assignedMasterEvents.length === 0 ? (
              <div className="bg-white border border-sage-200 rounded-xl p-6 text-sm text-stone-600">
                No Master Event is currently assigned to your account. Contact an Admin to assign you as a Student Head on a Master Event.
              </div>
            ) : (
              <>
                <div className="bg-white border border-sage-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                      Assigned Master Event Scope
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
                    {scopedSubEvents.length} scoped sub-event
                    {scopedSubEvents.length === 1 ? '' : 's'}
                  </div>
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Total Allocated Budget
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-1.5">
                          INR {metrics.totalBudget.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Approved Expenditure
                        </div>
                        <div className="text-2xl font-semibold text-sage-800 mt-1.5">
                          INR {metrics.totalSpent.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-white border border-sage-200 rounded-xl p-5">
                        <div className="text-xs text-stone-500">
                          Advance Disbursed
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-1.5">
                          INR {metrics.totalAdvance.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <MasterEventAnalytics
                      masterEvents={assignedMasterEvents}
                      subEvents={scopedSubEvents}
                      bills={scopedBills}
                    />

                    <div className="bg-white border border-sage-200 rounded-xl p-5">
                      <h2 className="text-base font-semibold text-stone-900 mb-3">
                        Closure Approval Queue
                      </h2>
                      {closureQueue.length === 0 ? (
                        <p className="text-xs text-stone-500">
                          No sub-events in your assigned Master Event(s) are awaiting Student Head closure approval.
                        </p>
                      ) : (
                        <div className="divide-y divide-sage-100">
                          {closureQueue.map((se) => (
                            <div
                              key={se.id}
                              className="py-3 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-medium text-stone-900">
                                  {se.name}
                                </div>
                                <div className="text-xs text-stone-500">
                                  {se.department || 'General'} &middot; Approved
                                  Spend: INR{' '}
                                  {getApprovedSpentForSubEvent(se.id).toLocaleString(
                                    'en-IN'
                                  )}{' '}
                                  / Cap: INR{' '}
                                  {(Number(se.budgetCap) || 0).toLocaleString(
                                    'en-IN'
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApproveClosure(se.id)}
                                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 cursor-pointer"
                              >
                                Approve Closure
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CREATE SUB-EVENT TAB */}
                {activeTab === 'create' && (
                  <section className="bg-white border border-sage-200 rounded-xl p-6 space-y-5">
                    <div className="pb-3 border-b border-sage-100">
                      <h2 className="text-base font-semibold text-stone-900">
                        Create Sub-Event &amp; Assign Leads
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Each Student Coordinator and Faculty Head can be assigned to only one sub-event per Master Event.
                      </p>
                    </div>

                    <form onSubmit={handleCreateSubEvent} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Parent Master Event *
                          </label>
                          <select
                            value={newSubEvent.parentEventId}
                            onChange={(e) =>
                              setNewSubEvent((prev) => ({
                                ...prev,
                                parentEventId: e.target.value,
                                coordinatorIds: [],
                                facultyIds: [],
                              }))
                            }
                            required
                            className={inputClass}
                          >
                            {assignedMasterEvents.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.eventYear ? `(${m.eventYear})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Sub-Event Name *
                          </label>
                          <input
                            type="text"
                            value={newSubEvent.name}
                            onChange={(e) =>
                              setNewSubEvent((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                            placeholder="e.g., Hackathon"
                            required
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Hosting Department / Branch *
                          </label>
                          <select
                            value={newSubEvent.department}
                            onChange={(e) =>
                              setNewSubEvent((p) => ({
                                ...p,
                                department: e.target.value,
                              }))
                            }
                            required
                            className={inputClass}
                          >
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Budget Cap (INR) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newSubEvent.budgetCap}
                            onChange={(e) =>
                              setNewSubEvent((p) => ({
                                ...p,
                                budgetCap: e.target.value,
                              }))
                            }
                            placeholder="e.g., 30000"
                            required
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Advance Disbursed (INR, Optional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={newSubEvent.advanceDisbursed}
                            onChange={(e) =>
                              setNewSubEvent((p) => ({
                                ...p,
                                advanceDisbursed: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Description (Optional)
                          </label>
                          <input
                            type="text"
                            value={newSubEvent.description}
                            onChange={(e) =>
                              setNewSubEvent((p) => ({
                                ...p,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Brief notes"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                          <p className="text-xs font-semibold text-stone-700">
                            Available Student Coordinators (
                            {newSubEvent.coordinatorIds.length} selected)
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {availableLeads.coordinators.length === 0 ? (
                              <p className="text-xs text-stone-400">
                                No unassigned Student Coordinators available for this Master Event.
                              </p>
                            ) : (
                              availableLeads.coordinators.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-2 text-xs text-stone-700 bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={newSubEvent.coordinatorIds.includes(
                                      Number(c.id)
                                    )}
                                    onChange={() =>
                                      toggleCreateId('coordinatorIds', c.id)
                                    }
                                  />
                                  <span className="font-medium">{c.name}</span>
                                  <span className="text-stone-400 ml-auto">
                                    {c.department || c.institutionalId}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                          <p className="text-xs font-semibold text-stone-700">
                            Available Faculty Heads (
                            {newSubEvent.facultyIds.length} selected)
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {availableLeads.faculty.length === 0 ? (
                              <p className="text-xs text-stone-400">
                                No unassigned Faculty Heads available for this Master Event.
                              </p>
                            ) : (
                              availableLeads.faculty.map((f) => (
                                <label
                                  key={f.id}
                                  className="flex items-center gap-2 text-xs text-stone-700 bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={newSubEvent.facultyIds.includes(
                                      Number(f.id)
                                    )}
                                    onChange={() =>
                                      toggleCreateId('facultyIds', f.id)
                                    }
                                  />
                                  <span className="font-medium">{f.name}</span>
                                  <span className="text-stone-400 ml-auto">
                                    {f.department || f.institutionalId}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                      >
                        {submitting ? 'Creating...' : 'Create Sub-Event'}
                      </button>
                    </form>
                  </section>
                )}

                {/* UPLOAD BILL TAB (Routes directly to Main Event Head) */}
                {activeTab === 'upload' && (
                  <section className="bg-white border border-sage-200 rounded-xl p-6 space-y-5 max-w-3xl">
                    <div className="pb-3 border-b border-sage-100">
                      <h2 className="text-base font-semibold text-stone-900">
                        Upload Bill (Direct to Main Event Head)
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Bills submitted by a Student Head route directly to the Main Event Head for approval.
                      </p>
                    </div>

                    {scopedSubEvents.length === 0 ? (
                      <p className="text-xs text-stone-500">
                        Create a sub-event under your assigned Master Event first before uploading a bill.
                      </p>
                    ) : (
                      <form
                        onSubmit={handleStudentHeadUploadBill}
                        className="space-y-4 text-xs"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Target Sub-Event *
                            </label>
                            <select
                              value={headBillForm.subEventId}
                              onChange={(e) =>
                                setHeadBillForm((p) => ({
                                  ...p,
                                  subEventId: e.target.value,
                                }))
                              }
                              required
                              className={inputClass}
                            >
                              {scopedSubEvents.map((se) => (
                                <option key={se.id} value={se.id}>
                                  {se.name} ({se.department || 'General'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Receipt / Invoice (Image / PDF)
                            </label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleHeadReceiptChange}
                              className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-sage-200 file:text-xs file:font-medium file:bg-sage-50 file:text-sage-800"
                            />
                            {isScanningBill && (
                              <span className="text-[11px] text-sage-700 mt-0.5 block">
                                Scanning receipt...
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Vendor Name *
                            </label>
                            <input
                              type="text"
                              value={headBillForm.vendorName}
                              onChange={(e) =>
                                setHeadBillForm((p) => ({
                                  ...p,
                                  vendorName: e.target.value,
                                }))
                              }
                              required
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Invoice / Bill No
                            </label>
                            <input
                              type="text"
                              value={headBillForm.billNo}
                              onChange={(e) =>
                                setHeadBillForm((p) => ({
                                  ...p,
                                  billNo: e.target.value,
                                }))
                              }
                              className={`${inputClass} font-mono`}
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Bill Date
                            </label>
                            <input
                              type="text"
                              placeholder="DD-MM-YYYY"
                              value={headBillForm.billDate}
                              onChange={(e) =>
                                setHeadBillForm((p) => ({
                                  ...p,
                                  billDate: e.target.value,
                                }))
                              }
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-stone-600 mb-1">
                              Grand Total (INR) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={headBillForm.amount}
                              onChange={(e) =>
                                setHeadBillForm((p) => ({
                                  ...p,
                                  amount: e.target.value,
                                }))
                              }
                              required
                              className={`${inputClass} font-semibold`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-medium text-stone-600 mb-1">
                            Description / Notes
                          </label>
                          <textarea
                            rows={2}
                            value={headBillForm.description}
                            onChange={(e) =>
                              setHeadBillForm((p) => ({
                                ...p,
                                description: e.target.value,
                              }))
                            }
                            className={inputClass}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submitting || isScanningBill}
                          className="px-5 py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                          {submitting
                            ? 'Submitting...'
                            : 'Submit to Main Event Head'}
                        </button>
                      </form>
                    )}
                  </section>
                )}

                {/* SUB-EVENT FOLDERS TAB */}
                {activeTab === 'folders' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scopedSubEvents.length === 0 ? (
                      <div className="col-span-full bg-white border border-sage-200 rounded-xl p-6 text-sm text-stone-500">
                        No sub-events created under your assigned Master Event(s) yet. Use the &ldquo;Create Sub-Event&rdquo; tab to add one.
                      </div>
                    ) : (
                      scopedSubEvents.map((se) => {
                        const spent = getApprovedSpentForSubEvent(se.id);
                        const cap = Number(se.budgetCap) || 0;
                        const pct =
                          cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;

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
                                <span className="text-[11px] px-2 py-0.5 rounded bg-sage-50 border border-sage-200 text-sage-800 font-medium">
                                  {se.status || 'OPEN'}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-1">
                                {se.department || 'Institutional'}
                              </p>
                              <div className="mt-3 text-xs text-stone-700 flex justify-between">
                                <span>
                                  Approved Spend: INR{' '}
                                  {spent.toLocaleString('en-IN')}
                                </span>
                                <span>
                                  Cap: INR {cap.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="text-xs text-stone-500 mt-1">
                                Advance: INR{' '}
                                {(
                                  Number(se.advanceDisbursed) || 0
                                ).toLocaleString('en-IN')}{' '}
                                &middot; Burn: {pct.toFixed(0)}%
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2 border-t border-sage-100">
                              <button
                                type="button"
                                onClick={() => handleOpenFolder(se)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 cursor-pointer"
                              >
                                Open Folder
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdvanceModal(se)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sage-200 text-stone-700 hover:bg-sage-50 cursor-pointer"
                              >
                                Update Advance
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(se)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sage-200 text-stone-700 hover:bg-sage-50 cursor-pointer"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* PROFILE TAB */}
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
                      <span className="text-stone-500">Role</span>
                      <span className="font-medium text-sage-800">
                        {user?.role || 'STUDENT_HEAD'}
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
              <h3 className="text-base font-semibold text-stone-900">
                Folder: {selectedFolder.name}
              </h3>
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
                <div className="grid grid-cols-3 gap-3 text-xs bg-sage-50/70 p-3.5 rounded-lg border border-sage-100">
                  <div>
                    <span className="text-stone-500 block">Budget Cap</span>
                    <strong className="text-stone-900">
                      INR{' '}
                      {(Number(selectedFolder.budgetCap) || 0).toLocaleString(
                        'en-IN'
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Approved Spend</span>
                    <strong className="text-sage-800">
                      INR{' '}
                      {getApprovedSpentForSubEvent(
                        selectedFolder.id
                      ).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Advance in Hand</span>
                    <strong className="text-stone-900">
                      INR{' '}
                      {(
                        Number(selectedFolder.advanceDisbursed) || 0
                      ).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-stone-700 mb-1">
                      Assigned Coordinators
                    </div>
                    {folderDetail?.coordinators?.length ? (
                      <ul className="list-disc pl-4 text-stone-600 space-y-0.5">
                        {folderDetail.coordinators.map((c) => (
                          <li key={c.id}>
                            {c.name} ({c.username})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-stone-400">None assigned</p>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-stone-700 mb-1">
                      Assigned Faculty Heads
                    </div>
                    {folderDetail?.facultyHeads?.length ? (
                      <ul className="list-disc pl-4 text-stone-600 space-y-0.5">
                        {folderDetail.facultyHeads.map((f) => (
                          <li key={f.id}>
                            {f.name} ({f.username})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-stone-400">None assigned</p>
                    )}
                  </div>
                </div>

                <SubEventAnalytics
                  allocatedBudget={Number(selectedFolder.budgetCap) || 0}
                  bills={folderBills}
                />

                <div>
                  <div className="font-semibold text-sm text-stone-800 mb-2">
                    Bills in Folder ({folderBills.length})
                  </div>
                  {folderBills.length === 0 ? (
                    <p className="text-xs text-stone-500">
                      No bills linked to this sub-event folder.
                    </p>
                  ) : (
                    <div className="border border-sage-200 rounded-lg divide-y divide-sage-100 text-xs">
                      {folderBills.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-medium text-stone-900">
                              {b.vendorName || `Bill #${b.id}`}
                            </div>
                            <div className="text-stone-500">
                              Status:{' '}
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${getStatusBadgeClass(
                                  b.status
                                )}`}
                              >
                                {b.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-stone-900">
                              INR {Number(b.amount || 0).toLocaleString('en-IN')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedBill(b)}
                              className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded text-xs font-medium cursor-pointer"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedBillForAudit(b.id)}
                              className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded text-xs font-medium cursor-pointer"
                            >
                              Logs
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* BILL INSPECTOR MODAL */}
      {selectedBill && (
        <div className="fixed inset-0 bg-stone-900/45 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 rounded-xl max-w-4xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sage-100">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  {selectedBill.vendorName} #{selectedBill.billNo || selectedBill.id}
                </h3>
                <p className="text-xs text-stone-500">
                  Status: {selectedBill.status} &middot; Amount: INR{' '}
                  {Number(selectedBill.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBill(null)}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>
            {(selectedBill.rejectionReason || selectedBill.remark) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                <strong>Remark:</strong>{' '}
                {selectedBill.rejectionReason || selectedBill.remark}
              </div>
            )}
            <ReceiptPreviewPane
              receiptImage={selectedBill.receiptImage}
              billNo={selectedBill.billNo || selectedBill.id}
            />
          </div>
        </div>
      )}

      {/* UPDATE ADVANCE MODAL */}
      {advanceTarget && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-40">
          <form
            onSubmit={handleSaveAdvance}
            className="bg-white border border-sage-200 rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-stone-900">
              Update Advance — {advanceTarget.name}
            </h3>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Advance Disbursed (INR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdvanceTarget(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-sage-200 text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 cursor-pointer"
              >
                Save Advance
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT SUB-EVENT MODAL */}
      {editTarget && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-40">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white border border-sage-200 rounded-xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-stone-900">
              Edit Sub-Event — {editTarget.name}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-stone-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-stone-600 mb-1">
                  Department
                </label>
                <select
                  value={editForm.department}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, department: e.target.value }))
                  }
                  className={inputClass}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-stone-600 mb-1">
                  Budget Cap (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.budgetCap}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, budgetCap: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium text-stone-600 mb-1">
                  Advance Disbursed (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.advanceDisbursed}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      advanceDisbursed: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-medium text-stone-600 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-sage-50/60 border border-sage-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-stone-700">
                  Eligible Coordinators
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {editLeads.coordinators.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-sage-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.coordinatorIds.includes(Number(c.id))}
                        onChange={() => toggleEditId('coordinatorIds', c.id)}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-sage-50/60 border border-sage-200 rounded-lg space-y-1.5">
                <div className="font-semibold text-stone-700">
                  Eligible Faculty Heads
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {editLeads.faculty.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-sage-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.facultyIds.includes(Number(f.id))}
                        onChange={() => toggleEditId('facultyIds', f.id)}
                      />
                      <span>{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-sage-200 text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-sage-600 text-white hover:bg-sage-700 cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
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