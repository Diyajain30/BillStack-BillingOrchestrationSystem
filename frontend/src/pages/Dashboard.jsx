import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StudentDashboard from '../components/StudentDashboard';
import FacultyDashboard from '../components/FacultyDashboard';
import AdminDashboard from '../components/AdminDashboard';
import StudentHeadDashboard from '../components/StudentHeadDashboard';
import MainEventHeadDashboard from '../components/MainEventHeadDashboard';
import PrincipalDashboard from '../components/PrincipalDashboard';
import StorekeeperDashboard from '../components/StorekeeperDashboard';
import AccountsDashboard from '../components/AccountsDashboard';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = location.state?.user || getStoredUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-sage-50 flex items-center justify-center p-6 font-sans text-stone-800">
        <div className="bg-white border border-sage-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sage-600" />
            <span className="text-sm font-semibold text-sage-800">BillStack</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-stone-900">
              Session Expired or Not Found
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Please sign in again to access your portal.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-sage-600 hover:bg-sage-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  const role = (user.role || '').toUpperCase();

  switch (role) {
    case 'ADMIN':
      return <AdminDashboard user={user} />;
    case 'MAIN_EVENT_HEAD':
      return <MainEventHeadDashboard currentUser={user} user={user} />;
    case 'STUDENT_HEAD':
      return <StudentHeadDashboard user={user} />;
    case 'STUDENT_COORDINATOR':
    case 'STUDENT':
    case 'EVENT_HEAD':
      return <StudentDashboard user={user} />;
    case 'FACULTY':
    case 'TEACHER':
      return <FacultyDashboard user={user} />;
    case 'PRINCIPAL':
      return <PrincipalDashboard user={user} />;
    case 'STOREKEEPER':
    case 'STORE':
      return <StorekeeperDashboard user={user} />;
    case 'ACCOUNTS':
      return <AccountsDashboard user={user} />;
    default:
      return (
        <div className="min-h-screen bg-sage-50 flex items-center justify-center p-6 font-sans text-stone-800">
          <div className="bg-white border border-sage-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 max-w-md w-full text-center space-y-4">
            <h2 className="text-base font-semibold text-rose-700">
              Unrecognized System Role: {user.role}
            </h2>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      );
  }
}