import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const userName = user?.name || user?.username || 'Admin User';
  const [activeTab, setActiveTab] = useState('Dashboard');

  // ─── STATE MANAGEMENT ──────────────────────────────────────────────
  const [events, setEvents] = useState([
    { id: 'E101', name: 'Tech Fest 2026', startDate: '15/08/2026', endDate: '17/08/2026', budget: '₹50,000', billsCount: 42, spent: '₹38,500', status: 'Active' },
    { id: 'E102', name: 'Hackathon', startDate: '20/08/2026', endDate: '21/08/2026', budget: '₹30,000', billsCount: 28, spent: '₹22,400', status: 'Active' },
    { id: 'E103', name: 'Cultural Fest', startDate: '25/08/2026', endDate: '27/08/2026', budget: '₹75,000', billsCount: 35, spent: '₹45,000', status: 'Active' },
  ]);

  const [bills, setBills] = useState([
    { id: 'B102', student: 'Rahul Sharma', dept: 'IT', event: 'Tech Fest 2026', amount: '850', facultyStatus: 'Approved', paymentStatus: 'Pending', date: '30/08/2026', txnId: '' },
    { id: 'B109', student: 'Priya Patel', dept: 'CSE', event: 'Hackathon', amount: '1200', facultyStatus: 'Approved', paymentStatus: 'Paid', date: '31/08/2026', txnId: 'TXN-984210' },
    { id: 'B115', student: 'Ananya Verma', dept: 'ECE', event: 'Cultural Fest', amount: '650', facultyStatus: 'Approved', paymentStatus: 'Pending', date: '31/08/2026', txnId: '' },
    { id: 'B118', student: 'Aman Gupta', dept: 'MECH', event: 'Tech Fest 2026', amount: '1500', facultyStatus: 'Pending', paymentStatus: 'Pending', date: '01/09/2026', txnId: '' },
    { id: 'B120', student: 'Siddharth Rao', dept: 'IT', event: 'Hackathon', amount: '450', facultyStatus: 'Rejected', paymentStatus: '—', date: '01/09/2026', txnId: '' },
  ]);

  const [students] = useState([
    { name: 'Rahul Sharma', dept: 'IT', bills: 8, approved: 6, pending: 1, totalAmount: '₹5,400' },
    { name: 'Priya Patel', dept: 'CSE', bills: 5, approved: 4, pending: 0, totalAmount: '₹4,200' },
    { name: 'Ananya Verma', dept: 'ECE', bills: 4, approved: 3, pending: 1, totalAmount: '₹2,800' },
  ]);

  const [faculty] = useState([
    { name: 'Dr. A. K. Sharma', dept: 'IT', eventsAssigned: 'Tech Fest 2026', pendingReviews: 3 },
    { name: 'Prof. S. Patil', dept: 'CSE', eventsAssigned: 'Hackathon', pendingReviews: 1 },
    { name: 'Dr. M. Mehta', dept: 'ECE', eventsAssigned: 'Cultural Fest', pendingReviews: 0 },
  ]);

  // Modals & Filters
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', description: '', startDate: '', endDate: '', budget: '' });

  const [paymentModalBill, setPaymentModalBill] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [transactionId, setTransactionId] = useState('');

  const [billFilterEvent, setBillFilterEvent] = useState('All');
  const [billFilterStatus, setBillFilterStatus] = useState('All');
  const [searchStudent, setSearchStudent] = useState('');

  // ─── ACTION HANDLERS ──────────────────────────────────────────────
  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!newEvent.name || !newEvent.budget) return;
    const created = {
      id: `E${100 + events.length + 1}`,
      name: newEvent.name,
      startDate: newEvent.startDate || '15/09/2026',
      endDate: newEvent.endDate || '17/09/2026',
      budget: `₹${Number(newEvent.budget).toLocaleString('en-IN')}`,
      billsCount: 0,
      spent: '₹0',
      status: 'Active'
    };
    setEvents([...events, created]);
    setShowCreateEventModal(false);
    setNewEvent({ name: '', description: '', startDate: '', endDate: '', budget: '' });
  };

  const handleProcessPayment = () => {
    if (!transactionId) return;
    setBills(bills.map(b => b.id === paymentModalBill.id ? {
      ...b,
      paymentStatus: 'Paid',
      txnId: transactionId
    } : b));
    setPaymentModalBill(null);
    setTransactionId('');
  };

  // ─── FILTER LOGIC ────────────────────────────────────────────────
  const filteredBills = bills.filter(b => {
    const matchesEvent = billFilterEvent === 'All' || b.event === billFilterEvent;
    const matchesStatus = billFilterStatus === 'All' ||
      (billFilterStatus === 'Ready' && b.facultyStatus === 'Approved' && b.paymentStatus === 'Pending') ||
      (billFilterStatus === 'Paid' && b.paymentStatus === 'Paid') ||
      (billFilterStatus === 'Rejected' && b.facultyStatus === 'Rejected');
    const matchesStudent = b.student.toLowerCase().includes(searchStudent.toLowerCase());
    return matchesEvent && matchesStatus && matchesStudent;
  });

  const pendingPayments = bills.filter(b => b.facultyStatus === 'Approved' && b.paymentStatus === 'Pending');
  const totalPaidAmount = bills.filter(b => b.paymentStatus === 'Paid').reduce((sum, b) => sum + Number(b.amount), 0);

  const sidebarItems = [
    { label: 'Dashboard', icon: '🏠' },
    { label: 'Events', icon: '🎪' },
    { label: 'Bills', icon: '📄' },
    { label: 'Payments', icon: '💰' },
    { label: 'Students', icon: '👥' },
    { label: 'Faculty', icon: '👨‍🏫' },
    { label: 'Reports', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* ─── HEADER ────────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-lg border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black tracking-wider text-indigo-400">BillStack</span>
          <span className="bg-indigo-900/80 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-700">
            Control Center
          </span>
        </div>

        <div className="flex items-center space-x-5">
          <button className="relative text-slate-300 hover:text-white transition">
            <span className="text-xl">🔔</span>
            {pendingPayments.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-xs rounded-full h-4 w-4 flex items-center justify-center font-black">
                {pendingPayments.length}
              </span>
            )}
          </button>

          <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">{userName}</p>
              <p className="text-slate-400">Admin / Storekeeper</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="ml-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ─── BODY ──────────────────────────────────────────────────── */}
      <div className="flex flex-1">
        
        {/* SIDEBAR */}
        <aside className="w-60 bg-white border-r border-slate-200 p-4 hidden md:block">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === item.label
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-x-hidden">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Events</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{events.length}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bills</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{bills.length}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ready for Payment</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{pendingPayments.length}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Disbursed</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">₹{totalPaidAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* ─── TAB: DASHBOARD ────────────────────────────────────── */}
          {activeTab === 'Dashboard' && (
            <div className="space-y-6">
              
              {/* Ready for Processing Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Faculty-Approved Bills Ready for Processing</h2>
                    <p className="text-xs text-slate-500">Verify details and disburse payments directly to students.</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">
                    {pendingPayments.length} Action Required
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Event</th>
                        <th className="py-3 px-4">Bill ID</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Faculty Verification</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingPayments.length > 0 ? (
                        pendingPayments.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{b.student}</td>
                            <td className="py-3 px-4 text-indigo-700 font-medium">{b.event}</td>
                            <td className="py-3 px-4 font-mono font-bold">{b.id}</td>
                            <td className="py-3 px-4 font-extrabold text-slate-900">₹{b.amount}</td>
                            <td className="py-3 px-4">
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                ✓ Verified by Faculty
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setPaymentModalBill(b)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                              >
                                Process Payment
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-400 text-sm">
                            No bills currently pending payment processing.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Events Overview */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-slate-900">Active Campus Events</h2>
                  <button
                    onClick={() => setActiveTab('Events')}
                    className="text-xs text-indigo-600 font-bold hover:underline"
                  >
                    View All Events →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {events.map((ev) => (
                    <div key={ev.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-900 text-base">{ev.name}</h3>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded">
                          {ev.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Dates: {ev.startDate} - {ev.endDate}</p>
                      <div className="pt-2 flex justify-between text-xs border-t border-slate-200">
                        <span>Budget: <strong>{ev.budget}</strong></span>
                        <span>Spent: <strong className="text-emerald-700">{ev.spent}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ─── TAB: EVENTS MANAGEMENT ────────────────────────────── */}
          {activeTab === 'Events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
                  <p className="text-slate-500 text-xs">Create, inspect, and close active institutional events.</p>
                </div>
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1"
                >
                  <span>+</span> <span>Create New Event</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Event Name</th>
                      <th className="py-3 px-4">Dates</th>
                      <th className="py-3 px-4">Allocated Budget</th>
                      <th className="py-3 px-4">Total Bills</th>
                      <th className="py-3 px-4">Total Spent</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{e.name}</td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs">{e.startDate} to {e.endDate}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{e.budget}</td>
                        <td className="py-3.5 px-4 font-semibold text-indigo-600">{e.billsCount}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">{e.spent}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: ALL BILLS MANAGEMENT ─────────────────────────── */}
          {activeTab === 'Bills' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-900">All Submitted Bills</h1>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Search Student..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <select
                    value={billFilterEvent}
                    onChange={(e) => setBillFilterEvent(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="All">All Events</option>
                    {events.map(ev => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
                  </select>
                  <select
                    value={billFilterStatus}
                    onChange={(e) => setBillFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Ready">Ready for Payment</option>
                    <option value="Paid">Paid</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Faculty Review</th>
                      <th className="py-3 px-4">Payment Status</th>
                      <th className="py-3 px-4">Txn Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{b.student}</td>
                        <td className="py-3 px-4 text-indigo-700 font-medium">{b.event}</td>
                        <td className="py-3 px-4 font-bold">₹{b.amount}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            b.facultyStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            b.facultyStatus === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {b.facultyStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            b.paymentStatus === 'Paid' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {b.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{b.txnId || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: PAYMENTS ──────────────────────────────────────── */}
          {activeTab === 'Payments' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-900">Payment & Disbursement Center</h1>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-slate-800">Approved Bills Pending Payment</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Event</th>
                        <th className="py-3 px-4">Bill ID</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingPayments.map((b) => (
                        <tr key={b.id}>
                          <td className="py-3 px-4 font-bold text-slate-900">{b.student}</td>
                          <td className="py-3 px-4 text-indigo-700">{b.event}</td>
                          <td className="py-3 px-4 font-mono font-bold">{b.id}</td>
                          <td className="py-3 px-4 font-extrabold text-emerald-700">₹{b.amount}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setPaymentModalBill(b)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm"
                            >
                              Disburse Payment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB: STUDENTS ──────────────────────────────────────── */}
          {activeTab === 'Students' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-900">Student Directory & Expense Activity</h1>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Total Submissions</th>
                      <th className="py-3 px-4">Approved</th>
                      <th className="py-3 px-4">Pending</th>
                      <th className="py-3 px-4">Total Claimed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr key={s.name} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{s.dept}</td>
                        <td className="py-3.5 px-4 font-bold">{s.bills}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600">{s.approved}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-600">{s.pending}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{s.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: FACULTY ───────────────────────────────────────── */}
          {activeTab === 'Faculty' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-slate-900">Faculty Reviewers</h1>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4">Faculty Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Assigned Event</th>
                      <th className="py-3 px-4">Pending Reviews</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faculty.map((f) => (
                      <tr key={f.name} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{f.name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{f.dept}</td>
                        <td className="py-3.5 px-4 text-indigo-700 font-semibold">{f.eventsAssigned}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-600">{f.pendingReviews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: REPORTS ───────────────────────────────────────── */}
          {activeTab === 'Reports' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-900">Event Financial Reports</h1>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Tech Fest 2026 - Financial Breakdown</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold uppercase">Total Submissions</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">42 Bills</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl">
                    <p className="text-xs text-emerald-700 font-bold uppercase">Approved</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">35 Bills</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl">
                    <p className="text-xs text-red-700 font-bold uppercase">Rejected</p>
                    <p className="text-xl font-bold text-red-800 mt-1">4 Bills</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl">
                    <p className="text-xs text-amber-700 font-bold uppercase">Pending</p>
                    <p className="text-xl font-bold text-amber-800 mt-1">3 Bills</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 flex flex-col md:flex-row justify-between text-sm gap-2">
                  <p>Allocated Budget: <strong className="text-slate-900">₹50,000</strong></p>
                  <p>Disbursed Amount: <strong className="text-emerald-700">₹31,200</strong></p>
                  <p>Pending Disbursement: <strong className="text-amber-700">₹7,300</strong></p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ─── CREATE EVENT MODAL ────────────────────────────────────── */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create New Event</h3>
            
            <form onSubmit={handleCreateEvent} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tech Fest 2026"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Brief description of the event..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Start Date</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">End Date</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Total Budget (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="50000"
                  value={newEvent.budget}
                  onChange={(e) => setNewEvent({ ...newEvent, budget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PROCESS PAYMENT MODAL ─────────────────────────────────── */}
      {paymentModalBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Process Payment Details</h3>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p><strong>Student:</strong> {paymentModalBill.student}</p>
              <p><strong>Event:</strong> {paymentModalBill.event}</p>
              <p><strong>Bill ID:</strong> {paymentModalBill.id}</p>
              <p className="text-sm font-extrabold text-indigo-950 pt-1">
                Amount to Disburse: <span className="text-emerald-700">₹{paymentModalBill.amount}</span>
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="Bank Transfer">Direct Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="Cash / Voucher">Cash Reimbursement Voucher</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Transaction ID / Reference Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TXN-984210"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setPaymentModalBill(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}