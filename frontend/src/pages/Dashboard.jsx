import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StudentDashboard from '../components/StudentDashboard';
import FacultyDashboard from '../components/FacultyDashboard';
import AdminDashboard from '../components/AdminDashboard';
import StudentHeadDashboard from '../components/StudentHeadDashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve user session from state or localStorage
  const user = location.state?.user || JSON.parse(localStorage.getItem('user')) || null;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">No Active Session Found</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-violet-600 px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-violet-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const role = (user.role || '').toUpperCase();

  switch (role) {
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
    case 'ADMIN':
    case 'STOREKEEPER':
    case 'STORE':
    case 'ACCOUNTS':
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