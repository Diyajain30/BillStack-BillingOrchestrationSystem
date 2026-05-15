import { jsPDF } from "jspdf";
import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import { 
  CheckCircle, 
  Circle, 
  LayoutDashboard, 
  ChevronRight, 
  LogOut,
  FileText,
  AlertCircle,
  UserPlus,
  ShieldCheck
} from "lucide-react";


const generateVoucher = (event, user) => {
  const doc = new jsPDF();

  // PAGE 1: ODD PAGE (The Form)
  doc.setFontSize(22);
  doc.text("BILLSTACK FINANCIAL VOUCHER", 20, 30);
  
  doc.setFontSize(12);
  doc.text(`Event Name: ${event.name}`, 20, 50);
  doc.text(`Category: ${event.category}`, 20, 60);
  doc.text(`Approved Amount: INR ${event.amount}`, 20, 70);
  doc.text(`Approved By: ${user.name} (${user.role})`, 20, 80);
  doc.text(`Timestamp: ${new Date().toLocaleString()}`, 20, 90);

  // Signatures
  doc.line(20, 120, 80, 120); doc.text("Faculty Sign", 20, 125);
  doc.line(120, 120, 180, 120); doc.text("Principal Sign", 120, 125);

  // PAGE 2: EVEN PAGE (The Receipt)
  doc.addPage();
  doc.text("ATTACHED RECEIPT PROOF", 20, 20);
  // In a real app, you'd use doc.addImage() here with the uploaded base64 image
  doc.rect(20, 40, 170, 100); 
  doc.text("[ IMAGE PLACEHOLDER ]", 80, 90);

  doc.save(`${event.name}_Voucher.pdf`);
};

// --- 1. AUTHENTICATION CONTEXT ---
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- 2. PROTECTED ROUTE GUARD ---
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

// --- 3. MOCK DATA ---
const MOCK_WINGS = [
  {
    id: 1,
    name: "Technical Wing",
    subEvents: [
      { id: 101, name: "Coding Competition", status: "Faculty", amount: 4500, category: "Software Licenses" },
      { id: 102, name: "Robo-Wars", status: "Storekeeper", amount: 12000, category: "Hardware" }
    ]
  },
  {
    id: 2,
    name: "Cultural Wing",
    subEvents: [
      { id: 201, name: "Drama Night", status: "Principal", amount: 3200, category: "Costumes" }
    ]
  }
];

// --- 4. COMPONENTS ---

function ApprovalTimeline({ currentStatus }) {
  const stages = ["Event Head", "Faculty", "Storekeeper", "Principal"];
  const currentIdx = stages.indexOf(currentStatus);

  return (
    <div className="flex items-center justify-between w-full mb-10 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      {stages.map((stage, index) => (
        <div key={stage} className="flex flex-col items-center flex-1 relative">
          {index !== 0 && (
            <div className={`absolute right-1/2 w-full h-0.5 top-5 -z-0 ${index <= currentIdx ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
          <div className="bg-white z-10 p-1">
            {index < currentIdx ? (
              <CheckCircle className="w-8 h-8 text-green-500 fill-green-50" />
            ) : index === currentIdx ? (
              <Circle className="w-8 h-8 text-blue-600 fill-blue-50 animate-pulse" />
            ) : (
              <Circle className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <span className={`mt-2 text-xs font-bold ${index === currentIdx ? 'text-blue-600' : 'text-slate-500'}`}>
            {stage}
          </span>
        </div>
      ))}
    </div>
  );
}

function Sidebar({ onSelectEvent, activeId }) {
  const { user, logout } = useAuth();
  return (
    <aside className="w-72 bg-slate-900 text-slate-300 h-screen p-6 flex flex-col shadow-2xl">
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-blue-600 p-2 rounded-lg">
          <LayoutDashboard className="text-white w-6 h-6" />
        </div>
        <h1 className="text-white font-black text-2xl tracking-tighter">BILLSTACK</h1>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4 px-2">
            Audit Ledger (SQL)
          </h3>
          <ul className="space-y-1">
            {/* Map through the LIVE events passed from Dashboard */}
            {events && events.length > 0 ? (
              events.map(event => (
                <li 
                  key={event.id} 
                  onClick={() => onSelectEvent(event)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    activeId === event.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{event.name}</span>
                    <span className="text-[9px] opacity-70 uppercase tracking-tighter">
                       ₹{event.amount} • {event.status}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${activeId === event.id ? 'opacity-100' : 'opacity-0'}`} />
                </li>
              ))
            ) : (
              <p className="px-2 text-xs text-slate-600 italic">No bills found in database...</p>
            )}
          </ul>
        </div>
      </nav>

      <div className="pt-6 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase border-2 border-slate-700">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="text-sm">
            <p className="text-white font-bold truncate w-32 uppercase tracking-wide">{user?.name}</p>
            <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="flex items-center gap-2 w-full p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-sm font-bold"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </aside>
  );
}

