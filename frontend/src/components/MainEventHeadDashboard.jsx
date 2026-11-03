import React, { useState, useEffect } from 'react';

export default function MainEventHeadDashboard({ currentUser }) {
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);
  
  const [newMasterEvent, setNewMasterEvent] = useState({
    wingName: 'Wings',
    eventName: '',
    allocatedBudget: ''
  });

  const [activeTab, setActiveTab] = useState('events');

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("Amount doesn't match the bill");
  const [mainHeadRemark, setMainHeadRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const MASTER_EVENT_CATEGORIES = ['Wings', 'Antarang', 'Lakshya'];

  useEffect(() => {
    fetchEvents();
    fetchBills();
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

  // 1. Create Master Event
  const handleCreateMasterEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8080/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wingName: newMasterEvent.wingName,
          name: newMasterEvent.eventName.trim() !== '' ? newMasterEvent.eventName : (newMasterEvent.wingName + ' Master'),
          department: null,
          budgetCap: parseFloat(newMasterEvent.allocatedBudget),
          parentEventId: null,
          mainHeadId: currentUser?.id || 1,
          status: 'ACTIVE'
        })
      });
      if (res.ok) {
        alert('Master Event initiated successfully!');
        setNewMasterEvent({ wingName: 'Wings', eventName: '', allocatedBudget: '' });
        fetchEvents();
      }
    } catch (err) {
      console.error("Error creating master event:", err);
    }
  };

  // 2. Close Master Event Lifecycle (Removes it from UI view)
  const handleCloseEvent = async (eventId) => {
    const eventToClose = events.find(ev => ev.id === eventId);
    if (!eventToClose) return;

    if (!window.confirm(`Are you sure you want to close "${eventToClose.name || eventToClose.wingName}"? This will close the event and remove it from the active UI.`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8080/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...eventToClose,
          status: 'CLOSED'
        })
      });
      if (res.ok) {
        alert('Event closed successfully and removed from active view!');
        fetchEvents();
      }
    } catch (err) {
      console.error("Error closing event:", err);
    }
  };

  // 3. Main Event Head Approval Action
  const handleBillAction = async (billId, action) => {
    if (action === 'REJECTED') {
      setSelectedBillId(billId);
      setShowRejectModal(true);
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`http://localhost:8080/api/bills/${billId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }) // Triggers PENDING_MAIN_HEAD -> PENDING_PRINCIPAL progression
      });
      if (res.ok) {
        alert('Bill successfully approved and forwarded to Principal!');
        fetchBills();
      }
    } catch (err) {
      console.error("Error updating bill status:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Confirm Rejection with Reason
  const handleConfirmReject = async () => {
    if (!selectedBillId) return;
    try {
      setActionLoading(true);
      const res = await fetch(`http://localhost:8080/api/bills/${selectedBillId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason: rejectionReason,
          remark: mainHeadRemark || 'Rejected by Main Event Head',
          rejectedBy: 'MAIN_EVENT_HEAD'
        })
      });
      if (res.ok) {
        alert('Bill successfully rejected and returned to coordinator for correction!');
        setShowRejectModal(false);
        setSelectedBillId(null);
        setMainHeadRemark('');
        setRejectionReason("Amount doesn't match the bill");
        fetchBills();
      }
    } catch (err) {
      console.error("Error rejecting bill:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const pendingBills = bills.filter(b => b.status === 'PENDING_MAIN_HEAD');
  
  // Master events filter: parentEventId is null, and exclude closed events from UI display
  const activeMasterEvents = events.filter(ev => (ev.parentEventId === null || ev.parentEventId === undefined) && ev.status !== 'CLOSED');
  const allSubEvents = events.filter(ev => ev.parentEventId !== null && ev.parentEventId !== undefined);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-violet-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Main Event Head Control Center</h1>
          <p className="text-violet-200 text-sm mt-1">Overseeing Master Festival Events, Lifecycle Closure & Bill Approvals</p>
        </div>
        <div className="bg-violet-800 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-violet-700">
          Role: Main Event Head
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setActiveTab('events')} 
          className={`px-5 py-2.5 font-bold rounded-xl text-sm transition ${activeTab === 'events' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Master Events Management
        </button>
        <button 
          onClick={() => setActiveTab('approvals')} 
          className={`px-5 py-2.5 font-bold rounded-xl text-sm transition flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Bill Approvals
          {pendingBills.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-black">
              {pendingBills.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MASTER EVENTS MANAGEMENT & LIFECYCLE */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          
          {/* Create Master Event Form */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 max-w-2xl mx-auto space-y-4">
            <h2 className="text-xl font-black text-violet-950">Initiate Master Event</h2>
            <p className="text-xs text-slate-500">Create overarching festival master containers. Sub-events will be managed independently by Student Heads.</p>
            
            <form onSubmit={handleCreateMasterEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Master Category</label>
                <select 
                  value={newMasterEvent.wingName} 
                  onChange={e => setNewMasterEvent({...newMasterEvent, wingName: e.target.value})}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 bg-white outline-none focus:border-violet-600 text-sm"
                  required
                >
                  {MASTER_EVENT_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Master Event Name / Title</label>
                <input 
                  type="text" 
                  value={newMasterEvent.eventName} 
                  onChange={e => setNewMasterEvent({...newMasterEvent, eventName: e.target.value})}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-violet-600 text-sm" 
                  placeholder="e.g., Annual Tech Fest 2026 (Helps avoid ID confusion)"
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Master Event Budget Cap (₹)</label>
                <input 
                  type="number" 
                  value={newMasterEvent.allocatedBudget} 
                  onChange={e => setNewMasterEvent({...newMasterEvent, allocatedBudget: e.target.value})}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-violet-600 text-sm" 
                  placeholder="e.g., 150000"
                  required 
                />
              </div>

              <button type="submit" className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 transition shadow-md">
                Create Master Event
              </button>
            </form>
          </div>

          {/* Active Master Events & Lifecycle Control */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-black text-violet-950 mb-2">Active Master Events Overview</h2>
            <p className="text-xs text-slate-500 mb-6">Monitor active master events and their student-head created sub-events. Closing an event removes it from this active view.</p>
            
            {activeMasterEvents.length === 0 ? (
              <p className="text-slate-500 text-sm italic py-8 text-center">No active master events currently running.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeMasterEvents.map(master => {
                  const linkedSubEvents = allSubEvents.filter(sub => Number(sub.parentEventId) === Number(master.id));

                  return (
                    <div key={master.id} className="border-2 border-violet-200 bg-violet-50/40 rounded-2xl p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-violet-600">Category: {master.wingName}</span>
                          <h3 className="text-lg font-black text-slate-900 mt-0.5">{master.name}</h3>
                          <span className="text-[11px] font-mono text-slate-500">Database ID: #{master.id}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          ACTIVE
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-700">
                        <p>Budget Cap: <span className="font-black text-slate-900">₹{master.budgetCap}</span></p>
                      </div>

                      {/* Student-Head Created Sub-Events list */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Sub-Events ({linkedSubEvents.length})</h4>
                        {linkedSubEvents.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No sub-events created yet.</p>
                        ) : (
                          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                            {linkedSubEvents.map(sub => (
                              <li key={sub.id} className="bg-white p-2 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                                <span className="font-bold text-slate-800">{sub.name}</span>
                                <span className="text-violet-700 font-semibold text-[10px] bg-violet-100 px-2 py-0.5 rounded-md">{sub.department}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Close Event Lifecycle Action */}
                      <button 
                        onClick={() => handleCloseEvent(master.id)}
                        className="w-full bg-rose-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow"
                      >
                        Close Event 
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BILL APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <h2 className="text-xl font-black text-violet-950 mb-4">Bills Awaiting Main Event Head Review</h2>
          {pendingBills.length === 0 ? (
            <p className="text-slate-500 text-sm italic py-8 text-center">No bills currently pending your review in the conveyor belt.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <th className="p-3">Bill ID</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingBills.map(bill => (
                    <tr key={bill.billId || bill.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-violet-900">#{bill.billId || bill.id}</td>
                      <td className="p-3 font-semibold text-slate-800">{bill.vendorName}</td>
                      <td className="p-3 font-black text-slate-900">₹{bill.amount}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                          {bill.status}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button 
                          onClick={() => handleBillAction(bill.billId || bill.id, 'APPROVED')} 
                          className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleBillAction(bill.billId || bill.id, 'REJECTED')} 
                          className="bg-rose-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MANDATORY REJECTION MODAL ─── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Mandatory Rejection Feedback</h3>
            <p className="text-xs text-slate-500">
              Specify why this bill is being rejected and returned to the coordinator.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for rejection:
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium bg-white"
              >
                <option value="Amount doesn't match the bill">Amount doesn't match the bill</option>
                <option value="Missing or unreadable receipt image">Missing or unreadable receipt image</option>
                <option value="Unapproved vendor / Event out-of-scope">Unapproved vendor / Event out-of-scope</option>
                <option value="Sub-event budget allocation exceeded">Sub-event budget allocation exceeded</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Additional Remark (Optional):
              </label>
              <textarea
                rows={2}
                value={mainHeadRemark}
                onChange={(e) => setMainHeadRemark(e.target.value)}
                placeholder="Add specific notes for the student..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedBillId(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-md transition"
              >
                {actionLoading ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}