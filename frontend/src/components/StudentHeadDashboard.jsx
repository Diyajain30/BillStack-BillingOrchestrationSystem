import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function StudentHeadDashboard({ user }) {
  const navigate = useNavigate();
  const [subEvents, setSubEvents] = useState([]);
  const [allBills, setAllBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Folder View & Inspect State
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loadingFolder, setLoadingFolder] = useState(false);

  // Create Sub-Event State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Engineering');
  const [description, setDescription] = useState('');
  const [budgetCap, setBudgetCap] = useState('');
  const [advanceDisbursed, setAdvanceDisbursed] = useState('');
  const [availableCoordinators, setAvailableCoordinators] = useState([]);
  const [availableFaculty, setAvailableFaculty] = useState([]);
  const [selectedCoordinators, setSelectedCoordinators] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState([]);

  // Edit Sub-Event State
  const [editingSubEvent, setEditingSubEvent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('Computer Engineering');
  const [editDescription, setEditDescription] = useState('');
  const [editBudgetCap, setEditBudgetCap] = useState('');
  const [editAdvanceDisbursed, setEditAdvanceDisbursed] = useState('');
  const [editCandidatesCoords, setEditCandidatesCoords] = useState([]);
  const [editCandidatesFaculty, setEditCandidatesFaculty] = useState([]);
  const [editSelectedCoords, setEditSelectedCoords] = useState([]);
  const [editSelectedFaculty, setEditSelectedFaculty] = useState([]);

  // Quick Inline Advance Edit
  const [editingAdvanceId, setEditingAdvanceId] = useState(null);
  const [advanceInput, setAdvanceInput] = useState('');

  const departments = [
    'Computer Engineering',
    'Information Technology',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Electronics & Telecommunication',
  ];

  const fetchSubEvents = async () => {
    try {
      const [eventsRes, billsRes] = await Promise.all([
        axios.get('http://localhost:8080/api/subevents'),
        axios.get('http://localhost:8080/api/bills').catch(() => ({ data: [] })),
      ]);
      setSubEvents(eventsRes.data);
      setAllBills(Array.isArray(billsRes.data) ? billsRes.data : []);
    } catch (err) {
      console.error('Failed to load sub-events:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedLeads = async (dept) => {
    try {
      const [coordRes, facRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/subevents/unassigned-users?role=STUDENT_COORDINATOR&department=${encodeURIComponent(dept)}`),
        axios.get(`http://localhost:8080/api/subevents/unassigned-users?role=FACULTY&department=${encodeURIComponent(dept)}`),
      ]);
      setAvailableCoordinators(coordRes.data);
      setAvailableFaculty(facRes.data);
    } catch (err) {
      console.error('Failed to fetch unassigned users:', err);
    }
  };

  const openFolderDetails = async (subEventId) => {
    try {
      setLoadingFolder(true);
      const res = await axios.get(`http://localhost:8080/api/subevents/${subEventId}`);
      setSelectedFolder(res.data);
    } catch (err) {
      alert('Failed to load sub-event folder details');
    } finally {
      setLoadingFolder(false);
    }
  };

  const openEditModal = async (subEvent) => {
    setEditingSubEvent(subEvent);
    setEditName(subEvent.name);
    setEditDepartment(subEvent.department);
    setEditDescription(subEvent.description || '');
    setEditBudgetCap(subEvent.budgetCap);
    setEditAdvanceDisbursed(subEvent.advanceDisbursed || 0);

    try {
      const [detailRes, candidatesRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/subevents/${subEvent.id}`),
        axios.get(`http://localhost:8080/api/subevents/${subEvent.id}/candidates?department=${encodeURIComponent(subEvent.department)}`),
      ]);

      const currentCoords = detailRes.data.coordinators?.map((u) => u.id) || [];
      const currentFac = detailRes.data.facultyHeads?.map((u) => u.id) || [];

      setEditSelectedCoords(currentCoords);
      setEditSelectedFaculty(currentFac);
      setEditCandidatesCoords(candidatesRes.data.coordinators || []);
      setEditCandidatesFaculty(candidatesRes.data.faculty || []);
    } catch (err) {
      console.error('Error fetching edit candidates:', err);
    }
  };

  useEffect(() => {
    fetchSubEvents();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      fetchUnassignedLeads(department);
      setSelectedCoordinators([]);
      setSelectedFaculty([]);
    }
  }, [department, showCreateModal]);

  const handleCreateSubEvent = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        department,
        description,
        budgetCap: parseFloat(budgetCap),
        advanceDisbursed: advanceDisbursed ? parseFloat(advanceDisbursed) : 0.0,
        coordinatorIds: selectedCoordinators,
        facultyIds: selectedFaculty,
      };

      await axios.post('http://localhost:8080/api/subevents', payload);
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setBudgetCap('');
      setAdvanceDisbursed('');
      fetchSubEvents();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create sub-event.');
    }
  };

  const handleUpdateSubEvent = async (e) => {
    e.preventDefault();
    if (!editingSubEvent) return;

    try {
      const payload = {
        name: editName,
        department: editDepartment,
        description: editDescription,
        budgetCap: parseFloat(editBudgetCap),
        advanceDisbursed: parseFloat(editAdvanceDisbursed) || 0.0,
        coordinatorIds: editSelectedCoords,
        facultyIds: editSelectedFaculty,
      };

      await axios.put(`http://localhost:8080/api/subevents/${editingSubEvent.id}`, payload);
      setEditingSubEvent(null);
      fetchSubEvents();
      if (selectedFolder && selectedFolder.id === editingSubEvent.id) {
        openFolderDetails(editingSubEvent.id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update sub-event particulars.');
    }
  };

  const handleSaveAdvance = async (id) => {
    if (!advanceInput || isNaN(advanceInput)) return;
    try {
      await axios.patch(`http://localhost:8080/api/subevents/${id}/advance`, {
        advanceDisbursed: parseFloat(advanceInput),
      });
      setEditingAdvanceId(null);
      setAdvanceInput('');
      fetchSubEvents();
      if (selectedFolder && selectedFolder.id === id) {
        openFolderDetails(id);
      }
    } catch (err) {
      alert('Error updating advance payment');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const totalFestBudget = subEvents.reduce((acc, s) => acc + (s.budgetCap || 0), 0);
  const totalFestAdvance = subEvents.reduce((acc, s) => acc + (s.advanceDisbursed || 0), 0);
  const totalFestSpent = subEvents.reduce((acc, s) => acc + (s.totalSpent || 0), 0);

  // Filter bills belonging to the opened folder
  const folderBills = selectedFolder
    ? allBills.filter(
        (b) =>
          b.eventName?.toLowerCase().includes(selectedFolder.name.toLowerCase()) ||
          b.subEventId === selectedFolder.id
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-violet-950 text-white px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-violet-800 text-white font-black px-3 py-1.5 rounded-lg text-lg tracking-wider">
            BillStack
          </div>
          <div>
            <h1 className="text-lg font-bold">Wings Fest Master Portal</h1>
            <p className="text-xs text-violet-300">Logged in as {user.name} (Student Head)</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm"
          >
            + Create Sub-Event
          </button>
          <button
            onClick={handleLogout}
            className="bg-violet-800 hover:bg-violet-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Aggregate Fest Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Allocated Fest Budget</p>
            <p className="text-3xl font-black text-violet-950 mt-1">₹{totalFestBudget.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-1">{subEvents.length} Active Sub-Events</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Physical Cash Advances Logged</p>
            <p className="text-3xl font-black text-amber-600 mt-1">₹{totalFestAdvance.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-1">Reconciled against offline vouchers</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Audited Expenditure</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">₹{totalFestSpent.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400 mt-1">Drawn from verified invoices</p>
          </div>
        </div>

        {/* Sub-Events Overview Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Sub-Event Folders & Resource Portfolios</h2>
            <span className="text-xs text-slate-500">Click on any folder card to view bills and edit particulars</span>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading sub-events...</p>
          ) : subEvents.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500 font-medium">No sub-events created yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-3 bg-violet-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Create First Sub-Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:border-violet-300 hover:shadow-md transition cursor-pointer"
                  onClick={() => openFolderDetails(evt.id)}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 bg-violet-100 text-violet-800 rounded-full">
                        {evt.department}
                      </span>
                      <span className="text-xs font-bold text-slate-400">ID: #{evt.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>📁</span> {evt.name}
                    </h3>
                    {evt.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{evt.description}</p>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 text-xs border border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-500">Sanctioned Budget:</span>
                      <span className="font-bold text-slate-900">₹{evt.budgetCap?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-slate-500">Advance Given:</span>
                      {editingAdvanceId === evt.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={advanceInput}
                            onChange={(e) => setAdvanceInput(e.target.value)}
                            placeholder="Amount"
                            className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-xs outline-none"
                          />
                          <button
                            onClick={() => handleSaveAdvance(evt.id)}
                            className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAdvanceId(null)}
                            className="text-slate-400 hover:text-slate-600 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-700">₹{evt.advanceDisbursed?.toLocaleString('en-IN')}</span>
                          <button
                            onClick={() => {
                              setEditingAdvanceId(evt.id);
                              setAdvanceInput(evt.advanceDisbursed || '');
                            }}
                            className="text-violet-600 hover:underline font-bold text-[10px]"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-500">Total Spent:</span>
                      <span className="font-bold text-emerald-700">₹{evt.totalSpent?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openFolderDetails(evt.id)}
                      className="text-violet-700 hover:text-violet-900 font-bold flex items-center gap-1"
                    >
                      <span>📂</span> Open Folder
                    </button>
                    <button
                      onClick={() => openEditModal(evt)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg transition"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── SUB-EVENT FOLDER INSPECTOR MODAL ───────────────────────── */}
      {selectedFolder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📁</span>
                  <h3 className="text-xl font-black text-slate-900">{selectedFolder.name}</h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-md">
                    {selectedFolder.department}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Status: <span className="font-bold text-slate-800">{selectedFolder.status}</span> • Fest: {selectedFolder.festName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(selectedFolder)}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <span>✏️</span> Edit Sub-Event
                </button>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Financial Ledger Metric Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sanctioned Budget</span>
                <p className="text-lg font-black text-slate-900 mt-0.5">₹{selectedFolder.budgetCap?.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cash Advance Given</span>
                <p className="text-lg font-black text-amber-600 mt-0.5">₹{selectedFolder.advanceDisbursed?.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Expenditure</span>
                <p className="text-lg font-black text-violet-700 mt-0.5">₹{selectedFolder.totalSpent?.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Remaining Fund</span>
                <p className="text-lg font-black text-emerald-600 mt-0.5">
                  ₹{(selectedFolder.budgetCap - selectedFolder.totalSpent)?.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Description & Assigned Leads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Folder Scope & Description</span>
                <p className="text-slate-700 font-medium">{selectedFolder.description || 'No description provided.'}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Assigned Student Coordinators:</span>
                  <p className="text-slate-800 font-bold mt-0.5">
                    {selectedFolder.coordinators?.length > 0
                      ? selectedFolder.coordinators.map((c) => `${c.name} (${c.institutionalId})`).join(', ')
                      : 'None assigned yet'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">Assigned Faculty Head(s):</span>
                  <p className="text-violet-900 font-bold mt-0.5">
                    {selectedFolder.facultyHeads?.length > 0
                      ? selectedFolder.facultyHeads.map((f) => `${f.name} (${f.institutionalId})`).join(', ')
                      : 'None assigned yet'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bills / Invoices Under This Sub-Event */}
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📑</span> Invoices Uploaded Under This Sub-Event ({folderBills.length})
              </h4>

              {folderBills.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                  No invoices uploaded for this sub-event yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="py-2.5 px-3">Invoice No</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Conveyor Gate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {folderBills.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-violet-800 font-bold">{b.billNo}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{b.vendorName}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{Number(b.amount).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-slate-500">{b.billDate}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800">
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT SUB-EVENT MODAL ───────────────────────────────────── */}
      {editingSubEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Edit Sub-Event: {editingSubEvent.name}</h3>
              <button onClick={() => setEditingSubEvent(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSubEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Event Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hosting Department</label>
                <select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-violet-600"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Budget Cap (₹)</label>
                  <input
                    type="number"
                    required
                    value={editBudgetCap}
                    onChange={(e) => setEditBudgetCap(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cash Advance (₹)</label>
                  <input
                    type="number"
                    value={editAdvanceDisbursed}
                    onChange={(e) => setEditAdvanceDisbursed(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>

              {/* Coordinator Multi-Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Student Coordinators ({editDepartment})
                </label>
                {editCandidatesCoords.length === 0 ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    No coordinators registered under this department yet.
                  </p>
                ) : (
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {editCandidatesCoords.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          value={c.id}
                          checked={editSelectedCoords.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setEditSelectedCoords([...editSelectedCoords, c.id]);
                            else setEditSelectedCoords(editSelectedCoords.filter((id) => id !== c.id));
                          }}
                        />
                        <span>{c.name} ({c.institutionalId})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Faculty Multi-Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Faculty Heads ({editDepartment})
                </label>
                {editCandidatesFaculty.length === 0 ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    No faculty registered under this department yet.
                  </p>
                ) : (
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {editCandidatesFaculty.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          value={f.id}
                          checked={editSelectedFaculty.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) setEditSelectedFaculty([...editSelectedFaculty, f.id]);
                            else setEditSelectedFaculty(editSelectedFaculty.filter((id) => id !== f.id));
                          }}
                        />
                        <span>{f.name} ({f.institutionalId})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingSubEvent(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CREATE SUB-EVENT MODAL ─────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Provision New Sub-Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Coding Competition"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hosting Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none bg-white focus:ring-2 focus:ring-violet-600"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Budget Cap (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g., 40000"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Cash Advance (₹)</label>
                  <input
                    type="number"
                    placeholder="Optional (defaults to 0)"
                    value={advanceDisbursed}
                    onChange={(e) => setAdvanceDisbursed(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Provide scope notes or physical venue details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Student Coordinators ({department})
                </label>
                {availableCoordinators.length === 0 ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    No unassigned coordinators found for this department.
                  </p>
                ) : (
                  <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {availableCoordinators.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          value={c.id}
                          checked={selectedCoordinators.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCoordinators([...selectedCoordinators, c.id]);
                            else setSelectedCoordinators(selectedCoordinators.filter((id) => id !== c.id));
                          }}
                        />
                        <span>{c.name} ({c.institutionalId})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Faculty Heads ({department})
                </label>
                {availableFaculty.length === 0 ? (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    No unassigned faculty found for this department.
                  </p>
                ) : (
                  <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {availableFaculty.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          value={f.id}
                          checked={selectedFaculty.includes(f.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedFaculty([...selectedFaculty, f.id]);
                            else setSelectedFaculty(selectedFaculty.filter((id) => id !== f.id));
                          }}
                        />
                        <span>{f.name} ({f.institutionalId})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save & Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}