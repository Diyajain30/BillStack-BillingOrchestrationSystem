import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';

const USER_ROLES = [
  { value: 'STUDENT_COORDINATOR', label: 'Student Coordinator' },
  { value: 'STUDENT_HEAD', label: 'Student Head' },
  { value: 'MAIN_EVENT_HEAD', label: 'Main Event Head' },
  { value: 'FACULTY', label: 'Faculty Head' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'STOREKEEPER', label: 'Storekeeper' },
  { value: 'ACCOUNTS', label: 'Accounts Section' },
];

export default function Auth() {
  const navigate = useNavigate();

  const [loginMode, setLoginMode] = useState('user'); // 'user' | 'admin'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'STUDENT_COORDINATOR',
  });

  const handleModeSwitch = (mode) => {
    setLoginMode(mode);
    setError('');
    setFormData((prev) => ({
      ...prev,
      username: '',
      password: '',
    }));
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim()) {
      setError('Please enter your username.');
      return;
    }

    if (formData.password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: formData.username.trim(),
        password: formData.password,
        role: loginMode === 'admin' ? 'ADMIN' : formData.role,
      };

      const response = await backendApi.post('/users/login', payload);

      if (response.status === 200 && response.data?.user) {
        const { token, user } = response.data;
        if (token) localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/dashboard', { state: { user } });
      } else {
        setError('Unexpected response from server. Please try again.');
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setError(
        err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : null) ||
          'Authentication failed. Please check your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col items-center justify-center px-4 py-10 font-sans text-stone-800">
      <div className="w-full max-w-md bg-white border border-sage-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sage-600" />
            <span className="text-sm font-semibold tracking-tight text-sage-800">
              BillStack
            </span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
            {loginMode === 'admin' ? 'Admin Sign In' : 'Sign In'}
          </h1>
        </div>

        <div className="grid grid-cols-2 p-1 bg-sage-50 border border-sage-200/80 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => handleModeSwitch('user')}
            className={`py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              loginMode === 'user'
                ? 'bg-white text-sage-900 shadow-xs border border-sage-200/60'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            User Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('admin')}
            className={`py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              loginMode === 'admin'
                ? 'bg-white text-sage-900 shadow-xs border border-sage-200/60'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Admin Sign In
          </button>
        </div>

        {error && (
          <div className="mb-5 px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMode === 'user' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={inputClass}
              >
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder={
                loginMode === 'admin'
                  ? 'Enter admin username'
                  : 'Enter your username'
              }
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white font-medium py-2.5 rounded-lg text-sm transition mt-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-[11px] text-stone-400 mt-6 pt-4 border-t border-sage-100 text-center">
          User accounts are provisioned by the system administrator.
        </p>
      </div>
    </div>
  );
}