// --- 5. AUTH PAGES ---

function SignUpPage() {
  const [formData, setFormData] = useState({ 
    username: "", 
    password: "", 
    role: "EVENT_HEAD" 
  });
  const navigate = useNavigate();

  const handleSignUp = (e) => {
    e.preventDefault();
    
    // --- STAGE 1: VALIDATION ---
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters!");
      return;
    }

    // --- STAGE 2: STORAGE (Simulated) ---
    // In a real app, you would do: 
    // axios.post('http://localhost:8080/api/register', formData)
    console.log("Account Created:", formData);
    
    // --- STAGE 3: FEEDBACK & REDIRECT ---
    alert(`Registration Successful! Welcome ${formData.username}. Redirecting to login...`);
    navigate("/login");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-center text-white">
          <UserPlus className="w-10 h-10 mx-auto mb-2 text-blue-500" />
          <h2 className="text-2xl font-black italic uppercase tracking-wider">Join BillStack</h2>
        </div>

        <form onSubmit={handleSignUp} className="p-8 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Username</label>
            <input 
              className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500" 
              required
              placeholder="Pick a unique username"
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Assign Role</label>
            <select 
              className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none bg-white font-bold text-slate-700"
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="PRINCIPAL">PRINCIPAL</option>
              <option value="FACULTY">FACULTY COORDINATOR</option>
              <option value="STOREKEEPER">STOREKEEPER</option>
              <option value="EVENT_HEAD">EVENT HEAD</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Create Password</label>
            <input 
              type="password" 
              className="w-full border-2 border-slate-100 p-3 rounded-xl outline-none focus:border-blue-500" 
              required
              placeholder="••••••••"
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-black mt-4 hover:bg-blue-700 transition-all shadow-lg">
            CREATE ACCOUNT
          </button>
          
          <p className="text-center text-sm text-slate-500 mt-4">
            Already registered? <Link to="/login" className="text-blue-600 font-bold">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function LoginPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      alert("Please enter both username and password");
      return;
    }

    // Role simulation logic
    const userLower = credentials.username.toLowerCase();
    let role = "EVENT_HEAD";
    if (userLower.includes("admin")) role = "ADMIN";
    else if (userLower.includes("principal")) role = "PRINCIPAL";
    else if (userLower.includes("faculty")) role = "FACULTY";

    // In the future, this is where you'll call Student A's API:
    // axios.post('/api/login', credentials)...
    
    login({ name: credentials.username, role });
    navigate("/");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden">
        <div className="bg-blue-600 p-10 text-center text-white">
          <ShieldCheck className="w-12 h-12 mx-auto mb-2" />
          <h2 className="text-3xl font-black italic">BILLSTACK</h2>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-2">Secure Portal Access</p>
        </div>

        <form onSubmit={handleLogin} className="p-10 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Username</label>
            <input 
              type="text"
              autoFocus
              className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-blue-500 outline-none transition-all" 
              placeholder="e.g. Principal_Vikas"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Password</label>
            <input 
              type="password"
              className="w-full border-2 border-slate-100 p-4 rounded-2xl focus:border-blue-500 outline-none transition-all" 
              placeholder="••••••••"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})} 
            />
          </div>

          <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all mt-4">
            LOGIN TO DASHBOARD
          </button>

          <div className="text-center mt-6">
            <p className="text-sm text-slate-500">
              New user? <Link to="/signup" className="text-blue-600 font-bold hover:underline">Create an account</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
