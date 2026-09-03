import { useLocation, useNavigate } from 'react-router-dom';
import StudentDashboard from '../components/StudentDashboard';
import FacultyDashboard from '../components/FacultyDashboard';
import AdminDashboard from '../components/AdminDashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = location.state?.user || { name: 'User', role: 'Student' };

  // Render Student Dashboard
  if (user.role === 'Student') {
    return <StudentDashboard user={user} />;
  }

  // Render Faculty Dashboard
  if (user.role === 'Teacher' || user.role === 'Faculty') {
    return <FacultyDashboard user={user} />;
  }

  // Render Admin / Storekeeper Dashboard
  if (user.role === 'Admin' || user.role === 'Storekeeper') {
    return <AdminDashboard user={user} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Unknown Role</h1>
        <button onClick={() => navigate('/')} className="bg-indigo-600 px-4 py-2 rounded-lg text-sm font-bold">
          Back to Login
        </button>
      </div>
    </div>
  );
}