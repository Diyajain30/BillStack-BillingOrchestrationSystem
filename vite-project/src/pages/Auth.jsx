import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    enrollmentId: '',
    role: 'Student',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      // Pass user info along with the selected role
      const userPayload = isLogin
        ? { username: formData.username, role: formData.role }
        : { name: formData.name, enrollmentId: formData.enrollmentId, role: formData.role };

      navigate('/dashboard', { state: { user: userPayload } });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-violet-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-violet-950">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-violet-600 text-sm mt-1">
            {isLogin
              ? 'Enter your credentials to log in'
              : 'Fill in your details to create a new account'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Sign Up Fields */}
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-semibold text-violet-900 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-violet-900 mb-1">
                  Enrollment ID
                </label>
                <input
                  type="text"
                  name="enrollmentId"
                  placeholder="ENR-10293"
                  value={formData.enrollmentId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-900"
                />
              </div>
            </>
          )}

          {/* Login Field */}
          {isLogin && (
            <div>
              <label className="block text-sm font-semibold text-violet-900 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-900"
              />
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-violet-900 mb-1">
              Select Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-900 bg-white"
            >
              <option value="Student">Student</option>
              <option value="Teacher">Teacher / Faculty</option>
              <option value="Admin">Admin / Principal</option>
              <option value="Storekeeper">Storekeeper</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-violet-900 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 text-slate-900"
            />
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-md mt-2 flex justify-center items-center"
          >
            {loading ? 'Processing...' : isLogin ? 'Log In' : 'Create Account'}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="ml-2 font-semibold text-violet-700 hover:underline focus:outline-none"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}