import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentHeadDashboard({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Folders'); // 'Folders', 'SubmitBill', 'Users'

  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubEventId, setEditingSubEventId] = useState(null);

  // OCR Processing State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [ocrScanned, setOcrScanned] = useState(false);

  // Sub-Event Form State
  const [newSubEvent, setNewSubEvent] = useState({
    name: '',
    department: 'Computer Engineering',
    budgetCap: '',
    studentCoordinatorId: '',
    facultyHeadId: '',
    description: ''
  });

  // Bill Submission Form State
  const [newBill, setNewBill] = useState({
    vendorName: '',
    billNo: '',
    billDate: new Date().toISOString().split('T')[0],
    amount: '',
    subEventId: '',
    description: ''
  });

  const DEPARTMENTS = [
    'Computer Engineering',
    'Information Technology',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Electronics & Telecommunication'
  ];

  useEffect(() => {
    fetchEvents();
    fetchBills();
    fetchUsers();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const fetchBills = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/bills');
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch (err) {
      console.error("Error fetching bills:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // 1. Identify active Master Event created by Main Event Head
  const masterEvent = events.find(ev => (ev.parentEventId === null || ev.parentEventId === undefined) && ev.status !== 'CLOSED');

  // 2. Filter Sub-Events belonging to the Master Event
  const subEvents = masterEvent 
    ? events.filter(ev => Number(ev.parentEventId) === Number(masterEvent.id))
    : [];

  const totalAllocatedBudget = masterEvent ? masterEvent.budgetCap : 0;
  const totalAuditedSpent = bills.reduce((acc, b) => acc + (b.amount || 0), 0);

  // Robust flexible user filters ensuring all role strings and variations match
  const studentCoordinators = users.filter(u => {
    const role = (u.role || '').toUpperCase();
    return role.includes('STUDENT') || role.includes('COORDINATOR') || role.includes('HEAD') || role === 'STUDENT';
  });

  const facultyHeads = users.filter(u => {
    const role = (u.role || '').toUpperCase();
    return role.includes('FACULTY') || role.includes('TEACHER') || role === 'FACULTY';
  });

  const getAssignedStudent = (subEventId) => studentCoordinators.find(
    u => Number(u.assignedSubEventId) === Number(subEventId)
  );
  const getAssignedFaculty = (subEventId) => facultyHeads.find(
    u => Number(u.assignedSubEventId) === Number(subEventId)
  );

  // Open modal for creation
  const handleOpenCreateModal = () => {
    setEditingSubEventId(null);
    setNewSubEvent({
      name: '',
      department: 'Computer Engineering',
      budgetCap: '',
      studentCoordinatorId: '',
      facultyHeadId: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (sub) => {
    const assignedStudent = getAssignedStudent(sub.id);
    const assignedFaculty = getAssignedFaculty(sub.id);
    setEditingSubEventId(sub.id);
    setNewSubEvent({
      name: sub.name || '',
      department: sub.department || 'Computer Engineering',
      budgetCap: sub.budgetCap || '',
      studentCoordinatorId: assignedStudent ? String(assignedStudent.id) : '',
      facultyHeadId: assignedFaculty ? String(assignedFaculty.id) : '',
      description: sub.description || ''
    });
    setIsModalOpen(true);
  };

  // Save Sub-Event
  const handleSaveSubEvent = async (e) => {
    e.preventDefault();
    if (!masterEvent) {
      alert("No active Master Event found! Please ask the Main Event Head to initiate a Master Event first.");
      return;
    }

    const payload = {
      wingName: masterEvent.wingName || masterEvent.name,
      name: newSubEvent.name,
      department: newSubEvent.department,
      description: newSubEvent.description,
      budgetCap: parseFloat(newSubEvent.budgetCap),
      parentEventId: masterEvent.id,
      studentCoordinatorId: newSubEvent.studentCoordinatorId ? Number(newSubEvent.studentCoordinatorId) : null,
      facultyHeadId: newSubEvent.facultyHeadId ? Number(newSubEvent.facultyHeadId) : null,
      status: 'OPEN'
    };

    try {
      let res;
      if (editingSubEventId) {
        res = await fetch(`http://localhost:8080/api/events/${editingSubEventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('http://localhost:8080/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        alert(editingSubEventId ? `Sub-Event updated successfully!` : `Sub-Event "${newSubEvent.name}" created successfully!`);
        setIsModalOpen(false);
        setEditingSubEventId(null);
        await Promise.all([fetchEvents(), fetchUsers()]);
      } else {
        const err = await res.json();
        alert('Operation failed: ' + (err.message || 'Unknown error'));
      }
    } catch (err) {
      console.error("Error saving sub-event:", err);
    }
  };

  // OCR Scan Handler (Connected to FastAPI backend on port 5000 /extract-bill)
  const handleOcrScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setOcrLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/extract-bill', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const extracted = result.data || {};
        
        setNewBill(prev => ({
          ...prev,
          vendorName: extracted.vendorName || 'Extracted Vendor',
          billNo: extracted.billNo || 'INV-2026-001',
          amount: extracted.amount ? String(extracted.amount) : '0',
          billDate: extracted.billDate || new Date().toISOString().split('T')[0],
          description: extracted.description || 'Auto-extracted via BillStack OCR'
        }));
        setOcrScanned(true);
        alert("OCR Scan Successful! Review the extracted particulars below.");
      } else {
        alert("OCR scan failed to process the image.");
      }
    } catch (err) {
      console.error("OCR service error:", err);
      alert("Could not connect to OCR service on port 5000. Make sure python Main.py is running.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Submit Bill Handler (Enters Pipeline: PENDING_FACULTY)
  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!newBill.subEventId) {
      alert("Please select a target sub-event folder for this bill.");
      return;
    }

    const selectedSub = subEvents.find(s => Number(s.id) === Number(newBill.subEventId));

    try {
      const res = await fetch('http://localhost:8080/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: newBill.vendorName,
          billNo: newBill.billNo,
          billDate: newBill.billDate,
          amount: parseFloat(newBill.amount),
          subEventId: Number(newBill.subEventId),
          eventName: selectedSub ? selectedSub.name : 'General',
          description: newBill.description,
          status: 'PENDING_FACULTY' // Enters approval pipeline at Faculty review
        })
      });

      if (res.ok) {
        alert("Bill successfully verified & submitted to Faculty review queue!");
        setNewBill({ vendorName: '', billNo: '', billDate: new Date().toISOString().split('T')[0], amount: '', subEventId: '', description: '' });
        setSelectedFile(null);
        setOcrScanned(false);
        fetchBills();
        setActiveTab('Folders');
      } else {
        alert("Failed to submit bill.");
      }
    } catch (err) {
      console.error("Error submitting bill:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-xl font-black text-white shadow-lg">
              B
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-violet-400">BillStack</span>
              <span className="block bg-violet-900/60 border border-violet-700 text-violet-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider w-fit mt-0.5">
                Student Head
              </span>
            </div>
          </div>

          <nav className="space-y-1.5 pt-4">
            <button
              onClick={() => setActiveTab('Folders')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'Folders' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>📁</span> Sub-Event Folders
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-extrabold">
                {subEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('SubmitBill')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'SubmitBill' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>🧾</span> Scan & Submit Bill
              </span>
            </button>

            <button
              onClick={() => setActiveTab('Users')}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                activeTab === 'Users' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <span>👥</span> Users & Coordinators
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-extrabold">
                {users.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-sm font-bold text-white">
              {user?.username ? user.username[0].toUpperCase() : 'S'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-slate-200">{user?.username || 'Student Head'}</p>
              <p className="text-[10px] text-slate-400 truncate">STUDENT HEAD</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-8 overflow-y-auto max-w-6xl space-y-6">
        
        {/* Master Event Portal Header */}
        <div className="flex justify-between items-center bg-violet-950 text-white p-6 rounded-2xl shadow-xl border border-violet-900">
          <div>
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Master Event Container</span>
            <h1 className="text-3xl font-black tracking-tight mt-0.5">
              {masterEvent ? (masterEvent.name || masterEvent.wingName) : 'No Active Master Event Initiated'}
            </h1>
            <p className="text-violet-200 text-xs mt-1">Logged in as {user?.username || 'Student Head'}</p>
          </div>
          <div>
            <button 
              onClick={handleOpenCreateModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-xl shadow transition flex items-center gap-1.5"
            >
              + Create Sub-Event
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Allocated Fest Budget</span>
            <h2 className="text-2xl font-black text-white mt-1">₹{totalAllocatedBudget?.toLocaleString('en-IN') || 0}</h2>
            <p className="text-xs text-slate-400 mt-1">{subEvents.length} Active Sub-Events Linked</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sub-Events Total Budget Cap</span>
            <h2 className="text-2xl font-black text-violet-400 mt-1">
              ₹{subEvents.reduce((acc, s) => acc + (s.budgetCap || 0), 0).toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Allocated across departments</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Audited Expenditure</span>
            <h2 className="text-2xl font-black text-emerald-400 mt-1">₹{totalAuditedSpent.toLocaleString('en-IN')}</h2>
            <p className="text-xs text-slate-400 mt-1">Drawn from verified invoices</p>
          </div>
        </div>

        {/* TAB 1: SUB-EVENT FOLDERS */}
        {activeTab === 'Folders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white">Sub-Event Folders & Resource Portfolios</h2>
              <span className="text-xs text-slate-400 italic">Managed under Master Event container</span>
            </div>

            {subEvents.length === 0 ? (
              <div className="bg-slate-800/40 p-12 text-center rounded-2xl border border-dashed border-slate-700">
                <p className="text-slate-400 font-semibold text-sm">No sub-events created under this Master Event yet.</p>
                <button 
                  onClick={handleOpenCreateModal}
                  className="mt-3 text-xs text-violet-400 font-bold hover:underline"
                >
                  + Create First Sub-Event
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subEvents.map(sub => {
                  const subBills = bills.filter(b => Number(b.subEventId) === Number(sub.id));
                  const subSpent = subBills.reduce((acc, b) => acc + (b.amount || 0), 0);
                  const assignedStudent = getAssignedStudent(sub.id);
                  const assignedFaculty = getAssignedFaculty(sub.id);

                  return (
                    <div key={sub.id} className="bg-slate-800/60 border border-slate-700 hover:border-violet-500 p-5 rounded-2xl shadow-sm transition space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-950 border border-violet-800 px-2 py-0.5 rounded-md">
                              {sub.department}
                            </span>
                            <h3 className="text-lg font-black text-white mt-2">📁 {sub.name}</h3>
                            <span className="text-[11px] font-mono text-slate-400">Sub-Event ID: #{sub.id}</span>
                          </div>
                          <button 
                            onClick={() => handleOpenEditModal(sub)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-violet-700 text-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            ✏️ Edit
                          </button>
                        </div>

                        <div className="bg-slate-900/60 p-3 rounded-xl space-y-2 text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span>Sanctioned Budget:</span>
                            <span className="font-bold text-white">₹{sub.budgetCap?.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Total Spent:</span>
                            <span className="font-bold text-emerald-400">₹{subSpent.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="border-t border-slate-800 pt-2 space-y-1">
                            <p className="text-slate-400">Student Coord: <span className="font-bold text-slate-200">{assignedStudent ? (assignedStudent.username || assignedStudent.name) : 'Unassigned'}</span></p>
                            <p className="text-slate-400">Faculty Head: <span className="font-bold text-slate-200">{assignedFaculty ? (assignedFaculty.username || assignedFaculty.name) : 'Unassigned'}</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SCAN & SUBMIT BILL (OCR VERIFICATION WORKFLOW) */}
        {activeTab === 'SubmitBill' && (
          <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl shadow-xl max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-white">Scan & Verify Bill via OCR</h2>
              <p className="text-xs text-slate-400 mt-1">Upload receipt photo. OCR extracts particulars below for verification. All extracted fields are read-only; add description and submit to pipeline.</p>
            </div>

            {/* OCR Upload Section */}
            <div className="bg-slate-900/80 border-2 border-dashed border-violet-500/50 p-6 rounded-2xl text-center space-y-3">
              <span className="text-3xl">📷</span>
              <div>
                <p className="text-xs font-bold text-white">Upload Receipt / Invoice Image</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG, JPEG (Processed by Tesseract OCR)</p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleOcrScan}
                className="hidden" 
                id="ocr-file-upload"
              />
              <label 
                htmlFor="ocr-file-upload" 
                className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition shadow"
              >
                {ocrLoading ? 'Extracting Data with OCR...' : 'Browse & Scan Receipt'}
              </label>
              {selectedFile && <p className="text-[11px] text-emerald-400 font-medium">Loaded: {selectedFile.name}</p>}
            </div>

            {/* Verification Form (OCR Extracted Data: Uneditable except description & folder) */}
            {ocrScanned && (
              <form onSubmit={handleBillSubmit} className="space-y-4 bg-slate-900/90 p-5 rounded-2xl border border-violet-500/30">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-violet-400">OCR Extracted Particulars (Verified Form)</h3>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">Extracted & Locked</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Target Sub-Event Folder</label>
                  <select
                    value={newBill.subEventId}
                    onChange={e => setNewBill({...newBill, subEventId: e.target.value})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white text-xs outline-none focus:border-violet-500"
                    required
                  >
                    <option value="">-- Select Sub-Event Folder --</option>
                    {subEvents.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.department}) - Budget: ₹{sub.budgetCap}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Vendor Name (OCR)</label>
                    <input
                      type="text"
                      value={newBill.vendorName}
                      disabled
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Invoice / Bill Number (OCR)</label>
                    <input
                      type="text"
                      value={newBill.billNo}
                      disabled
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bill Date (OCR)</label>
                    <input
                      type="date"
                      value={newBill.billDate}
                      disabled
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Amount (₹) (OCR)</label>
                    <input
                      type="number"
                      value={newBill.amount}
                      disabled
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-black cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Description / Notes (Editable)</label>
                  <textarea
                    rows={2}
                    value={newBill.description}
                    onChange={e => setNewBill({...newBill, description: e.target.value})}
                    placeholder="Add purchase notes or expense breakdown here..."
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-violet-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-md"
                >
                  Confirm & Forward to Faculty Review Pipeline
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: REGISTERED USERS DIRECTORY */}
        {activeTab === 'Users' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white">Registered Users & Department Coordinators</h2>
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">User ID</th>
                    <th className="py-3.5 px-4">Username / Name</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Roll / Staff ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono font-bold text-violet-400">#{u.id}</td>
                      <td className="py-3.5 px-4 font-bold text-white">{u.username || u.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 text-[10px] font-bold">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{u.department || 'N/A'}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{u.institutionalId || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* CREATE / EDIT SUB-EVENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">
                {editingSubEventId ? 'Edit Sub-Event & Assignments' : 'Create Sub-Event & Assign Leads'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSaveSubEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Parent Master Event</label>
                <input 
                  type="text" 
                  value={masterEvent ? (masterEvent.name || masterEvent.wingName) : 'No Master Event Found'} 
                  disabled 
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-slate-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Sub-Event Name</label>
                <input 
                  type="text" 
                  value={newSubEvent.name} 
                  onChange={e => setNewSubEvent({...newSubEvent, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-violet-500 text-xs" 
                  placeholder="e.g., Code-Sprint / Robo-Wars"
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Department Scope</label>
                <select 
                  value={newSubEvent.department} 
                  onChange={e => setNewSubEvent({...newSubEvent, department: e.target.value})}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white outline-none focus:border-violet-500 text-xs"
                  required
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Allocated Budget Cap (₹)</label>
                <input 
                  type="number" 
                  value={newSubEvent.budgetCap} 
                  onChange={e => setNewSubEvent({...newSubEvent, budgetCap: e.target.value})}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-violet-500 text-xs" 
                  placeholder="e.g., 30000"
                  required 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Student Coordinator
                  </label>
                  <select 
                    value={newSubEvent.studentCoordinatorId} 
                    onChange={e => setNewSubEvent({...newSubEvent, studentCoordinatorId: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="">-- Select Student Coord --</option>
                    {studentCoordinators.map(stu => (
                      <option key={stu.id} value={stu.id}>
                        {stu.username || stu.name} {stu.department ? `[${stu.department}]` : ''} (ID: {stu.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Faculty Head
                  </label>
                  <select 
                    value={newSubEvent.facultyHeadId} 
                    onChange={e => setNewSubEvent({...newSubEvent, facultyHeadId: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="">-- Select Faculty Head --</option>
                    {facultyHeads.map(fac => (
                      <option key={fac.id} value={fac.id}>
                        {fac.username || fac.name} {fac.department ? `[${fac.department}]` : ''} (ID: {fac.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Description / Notes</label>
                <textarea 
                  rows={2}
                  value={newSubEvent.description} 
                  onChange={e => setNewSubEvent({...newSubEvent, description: e.target.value})}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl font-semibold text-white outline-none focus:border-violet-500 text-xs" 
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-700 text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs transition"
                >
                  {editingSubEventId ? 'Update Sub-Event' : 'Save Sub-Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}