import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Auth() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    institutionalId: '',
    department: 'Computer Engineering',
    role: 'STUDENT_COORDINATOR',
  });

  const roles = [
    { value: 'STUDENT_COORDINATOR', label: 'Student Coordinator' },
    { value: 'STUDENT_HEAD', label: 'Student Head (Wings Fest)' },
    { value: 'FACULTY', label: 'Faculty Head' },
    { value: 'PRINCIPAL', label: 'Principal' },
    { value: 'STOREKEEPER', label: 'Storekeeper' },
    { value: 'ACCOUNTS', label: 'Accounts Section' },
  ];

  const departments = [
    'Computer Engineering',
    'Information Technology',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Electronics & Telecommunication',
  ];

  const isStudentRole = formData.role === 'STUDENT_COORDINATOR' || formData.role === 'STUDENT_HEAD';
  const showDepartmentField = !isLogin && (formData.role === 'STUDENT_COORDINATOR' || formData.role === 'FACULTY');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (!isLogin) {
        // --- REGISTRATION ---
        const userPayload = {
          name: formData.name,
          username: formData.username,
          institutionalId: formData.institutionalId,
          password: formData.password,
          role: formData.role,
          department: showDepartmentField ? formData.department : null,
        };

        const response = await axios.post('http://localhost:8080/api/users', userPayload);

        if (response.status === 201 || response.status === 200) {
          alert('Account created successfully! Please log in with your credentials and selected role.');
          setIsLogin(true);
          setFormData((prev) => ({
            ...prev,
            password: '',
            confirmPassword: '',
          }));
        }
      } else {
        // --- ROLE-CONFIRMED LOGIN ---
        const response = await axios.post('http://localhost:8080/api/users/login', {
          username: formData.username,
          password: formData.password,
          role: formData.role,
        });

        if (response.status === 200) {
          const { token, user } = response.data;
          // Store token and user metadata uniformly across browser sessions
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          navigate('/dashboard', { state: { user } });
        }
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setError(
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        'Authentication failed. Please verify your credentials and network connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-violet-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-block p-3 rounded-xl bg-violet-100 text-violet-700 font-black text-2xl mb-2">
            BillStack
          </div>
          <h2 className="text-2xl font-bold text-violet-950">
            {isLogin ? 'Sign In to Your Portal' : 'Create Account'}
          </h2>
          <p className="text-violet-600 text-xs mt-1">
            {isLogin
              ? 'Provide your credentials and confirm your operational role'
              : 'Register your institutional profile to access BillStack workflows'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Sign Up Specific Fields */}
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-violet-900 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g., Aryan Sharma"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-violet-900 mb-1">
                  {isStudentRole ? 'Roll Number / Enrollment ID' : 'Employee / Staff ID'}
                </label>
                <input
                  type="text"
                  name="institutionalId"
                  placeholder={isStudentRole ? 'e.g., BT2026CS042' : 'e.g., EMP-FAC-101'}
                  value={formData.institutionalId}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-600 outline-none"
                />
              </div>

              {showDepartmentField && (
                <div>
                  <label className="block text-xs font-bold text-violet-900 mb-1">Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-violet-600 outline-none"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Role Confirmation Selector (Present in both Login and Registration) */}
          <div>
            <label className="block text-xs font-bold text-violet-900 mb-1">
              {isLogin ? 'Confirm Your Role' : 'Assign System Role'}
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-violet-600 outline-none"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-violet-900 mb-1">Username</label>
            <input
              type="text"
              name="username"
              placeholder="e.g., aryan_coord"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-600 outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-violet-900 mb-1">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-600 outline-none"
            />
          </div>

          {/* Confirm Password (Registration Only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-violet-900 mb-1">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2 border border-violet-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-violet-600 outline-none"
              />
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-md mt-2 flex justify-center items-center"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center mt-5">
          <p className="text-xs text-gray-600">
            {isLogin ? "Don't have an account?" : 'Already registered?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="ml-1.5 font-bold text-violet-700 hover:underline outline-none"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}