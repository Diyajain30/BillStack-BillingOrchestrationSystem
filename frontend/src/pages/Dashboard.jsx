import { useLocation, useNavigate } from 'react-router-dom';
import StudentDashboard from '../components/StudentDashboard';
import FacultyDashboard from '../components/FacultyDashboard';
import AdminDashboard from '../components/AdminDashboard';



export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Retrieve user from navigation state OR fallback to localStorage
  const user = location.state?.user || JSON.parse(localStorage.getItem('user'));

  // 2. Redirect if no user data exists
  if (!user || !user.role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <h2 className="text-xl font-bold text-red-600">No User Session Found</h2>
        <button 
          onClick={() => navigate('/')} 
          className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold"
        >
          Back to Login
        </button>
      </div>
    );
  }

  // 3. Convert role to uppercase to eliminate case-sensitivity issues
  const role = user.role.toUpperCase();

  // 4. Render component based on normalized role
  switch (role) {
    case 'STUDENT':
    case 'EVENT_HEAD':
      return <StudentDashboard user={user} />;

    case 'TEACHER':
    case 'FACULTY':
      return <FacultyDashboard user={user} />;

    case 'ADMIN':
    case 'PRINCIPAL':
    case 'STOREKEEPER':
    case 'STORE':
      return <AdminDashboard user={user} />;

    default:
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
          <h2 className="text-xl font-bold text-red-600">Unknown Role: {user.role}</h2>
          <button 
            onClick={() => navigate('/')} 
            className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold"
          >
            Back to Login
          </button>
        </div>
      );
  }
}