// --- 6. DASHBOARD ---
function Dashboard() {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const fileInputRef = React.useRef(null);
  // Calculate if the current bill exceeds the remaining budget
// Change your line to this:
const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const fetchLiveBills = async () => {
      try {
        // Points to Student A's GET /api/bills endpoint
        const response = await fetch("http://localhost:8080/api/bills");
        const data = await response.json();
        setBills(data);
        setLoading(false);
      } catch (error) {
        console.error("Connection to Java Backend failed:", error);
        setLoading(false);
      }
    };

    fetchLiveBills();
  }, []); // The empty array [] means "run this once when the dashboard opens"

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      
      // Generate a preview so the user sees their bill on screen
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result); // This is the Base64 string of the image
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
const isOverBudget = selectedEvent?.amount > 10000;
const handleFinalSubmit = async () => {
  // 1. Gather data from your inputs
  const amountInput = document.querySelector('input[placeholder="Amount (₹)"]');
  const descInput = document.querySelector('input[placeholder="Bill Description"]');

  const newBill = {
    name: descInput.value,
    amount: parseFloat(amountInput.value),
    status: "PENDING_FACULTY", // Starting state as per Student A's pipeline
    // description: descInput.value (Add if Student A's model requires it)
  };

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBill),
    });

    if (response.ok) {
      alert("Success! Bill recorded in SQL and sent to Faculty.");
      // Clear inputs
      amountInput.value = "";
      descInput.value = "";
    }
  } catch (error) {
    console.error("Backend Error:", error);
  }
};



  return (
    
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar 
  onSelectEvent={setSelectedEvent} 
  activeId={selectedEvent?.id} 
  events={bills} // This links your Dashboard state to the Sidebar UI
/>
      
      <main className="flex-1 overflow-y-auto p-12">
        {selectedEvent ? (
          <div className="max-w-5xl mx-auto">
            {isOverBudget && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 animate-bounce">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="text-sm font-bold">
                CRITICAL WARNING: This expense exceeds the allocated "Running Total" for this Wing.
              </p>
            </div>
          )}
            <header className="mb-8">
              <h2 className="text-4xl font-black uppercase italic">{selectedEvent.name}</h2>
              <p className="text-blue-600 font-bold">Logged in as: {user.role}</p>
            </header>

            <ApprovalTimeline currentStatus={selectedEvent.status} />

            <div className="grid grid-cols-1 gap-8">
              
              {/* --- ROLE: EVENT HEAD (Upload & Tracker) --- */}
             {user.role === "EVENT_HEAD" && (
             <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-xl">
               <input 
                type="file" 
                 ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg" 
               onChange={handleFileChange} 
                  />
    
    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
      <FileText className="text-blue-600" /> Submit New Expense
    </h3>

    <div className="grid grid-cols-2 gap-4 mb-6">
      <input type="number" placeholder="Amount (₹)" className="p-4 border rounded-xl outline-none focus:ring-2 ring-blue-500" />
      <input type="text" placeholder="Bill Description" className="p-4 border rounded-xl outline-none focus:ring-2 ring-blue-500" />
    </div>

    {/* UPDATED BOX: Now has onClick and Image Preview logic */}
    <div 
      onClick={handleUploadClick}
      className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden text-center hover:bg-slate-50 cursor-pointer transition-colors min-h-[200px] flex items-center justify-center"
    >
      {previewUrl ? (
        <div className="relative w-full h-full">
          <img src={previewUrl} alt="Bill Preview" className="w-full h-48 object-contain p-2" />
          <div className="bg-blue-600 text-white text-[10px] absolute bottom-2 right-2 px-2 py-1 rounded">IMAGE LOADED</div>
        </div>
      ) : (
        <div className="p-10 flex flex-col items-center gap-2">
           <FileText className="text-slate-300 w-10 h-10" />
           <p className="text-slate-400 font-medium">Click to upload receipt image (PNG/JPG)</p>
        </div>
      )}
    </div>

    <button className="w-full mt-6 bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-200">
      SEND FOR FACULTY APPROVAL
    </button>
  </div>
)}

              {/* --- ROLE: FACULTY / STOREKEEPER (Verification) --- */}
              {(user.role === "FACULTY" || user.role === "STOREKEEPER") && (
                <div className="bg-white p-8 rounded-3xl border-2 border-yellow-100 shadow-xl">
                  <h3 className="text-xl font-bold mb-4 text-yellow-700">Verification Desk</h3>
                  <p className="mb-6 text-slate-500">Please verify the physical bill metadata against the digital scan.</p>
                  <div className="flex gap-6 items-start">
                    <div className="w-1/2 aspect-video bg-slate-100 rounded-xl border flex items-center justify-center italic text-slate-400">Bill Scan Image</div>
                    <div className="w-1/2 space-y-4">
                       <div className="p-4 bg-slate-50 rounded-lg"><strong>Amount:</strong> ₹{selectedEvent.amount}</div>
                       <div className="p-4 bg-slate-50 rounded-lg"><strong>Vendor:</strong> External Supplier Ltd.</div>
                       <div className="flex gap-2">
                          <button className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold">REJECT</button>
                          <button className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold">VERIFY</button>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- ROLE: PRINCIPAL / ADMIN (Final Authority) --- */}
              {(user.role === "PRINCIPAL" || user.role === "ADMIN") && (
                <div className="bg-white p-8 rounded-3xl border-2 border-green-100 shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-green-800">Final Budget Approval</h3>
                    <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-black">HIGH PRIORITY</span>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl mb-6">
                     <p className="text-sm text-slate-500 uppercase font-bold mb-1">Total Impact on Budget</p>
                     <p className="text-3xl font-black text-red-600">- ₹{selectedEvent.amount}</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200">SEND BACK</button>
                    <button 
                          onClick={() => generateVoucher(selectedEvent, user)}
                         className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black shadow-xl"
                         >
                           APPROVE & PRINT VOUCHER
                    </button>
                  </div>
                </div>
                
              )}

            </div>
          </div>
          
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <ShieldCheck size={100} strokeWidth={1} />
            <h2 className="text-2xl font-bold mt-4">Welcome, {user.name}</h2>
            <p>Access Level: <span className="text-blue-500">{user.role}</span></p>
            <p className="mt-2 text-sm">Please select a wing folder to start auditing.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 7. MAIN APP ROUTER ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}