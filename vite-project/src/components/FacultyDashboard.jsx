import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FacultyDashboard({ user }) {
  const navigate = useNavigate();
  const userName = user.name || user.username || 'Faculty Member';
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [eventFilter, setEventFilter] = useState('All');

  // Modal States
  const [selectedBill, setSelectedBill] = useState(null);
  const [facultyRemark, setFacultyRemark] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Amount doesn\'t match the bill');

  // Mock Bills Data with Student & Event Context
  const [bills, setBills] = useState([
    {
      id: 'B102',
      studentName: 'Rahul Sharma',
      studentId: 'ENR-2024-089',
      event: 'Tech Fest 2026',
      branch: 'Computer Engineering',
      amount: '₹850',
      uploadedDate: '30/08/2026',
      status: 'Pending',
      ocrVendor: 'ABC Stationery',
      ocrDate: '29/08/2026',
      ocrAmount: '₹850',
      remark: '',
      rejectionReason: ''
    },
    {
      id: 'B109',
      studentName: 'Priya Patel',
      studentId: 'ENR-2024-112',
      event: 'Hackathon',
      branch: 'Information Technology',
      amount: '₹1,200',
      uploadedDate: '31/08/2026',
      status: 'Pending',
      ocrVendor: 'Grand Electronics',
      ocrDate: '30/08/2026',
      ocrAmount: '₹1,200',
      remark: '',
      rejectionReason: ''
    },
    {
      id: 'B115',
      studentName: 'Ananya Verma',
      studentId: 'ENR-2024-045',
      event: 'Cultural Fest',
      branch: 'Computer Engineering',
      amount: '₹650',
      uploadedDate: '31/08/2026',
      status: 'Approved',
      ocrVendor: 'City Decorators',
      ocrDate: '30/08/2026',
      ocrAmount: '₹650',
      remark: 'Verified with event organizer.',
      rejectionReason: ''
    }
  ]);

  const sidebarItems = [
    { label: 'Dashboard', icon: '🏠' },
    { label: 'All Bills', icon: '📄' },
    { label: 'Pending Approvals', icon: '⏳' },
    { label: 'Students', icon: '👥' },
    { label: 'Reports', icon: '📊' },
    { label: 'Profile', icon: '👤' },
  ];

  // Unique Events for Filtering
  const eventsList = ['All', 'Tech Fest 2026', 'Hackathon', 'Cultural Fest'];

  // Filter Logic
  const filteredBills = bills.filter((b) => {
    const matchesTab = activeTab === 'Pending Approvals' ? b.status === 'Pending' : true;
    const matchesEvent = eventFilter === 'All' ? true : b.event === eventFilter;
    return matchesTab && matchesEvent;
  });

  // Action Handlers
  const handleApprove = () => {
    setBills(bills.map(b => b.id === selectedBill.id ? { ...b, status: 'Approved', remark: facultyRemark } : b));
    closeModals();
  };

  const handleConfirmReject = () => {
    setBills(bills.map(b => b.id === selectedBill.id ? { 
      ...b, 
      status: 'Rejected', 
      remark: facultyRemark, 
      rejectionReason: rejectionReason 
    } : b));
    closeModals();
  };

  const closeModals = () => {
    setSelectedBill(null);
    setFacultyRemark('');
    setShowRejectModal(false);
    setRejectionReason('Amount doesn\'t match the bill');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* ─── NAVBAR ────────────────────────────────────────────── */}
      <header className="bg-violet-950 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-black tracking-wide text-violet-400">BillStack</span>
          <span className="bg-violet-800 text-violet-200 text-xs px-2 py-0.5 rounded-full font-semibold">Faculty Portal</span>
        </div>
        
        <div className="flex items-center space-x-6">
          <button className="relative text-violet-200 hover:text-white transition">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {bills.filter(b => b.status === 'Pending').length}
            </span>
          </button>
          
          <div className="flex items-center space-x-3 border-l border-violet-800 pl-4">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center font-bold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white leading-none">{userName}</p>
              <p className="text-xs text-violet-300">Faculty / Verifier</p>
            </div>
            <button 
              onClick={() => navigate('/')} 
              className="ml-2 text-xs bg-violet-800 hover:bg-violet-700 text-violet-200 px-2.5 py-1 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN BODY ─────────────────────────────────────────── */}
      <div className="flex flex-1">
        
        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r border-violet-100 p-4 hidden md:block">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  activeTab === item.label
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-900'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* CONTENT */}
        <main className="flex-1 p-6 md:p-8 space-y-6">
          
          {/* Header & Event Context Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-violet-950">Review & Approve Expenses</h1>
              <p className="text-slate-500 text-sm mt-0.5">Filter student submissions by event context to authorize payments.</p>
            </div>

            {/* Event Context Filter Dropdown */}
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-violet-100 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Event Filter:</span>
              <select 
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="text-sm font-semibold text-violet-950 bg-transparent focus:outline-none cursor-pointer"
              >
                {eventsList.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {/* Metric Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</p>
                <p className="text-3xl font-extrabold text-amber-600 mt-1">
                  {bills.filter(b => b.status === 'Pending').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">⏳</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Bills</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {bills.filter(b => b.status === 'Approved').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">✅</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</p>
                <p className="text-3xl font-extrabold text-red-600 mt-1">
                  {bills.filter(b => b.status === 'Rejected').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-xl font-bold">❌</div>
            </div>
          </div>

          {/* Main Bills Table */}
          <div className="bg-white p-6 rounded-2xl border border-violet-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-violet-950">Submitted Bills</h2>
              <span className="text-xs bg-violet-100 text-violet-800 font-semibold px-2.5 py-1 rounded-md">
                Showing: {eventFilter}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Event Name</th>
                    <th className="py-3 px-4">Bill ID</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Uploaded On</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50 text-sm">
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-violet-50/50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{bill.studentName}</td>
                      <td className="py-3 px-4 font-medium text-violet-800">{bill.event}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{bill.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{bill.amount}</td>
                      <td className="py-3 px-4 text-slate-500">{bill.uploadedDate}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${
                          bill.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          bill.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                            bill.status === 'Pending'
                              ? 'bg-violet-600 hover:bg-violet-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {bill.status === 'Pending' ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* ─── REVIEW MODAL ─────────────────────────────────────── */}
      {selectedBill && !showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-violet-950 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Review Bill Details</h3>
                <p className="text-xs text-violet-300">ID: {selectedBill.id} • Submitted by {selectedBill.studentName}</p>
              </div>
              <button onClick={closeModals} className="text-slate-300 hover:text-white text-xl font-bold">✕</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-800">
              
              {/* BILL DETAILS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">BILL DETAILS</h4>
                <div className="grid grid-cols-2 gap-y-2">
                  <p><strong>Student Name:</strong> {selectedBill.studentName}</p>
                  <p><strong>Event Name:</strong> {selectedBill.event}</p>
                  <p><strong>Bill ID:</strong> {selectedBill.id}</p>
                  <p><strong>Uploaded Date:</strong> {selectedBill.uploadedDate}</p>
                  <p className="col-span-2 text-base font-extrabold text-violet-950 mt-1">
                    Amount: <span className="text-violet-700">{selectedBill.amount}</span>
                  </p>
                </div>
              </div>

              {/* UPLOADED BILL PREVIEW */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uploaded Bill</h4>
                <div className="border-2 border-dashed border-slate-300 bg-slate-100 rounded-xl h-40 flex flex-col items-center justify-center text-slate-500">
                  <span className="text-3xl mb-1">🧾</span>
                  <p className="text-xs font-semibold">[ Bill / Receipt Image Preview ]</p>
                  <p className="text-[11px] text-slate-400">File: receipt_{selectedBill.id}.png</p>
                </div>
              </div>

              {/* EXTRACTED OCR DETAILS */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-violet-900 uppercase tracking-wider">Extracted Details (OCR)</h4>
                  <span className="text-[10px] bg-violet-200 text-violet-800 font-bold px-2 py-0.5 rounded">Auto-Parsed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-slate-500 block">Vendor</span>
                    <strong className="text-slate-800 text-sm">{selectedBill.ocrVendor}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bill Date</span>
                    <strong className="text-slate-800 text-sm">{selectedBill.ocrDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Amount</span>
                    <strong className="text-slate-800 text-sm">{selectedBill.ocrAmount}</strong>
                  </div>
                </div>
              </div>

              {/* FACULTY REMARKS */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Faculty Remarks</label>
                <input
                  type="text"
                  placeholder="Add any verification note or remark..."
                  value={facultyRemark}
                  onChange={(e) => setFacultyRemark(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-sm"
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end space-x-3">
              {selectedBill.status === 'Pending' ? (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg font-semibold text-sm transition shadow-sm"
                  >
                    ❌ Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold text-sm transition shadow-sm"
                  >
                    ✓ Approve
                  </button>
                </>
              ) : (
                <button
                  onClick={closeModals}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold text-sm transition"
                >
                  Close
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─── MANDATORY REJECTION MODAL ─────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            
            <div className="flex items-center space-x-3 text-red-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900">Mandatory Rejection Reason</h3>
            </div>

            <p className="text-xs text-slate-500">
              Please specify the reason for rejecting <strong>{selectedBill?.studentName}&apos;s</strong> bill. This feedback will be sent directly to the student.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Reason for rejection:</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="Amount doesn't match the bill">Amount doesn't match the bill</option>
                <option value="Invalid receipt / Blurred image">Invalid receipt / Blurred image</option>
                <option value="Duplicate submission">Duplicate submission</option>
                <option value="Unapproved vendor / Event out-of-scope">Unapproved vendor / Event out-of-scope</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md transition"
              >
                Confirm Rejection
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}