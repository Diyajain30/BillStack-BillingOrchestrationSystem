import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard({ user }) {
  const navigate = useNavigate();
  const userName = user.name || user.username || 'Student';
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedFile, setSelectedFile] = useState(null);

  // 🟢 NEW: State for Branch and Event selection
  const [branch, setBranch] = useState('Computer Engineering');
  const [event, setEvent] = useState('TechFest 2026');

  // List of Branches
  const branches = [
    'Computer Engineering',
    'Information Technology',
    'Electronics & Telecommunication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Electrical Engineering'
  ];

  // List of Events
  const events = [
    'TechFest 2026',
    'Annual Hackathon',
    'Cultural Fest (Wave)',
    'Sports Meet 2026',
    'Departmental Workshop',
    'Project Exhibition'
  ];

  const [bills] = useState([
    { id: 'B101', date: '2026-08-28', branch: 'Computer Engineering', event: 'TechFest 2026', amount: '₹500', status: 'Pending' },
    { id: 'B100', date: '2026-08-20', branch: 'Information Technology', event: 'Annual Hackathon', amount: '₹1,200', status: 'Approved' },
    { id: 'B099', date: '2026-08-15', branch: 'Computer Engineering', event: 'Departmental Workshop', amount: '₹350', status: 'Approved' },
    { id: 'B098', date: '2026-08-10', branch: 'Electronics & Telecom', event: 'Cultural Fest (Wave)', amount: '₹800', status: 'Rejected' },
  ]);

  const sidebarItems = ['Dashboard', 'Upload Bill', 'My Bills', 'Payments', 'Profile'];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0].name);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* NAVBAR */}
      <header className="bg-violet-950 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-black tracking-wide text-violet-400">BillStack</span>
        </div>
        <div className="flex items-center space-x-6">
          <button className="relative text-violet-200 hover:text-white transition">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
              2
            </span>
          </button>
          <div className="flex items-center space-x-2 border-l border-violet-800 pl-4">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center font-bold text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="font-semibold text-white leading-none">{userName}</p>
              <p className="text-xs text-violet-300">Student</p>
            </div>
            <button 
              onClick={() => navigate('/')} 
              className="ml-3 text-xs bg-violet-800 hover:bg-violet-700 text-violet-200 px-2 py-1 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1">
        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r border-violet-100 p-4 hidden md:block">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  activeTab === item
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-900'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-violet-950">Welcome, {userName} 👋</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your invoice submissions and track payment statuses.</p>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Uploaded</p>
                <p className="text-3xl font-extrabold text-violet-950 mt-1">12</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-xl font-bold">📁</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
                <p className="text-3xl font-extrabold text-amber-600 mt-1">3</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl font-bold">⏳</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">8</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold">✅</div>
            </div>
          </div>

          {/* Upload New Bill Section */}
          <div className="bg-white p-6 rounded-2xl border border-violet-100 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-violet-950 flex items-center gap-2">
              <span>📤</span> Upload New Bill
            </h2>

            {/* 🟢 NEW: Branch & Event Selection Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-violet-50/60 p-4 rounded-xl border border-violet-100">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-violet-900 mb-1.5">
                  Select Branch
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-violet-900 mb-1.5">
                  Select Event / Activity
                </label>
                <select
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600"
                >
                  {events.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div className="border-2 border-dashed border-violet-200 hover:border-violet-500 bg-violet-50/30 rounded-xl p-8 text-center transition flex flex-col items-center justify-center">
              <span className="text-4xl mb-2">📄</span>
              <p className="text-sm font-semibold text-violet-950">
                {selectedFile ? `Selected: ${selectedFile}` : 'Drag & Drop your bill here or browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Selected: <span className="font-semibold text-violet-800">{branch}</span> • <span className="font-semibold text-violet-800">{event}</span>
              </p>
              <label className="cursor-pointer bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition">
                Upload Bill
                <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
              </label>
            </div>
          </div>

          {/* Recent Bills Table */}
          <div className="bg-white p-6 rounded-2xl border border-violet-100 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-violet-950">Recent Bills</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-violet-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Bill ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50 text-sm">
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-violet-50/50 transition">
                      <td className="py-3 px-4 font-bold text-violet-950">{bill.id}</td>
                      <td className="py-3 px-4 text-slate-600">{bill.date}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{bill.branch}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{bill.event}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{bill.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${
                          bill.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          bill.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="text-violet-600 hover:text-violet-900 font-bold transition">👁</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}