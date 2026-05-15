import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Link, Outlet } from "react-router-dom";
import { 
  CheckCircle, 
  Circle, 
  LayoutDashboard, 
  LogOut, 
  FileText, 
  ShieldCheck,
  Upload,
  ChevronDown,
  Printer,
  XCircle,
  AlertTriangle,
  UserPlus
} from "lucide-react";
import { jsPDF } from "jspdf";

// --- 1. MOCK DATA ---
const INITIAL_EVENTS = [
  { id: 1, name: "CodeQuest 2024", category: "Technical", amount: 15000, status: "Pending", wing: "Computer Science" },
  { id: 2, name: "Cultural Night", category: "Cultural", amount: 25000, status: "Faculty Approved", wing: "Arts" },
  { id: 3, name: "Robotix Expo", category: "Technical", amount: 12000, status: "Storekeeper Verified", wing: "Robotics" },
];

const WINGS = ["Computer Science", "Robotics", "Arts"];

// --- 2. AUTH CONTEXT & PROVIDER ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (username, password, role) => {
    // In this mock version, we accept any username/password
    let assignedRole = role; 
    if (!role) {
      if (username.toLowerCase() === "admin") assignedRole = "Principal";
      else if (username.toLowerCase() === "faculty") assignedRole = "Faculty";
      else if (username.toLowerCase() === "store") assignedRole = "Storekeeper";
      else assignedRole = "Event Head";
    }
    
    setUser({ 
      id: "user_" + Date.now(), 
      name: username.toUpperCase(), 
      role: assignedRole 
    });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- 3. HELPERS ---
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
};

const generateVoucher = (event, user) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("OFFICIAL FINANCIAL VOUCHER", 20, 30);
  doc.setFontSize(12);
  doc.text(`Event: ${event.name}`, 20, 50);
  doc.text(`Amount: INR ${event.amount}`, 20, 60);
  doc.text(`Final Approval by: ${user.name} (${user.role})`, 20, 70);
  doc.save(`${event.name}_bill.pdf`);
};

// --- 4. COMPONENTS ---

const Sidebar = ({ events }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expandedWing, setExpandedWing] = useState(null);

  return (
    <div className="w-72 h-screen bg-slate-900 text-white p-6 flex flex-col fixed left-0 top-0 overflow-y-auto">
      <div className="flex items-center gap-3 mb-10">
        <ShieldCheck className="text-blue-400" size={28} />
        <span className="font-bold text-2xl tracking-tight">BillStack</span>
      </div>

      <nav className="flex-1 space-y-2">
        <Link to="/dashboard" className="flex items-center gap-3 text-slate-400 hover:text-white p-2 rounded-lg transition-colors">
          <LayoutDashboard size={20} /> Dashboard Home
        </Link>
        
        <div className="pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Wings</p>
          {WINGS.map(wing => (
            <div key={wing} className="mb-2">
              <button 
                onClick={() => setExpandedWing(expandedWing === wing ? null : wing)}
                className="w-full flex items-center justify-between p-2 hover:bg-slate-800 rounded-lg text-sm font-medium transition-all"
              >
                <span>{wing}</span>
                <ChevronDown size={14} className={expandedWing === wing ? "rotate-180" : ""} />
              </button>
              {expandedWing === wing && (
                <div className="ml-4 mt-1 border-l border-slate-700 pl-2 space-y-1">
                  {events.filter(e => e.wing === wing).map(e => (
                    <Link key={e.id} to={`/dashboard/event/${e.id}`} className="block p-2 text-xs text-slate-400 hover:text-blue-400 truncate">
                      • {e.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800 pt-6 mt-auto">
        <div className="mb-4 px-2">
          <p className="text-[10px] text-slate-500 uppercase">User Role</p>
          <p className="text-sm font-bold text-blue-400">{user?.role}</p>
        </div>
        <button onClick={() => { logout(); navigate("/login"); }} className="flex items-center gap-2 text-red-400 hover:bg-red-900/20 w-full p-2 rounded-lg transition">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
};

const EventDetails = ({ events, setEvents }) => {
  const { user } = useAuth();
  const { id } = useParams();
  const [selectedFile, setSelectedFile] = useState(null);
  const event = events.find(e => e.id === parseInt(id));

  if (!event) return <div className="ml-72 p-10 font-medium text-slate-400 text-center mt-20">Select an event from the sidebar.</div>;

  const updateStatus = (newStatus) => {
    setEvents(events.map(e => e.id === event.id ? { ...e, status: newStatus } : e));
  };

  return (
    <div className="ml-72 p-10 max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">{event.name}</h1>
          <p className="text-slate-500 font-medium">{event.wing} Wing — {event.category}</p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${
          event.status.includes('Returned') ? 'border-red-200 bg-red-50 text-red-600' : 
          event.status.includes('Approved') || event.status.includes('Verified') ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          {event.status}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border-2 border-slate-100 shadow-sm min-h-[400px] flex flex-col items-center justify-center">
            {selectedFile ? (
              <div className="text-center">
                <FileText size={64} className="text-blue-500 mx-auto mb-4" />
                <p className="font-bold text-slate-700">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">File uploaded and ready for review</p>
              </div>
            ) : (
              <div className="text-center text-slate-300">
                <AlertTriangle size={64} className="mx-auto mb-4 opacity-20" />
                <p>No document available for preview</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-tighter mb-4">Actions</h3>
            
            {user.role === "Event Head" && (
              <div className="space-y-3">
                <label className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow-lg">
                  <Upload size={18} /> Upload Bill Image
                  <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files[0])} />
                </label>
              </div>
            )}

            {user.role === "Faculty" && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => updateStatus("Faculty Approved")} className="bg-green-600 hover:bg-green-700 p-3 rounded-xl font-bold transition">Approve</button>
                <button onClick={() => updateStatus("Returned by Faculty")} className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition">
                  <XCircle size={18} /> Reject / Return
                </button>
              </div>
            )}

            {user.role === "Storekeeper" && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => updateStatus("Storekeeper Verified")} className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-xl font-bold transition">Verify Items</button>
                <button onClick={() => updateStatus("Returned by Store")} className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition">
                  <XCircle size={18} /> Flag Issue
                </button>
              </div>
            )}

            {user.role === "Principal" && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => generateVoucher(event, user)} className="bg-white text-slate-900 p-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-100 transition">
                  <Printer size={18} /> Final Sign & Print
                </button>
                <button onClick={() => updateStatus("Returned by Principal")} className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition">
                  <XCircle size={18} /> Deny Approval
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-2 text-sm uppercase">Amount Requested</h3>
            <div className="text-3xl font-black text-blue-600">₹{event.amount.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "", role: "Event Head" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.username && formData.password) {
      login(formData.username, formData.password, isSignUp ? formData.role : null);
      navigate("/dashboard");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-96 border border-slate-200">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-blue-600 rounded-xl">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h2 className="text-3xl font-black text-slate-900">
            {isSignUp ? "Join Us" : "Welcome"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Username</label>
            <input required className="w-full p-4 border rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 transition" 
              placeholder="Enter username" value={formData.username} 
              onChange={e => setFormData({...formData, username: e.target.value})} 
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Password</label>
            <input required type="password" className="w-full p-4 border rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 transition" 
              placeholder="••••••••" value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          {isSignUp && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Account Type</label>
              <select className="w-full p-4 border rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none"
                value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="Event Head">Event Head</option>
                <option value="Faculty">Faculty</option>
                <option value="Storekeeper">Storekeeper</option>
                <option value="Principal">Principal</option>
              </select>
            </div>
          )}

          <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">
            {isSignUp ? <UserPlus size={18} /> : null}
            {isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 w-full text-center text-sm font-medium text-blue-600 hover:underline">
          {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};

const Layout = ({ events }) => (
  <div className="bg-slate-50 min-h-screen">
    <Sidebar events={events} />
    <Outlet />
  </div>
);

// --- 5. MAIN APP ---
export default function App() {
  const [events, setEvents] = useState(INITIAL_EVENTS);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout events={events} /></ProtectedRoute>}>
            <Route index element={<div className="ml-72 p-10 text-slate-400 font-medium">Click an event in the sidebar to review its details.</div>} />
            <Route path="event/:id" element={<EventDetails events={events} setEvents={setEvents} />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}