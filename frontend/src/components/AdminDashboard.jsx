import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../services/api';

const ALL_ROLES = [
  { value: 'STUDENT_COORDINATOR', label: 'Student Coordinator' },
  { value: 'STUDENT_HEAD', label: 'Student Head' },
  { value: 'FACULTY', label: 'Faculty Head' },
  { value: 'MAIN_EVENT_HEAD', label: 'Main Event Head' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'STOREKEEPER', label: 'Storekeeper' },
  { value: 'ACCOUNTS', label: 'Accounts Section' },
  { value: 'ADMIN', label: 'Admin' },
];

const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Electronics & Telecommunication',
  'MCA',
  'MTech',
  'Institutional',
];

const MASTER_CATEGORIES = [
  'Technical Fest',
  'Cultural Fest',
  'Sports Fest',
  'Departmental Event',
  'Other',
];

const formatDateDDMMYYYY = (date = new Date()) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const toIsoInputDate = (ddmmyyyy) => {
  if (typeof ddmmyyyy === 'string') {
    const parts = ddmmyyyy.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().split('T')[0];
};

const fromIsoInputDate = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return formatDateDDMMYYYY(new Date());
  const parts = isoStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
  }
  return isoStr;
};

const extractYearFromEvent = (ev) => {
  if (
    ev?.eventYear !== null &&
    ev?.eventYear !== undefined &&
    !Number.isNaN(Number(ev.eventYear))
  ) {
    return Number(ev.eventYear);
  }
  if (typeof ev?.createdDate === 'string') {
    const parts = ev.createdDate.split('-');
    if (
      parts.length === 3 &&
      parts[2].length === 4 &&
      !Number.isNaN(Number(parts[2]))
    ) {
      return Number(parts[2]);
    }
  }
  return 0;
};

const parseIdList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0);
  }
  return String(raw)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);
};

export default function AdminDashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const todayStr = useMemo(() => formatDateDDMMYYYY(new Date()), []);
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'master' | 'profile'
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Users tab state (Department is mandatory for every role)
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    institutionalId: '',
    role: 'STUDENT_COORDINATOR',
    department: 'Computer Engineering',
  });

  // Master Event tab state (manual creation date + multiple Main Event Heads & Student Heads)
  const [newMaster, setNewMaster] = useState({
    name: '',
    wingName: 'Technical Fest',
    budgetCap: '',
    createdDateIso: todayIso,
    mainHeadIds: [],
    studentHeadIds: [],
  });
  const [editingMaster, setEditingMaster] = useState(null);

  const showMessage = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) =>
        prev.text === text ? { type: '', text: '' } : prev
      );
    }, 5000);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, eventsRes] = await Promise.all([
        backendApi.get('/users'),
        backendApi.get('/events'),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } catch (err) {
      console.error('Admin sync error:', err);
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to sync data from backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const masterEvents = useMemo(() => {
    return events
      .filter((ev) => ev.parentEventId === null || ev.parentEventId === undefined)
      .slice()
      .sort((a, b) => {
        const yearDiff = extractYearFromEvent(b) - extractYearFromEvent(a);
        if (yearDiff !== 0) return yearDiff;
        return Number(b.id || 0) - Number(a.id || 0);
      });
  }, [events]);

  const subEvents = useMemo(
    () =>
      events.filter(
        (ev) => ev.parentEventId !== null && ev.parentEventId !== undefined
      ),
    [events]
  );

  const mainEventHeads = users.filter(
    (u) => (u.role || '').toUpperCase() === 'MAIN_EVENT_HEAD'
  );
  const studentHeads = users.filter(
    (u) => (u.role || '').toUpperCase() === 'STUDENT_HEAD'
  );

  const filteredUsers =
    roleFilter === 'ALL'
      ? users
      : users.filter((u) => (u.role || '').toUpperCase() === roleFilter);

  const getMainHeadNames = (ev) => {
    const listIds = parseIdList(ev?.mainHeadIds);
    const ids =
      listIds.length > 0
        ? listIds
        : ev?.mainHeadId
        ? [Number(ev.mainHeadId)]
        : [];
    if (ids.length === 0) return 'Unassigned';
    return ids
      .map((id) => {
        const found = users.find((u) => Number(u.id) === id);
        return found ? `${found.name} (${found.username})` : `#${id}`;
      })
      .join(', ');
  };

  const getStudentHeadNames = (rawIds) => {
    const ids = parseIdList(rawIds);
    if (ids.length === 0) return 'Unassigned';
    return ids
      .map((id) => {
        const found = users.find((u) => Number(u.id) === id);
        return found ? found.name : `#${id}`;
      })
      .join(', ');
  };

  const toggleIdSelection = (list, id) => {
    const numId = Number(id);
    return list.includes(numId)
      ? list.filter((item) => item !== numId)
      : [...list, numId];
  };

  // --- User Handlers ---
  const handleRoleChange = (role) => {
    const institutionalRoles = ['PRINCIPAL', 'STOREKEEPER', 'ACCOUNTS', 'ADMIN'];
    setNewUser((prev) => ({
      ...prev,
      role,
      department: institutionalRoles.includes(role)
        ? 'Institutional'
        : prev.department || 'Computer Engineering',
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUser.password.length < 4) {
      showMessage('error', 'Password must be at least 4 characters long.');
      return;
    }
    if (!newUser.department) {
      showMessage('error', 'Please select a Department for the user.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: newUser.name.trim(),
        username: newUser.username.trim(),
        password: newUser.password,
        institutionalId: newUser.institutionalId.trim(),
        role: newUser.role,
        department: newUser.department,
      };
      await backendApi.post('/users', payload);
      showMessage('success', `User "${payload.username}" created successfully.`);
      setNewUser({
        name: '',
        username: '',
        password: '',
        institutionalId: '',
        role: 'STUDENT_COORDINATOR',
        department: 'Computer Engineering',
      });
      fetchAllData();
    } catch (err) {
      console.error('Create user error:', err);
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to create user.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (String(targetUser.id) === String(user?.id)) {
      showMessage('error', 'You cannot delete your own active admin account.');
      return;
    }
    if (
      !window.confirm(
        `Delete user "${targetUser.name}" (${targetUser.username})?`
      )
    ) {
      return;
    }
    try {
      await backendApi.delete(`/users/${targetUser.id}`);
      showMessage('success', `User "${targetUser.username}" deleted.`);
      fetchAllData();
    } catch (err) {
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to delete user.'
      );
    }
  };

  // --- Master Event Handlers ---
  const handleCreateMasterEvent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formattedDate = fromIsoInputDate(newMaster.createdDateIso || todayIso);
      const yearParts = formattedDate.split('-');
      const selectedYear =
        yearParts.length === 3 && !Number.isNaN(Number(yearParts[2]))
          ? Number(yearParts[2])
          : new Date().getFullYear();

      const payload = {
        name: newMaster.name.trim(),
        wingName: newMaster.wingName,
        budgetCap: parseFloat(newMaster.budgetCap) || 0,
        parentEventId: null,
        mainHeadId:
          newMaster.mainHeadIds.length > 0
            ? Number(newMaster.mainHeadIds[0])
            : null,
        mainHeadIds: newMaster.mainHeadIds.join(','),
        studentHeadIds: newMaster.studentHeadIds.join(','),
        createdDate: formattedDate,
        eventYear: selectedYear,
        department: null,
        status: 'ACTIVE',
      };
      await backendApi.post('/events', payload);
      showMessage(
        'success',
        `Master event "${payload.name}" created (${formattedDate}). Assigned heads can now manage it.`
      );
      setNewMaster({
        name: '',
        wingName: 'Technical Fest',
        budgetCap: '',
        createdDateIso: todayIso,
        mainHeadIds: [],
        studentHeadIds: [],
      });
      fetchAllData();
    } catch (err) {
      console.error('Create master event error:', err);
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to create master event.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveMasterEdit = async (e) => {
    e.preventDefault();
    if (!editingMaster) return;
    setSubmitting(true);
    try {
      const formattedDate = fromIsoInputDate(
        editingMaster.createdDateIso || toIsoInputDate(editingMaster.createdDate)
      );
      const yearParts = formattedDate.split('-');
      const selectedYear =
        yearParts.length === 3 && !Number.isNaN(Number(yearParts[2]))
          ? Number(yearParts[2])
          : extractYearFromEvent(editingMaster) || new Date().getFullYear();

      const mainIds = editingMaster.mainHeadIds || [];

      await backendApi.put(`/events/${editingMaster.id}`, {
        name: editingMaster.name.trim(),
        wingName: editingMaster.wingName,
        budgetCap: parseFloat(editingMaster.budgetCap) || 0,
        mainHeadId: mainIds.length > 0 ? Number(mainIds[0]) : null,
        mainHeadIds: mainIds.join(','),
        studentHeadIds: (editingMaster.studentHeadIds || []).join(','),
        createdDate: formattedDate,
        eventYear: selectedYear,
        status: editingMaster.status || 'ACTIVE',
      });
      showMessage('success', `Master event "${editingMaster.name}" updated.`);
      setEditingMaster(null);
      fetchAllData();
    } catch (err) {
      showMessage(
        'error',
        err.response?.data?.message || 'Failed to update master event.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof onLogout === 'function') onLogout();
    navigate('/', { replace: true });
  };

  const inputClass =
    'w-full px-3.5 py-2 bg-white border border-sage-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/15 outline-none transition';

  const navItems = [
    { id: 'users', label: 'Users', count: users.length },
    { id: 'master', label: 'Master Events', count: masterEvents.length },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-sage-50 text-stone-800 flex flex-col font-sans">
      <header className="bg-white border-b border-sage-200 sticky top-0 z-30">
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-sage-600" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sage-900">
                BillStack
              </span>
              <span className="text-stone-300">/</span>
              <h1 className="text-sm font-medium text-stone-700">
                Admin Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-stone-800 hidden sm:inline">
              {user?.name || user?.username || 'Admin'}
            </span>
            <button
              onClick={fetchAllData}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 rounded-lg text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-60 bg-white border-r border-sage-200 p-4 shrink-0 hidden md:block">
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-between cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-sage-100 text-sage-900 border border-sage-200'
                    : 'text-stone-600 hover:bg-sage-50 hover:text-stone-900'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white border border-sage-200 text-stone-600">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Mobile Nav */}
            <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-sage-600 text-white'
                      : 'bg-white border border-sage-200 text-stone-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {feedback.text && (
              <div
                className={`px-4 py-3 rounded-lg border text-xs font-medium ${
                  feedback.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-sage-100 border-sage-200 text-sage-900'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-4 bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <h2 className="text-base font-semibold text-stone-900 mb-4 pb-3 border-b border-sage-100">
                    Create User Account
                  </h2>
                  <form onSubmit={handleCreateUser} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) =>
                          setNewUser({ ...newUser, name: e.target.value })
                        }
                        placeholder="e.g., Riya Kulkarni"
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Role *
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        className={inputClass}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Department *
                      </label>
                      <select
                        value={newUser.department}
                        onChange={(e) =>
                          setNewUser({ ...newUser, department: e.target.value })
                        }
                        required
                        className={inputClass}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        {newUser.role === 'STUDENT_COORDINATOR' ||
                        newUser.role === 'STUDENT_HEAD'
                          ? 'Roll Number / Enrollment ID *'
                          : 'Employee / Staff ID *'}
                      </label>
                      <input
                        type="text"
                        value={newUser.institutionalId}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            institutionalId: e.target.value,
                          })
                        }
                        placeholder="e.g., BT23F06F025 or EMP-101"
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser({ ...newUser, username: e.target.value })
                        }
                        placeholder="Login username"
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        placeholder="Minimum 4 characters"
                        required
                        className={inputClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white text-sm font-medium rounded-lg transition cursor-pointer mt-1"
                    >
                      {submitting ? 'Creating...' : 'Create User'}
                    </button>
                  </form>
                </section>

                <section className="lg:col-span-8 bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sage-100">
                    <h2 className="text-base font-semibold text-stone-900">
                      Registered Users ({filteredUsers.length})
                    </h2>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-sage-200 rounded-lg text-xs font-medium text-stone-700 outline-none focus:border-sage-500"
                    >
                      <option value="ALL">All Roles</option>
                      {ALL_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {loading ? (
                    <div className="py-10 text-center text-xs text-stone-500">
                      Loading users...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-10 text-center text-xs text-stone-500 bg-sage-50/50 border border-sage-200/80 rounded-lg">
                      No users found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-sage-200 rounded-lg">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-sage-50 text-stone-600 text-xs font-medium border-b border-sage-200">
                            <th className="py-2.5 px-3.5">Name</th>
                            <th className="py-2.5 px-3.5">Username</th>
                            <th className="py-2.5 px-3.5">Role</th>
                            <th className="py-2.5 px-3.5">ID / Dept</th>
                            <th className="py-2.5 px-3.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sage-100">
                          {filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-sage-50/40">
                              <td className="py-2.5 px-3.5 font-medium text-stone-900">
                                {u.name}
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-xs text-stone-600">
                                {u.username}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span className="px-2 py-0.5 text-[11px] font-medium bg-sage-50 border border-sage-200 text-sage-800 rounded-md">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-xs text-stone-500">
                                <span className="block font-mono">
                                  {u.institutionalId}
                                </span>
                                <span className="block text-[11px] text-stone-400">
                                  {u.department || 'Institutional'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-center">
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* MASTER EVENTS TAB (Admin creates Master Events only) */}
            {activeTab === 'master' && (
              <div className="space-y-6">
                <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-2xl">
                  <h2 className="text-base font-semibold text-stone-900 mb-4 pb-3 border-b border-sage-100">
                    Create Master Event
                  </h2>
                  <form
                    onSubmit={handleCreateMasterEvent}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Event Title *
                        </label>
                        <input
                          type="text"
                          value={newMaster.name}
                          onChange={(e) =>
                            setNewMaster({ ...newMaster, name: e.target.value })
                          }
                          placeholder="e.g., Wings Technical Fest 2026"
                          required
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Category
                        </label>
                        <select
                          value={newMaster.wingName}
                          onChange={(e) =>
                            setNewMaster({
                              ...newMaster,
                              wingName: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          {MASTER_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Budget Cap (INR) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newMaster.budgetCap}
                          onChange={(e) =>
                            setNewMaster({
                              ...newMaster,
                              budgetCap: e.target.value,
                            })
                          }
                          placeholder="e.g., 500000"
                          required
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Event Creation Date (Past or Current Year) *
                        </label>
                        <input
                          type="date"
                          value={newMaster.createdDateIso}
                          onChange={(e) =>
                            setNewMaster({
                              ...newMaster,
                              createdDateIso: e.target.value,
                            })
                          }
                          required
                          className={inputClass}
                        />
                        <span className="text-[11px] text-stone-400 mt-0.5 block">
                          Saved as: {fromIsoInputDate(newMaster.createdDateIso || todayStr)}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-stone-700">
                        Assign Main Event Head(s) ({newMaster.mainHeadIds.length}{' '}
                        selected)
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                        {mainEventHeads.length === 0 ? (
                          <p className="text-xs text-stone-400">
                            No Main Event Heads created yet.
                          </p>
                        ) : (
                          mainEventHeads.map((h) => (
                            <label
                              key={h.id}
                              className="flex items-center gap-2 text-xs text-stone-700 bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newMaster.mainHeadIds.includes(
                                  Number(h.id)
                                )}
                                onChange={() =>
                                  setNewMaster((prev) => ({
                                    ...prev,
                                    mainHeadIds: toggleIdSelection(
                                      prev.mainHeadIds,
                                      h.id
                                    ),
                                  }))
                                }
                              />
                              <span className="font-medium">{h.name}</span>
                              <span className="text-stone-400 ml-auto font-mono">
                                {h.username}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-stone-700">
                        Assign Student Head(s) ({newMaster.studentHeadIds.length}{' '}
                        selected)
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                        {studentHeads.length === 0 ? (
                          <p className="text-xs text-stone-400">
                            No Student Heads created yet.
                          </p>
                        ) : (
                          studentHeads.map((sh) => (
                            <label
                              key={sh.id}
                              className="flex items-center gap-2 text-xs text-stone-700 bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newMaster.studentHeadIds.includes(
                                  Number(sh.id)
                                )}
                                onChange={() =>
                                  setNewMaster((prev) => ({
                                    ...prev,
                                    studentHeadIds: toggleIdSelection(
                                      prev.studentHeadIds,
                                      sh.id
                                    ),
                                  }))
                                }
                              />
                              <span className="font-medium">{sh.name}</span>
                              <span className="text-stone-400 ml-auto font-mono">
                                {sh.username}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-sage-300 text-white text-sm font-medium rounded-lg transition cursor-pointer"
                    >
                      {submitting ? 'Creating...' : 'Create Master Event'}
                    </button>
                  </form>
                </section>

                <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-sage-100">
                    <h2 className="text-base font-semibold text-stone-900">
                      Master Events by Year ({masterEvents.length})
                    </h2>
                    <span className="text-xs text-stone-500">
                      Sorted descending by year &middot; Sub-events are created by assigned Student Heads
                    </span>
                  </div>

                  {masterEvents.length === 0 ? (
                    <div className="py-10 text-center text-xs text-stone-500 bg-sage-50/50 border border-sage-200/80 rounded-lg">
                      No master events created yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {masterEvents.map((m) => {
                        const childCount = subEvents.filter(
                          (s) => String(s.parentEventId) === String(m.id)
                        ).length;
                        const yr = extractYearFromEvent(m);
                        const existingMainIds =
                          parseIdList(m.mainHeadIds).length > 0
                            ? parseIdList(m.mainHeadIds)
                            : m.mainHeadId
                            ? [Number(m.mainHeadId)]
                            : [];
                        return (
                          <div
                            key={m.id}
                            className="p-5 bg-sage-50/40 border border-sage-200 rounded-xl space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-sage-100 border border-sage-200 text-sage-800 rounded-md">
                                  {yr || 'Year N/A'} &middot;{' '}
                                  {m.wingName || 'Event'}
                                </span>
                                <span className="text-[11px] font-medium px-2 py-0.5 bg-white border border-sage-200 text-stone-600 rounded-md">
                                  {m.status || 'ACTIVE'}
                                </span>
                              </div>
                              <h3 className="text-sm font-semibold text-stone-900">
                                {m.name}
                              </h3>
                              <div className="bg-white p-3 rounded-lg border border-sage-100 space-y-1.5 text-xs">
                                <div className="flex justify-between text-stone-600">
                                  <span>Created Date</span>
                                  <span className="font-mono text-stone-800">
                                    {m.createdDate || '—'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-stone-600">
                                  <span>Budget</span>
                                  <span className="font-semibold text-stone-900">
                                    INR{' '}
                                    {Number(m.budgetCap || 0).toLocaleString(
                                      'en-IN'
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between text-stone-600 gap-2">
                                  <span>Main Head(s)</span>
                                  <span className="font-medium text-stone-800 truncate max-w-[150px]">
                                    {getMainHeadNames(m)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-stone-600 gap-2">
                                  <span>Student Head(s)</span>
                                  <span className="font-medium text-stone-800 truncate max-w-[150px]">
                                    {getStudentHeadNames(m.studentHeadIds)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-stone-600">
                                  <span>Sub-Events</span>
                                  <span className="font-medium text-stone-800">
                                    {childCount}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingMaster({
                                  id: m.id,
                                  name: m.name || '',
                                  wingName: m.wingName || 'Technical Fest',
                                  budgetCap: m.budgetCap ?? '',
                                  mainHeadIds: existingMainIds,
                                  studentHeadIds: parseIdList(m.studentHeadIds),
                                  createdDate: m.createdDate || todayStr,
                                  createdDateIso: toIsoInputDate(
                                    m.createdDate || todayStr
                                  ),
                                  status: m.status || 'ACTIVE',
                                })
                              }
                              className="w-full py-2 bg-white hover:bg-sage-50 border border-sage-200 text-sage-800 text-xs font-medium rounded-lg transition cursor-pointer"
                            >
                              Edit Master Event
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <section className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] max-w-lg space-y-4">
                <h2 className="text-base font-semibold text-stone-900 pb-3 border-b border-sage-100">
                  Profile
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Full Name</span>
                    <span className="font-medium text-stone-900">
                      {user?.name || 'System Admin'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Username</span>
                    <span className="font-mono text-stone-800">
                      {user?.username || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Role</span>
                    <span className="font-medium text-sage-800">
                      {user?.role || 'ADMIN'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-sage-100">
                    <span className="text-stone-500">Department</span>
                    <span className="text-stone-800">
                      {user?.department || 'Institutional'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-stone-500">Institutional ID</span>
                    <span className="font-mono text-stone-800">
                      {user?.institutionalId || 'N/A'}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* EDIT MASTER EVENT MODAL */}
      {editingMaster && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-sage-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/60 flex justify-between items-center">
              <h3 className="text-base font-semibold text-stone-900">
                Edit Master Event
              </h3>
              <button
                onClick={() => setEditingMaster(null)}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={handleSaveMasterEdit}
              className="p-6 overflow-y-auto space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={editingMaster.name}
                  onChange={(e) =>
                    setEditingMaster({ ...editingMaster, name: e.target.value })
                  }
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Event Creation Date
                </label>
                <input
                  type="date"
                  value={editingMaster.createdDateIso || todayIso}
                  onChange={(e) =>
                    setEditingMaster({
                      ...editingMaster,
                      createdDateIso: e.target.value,
                    })
                  }
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Budget Cap (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingMaster.budgetCap}
                  onChange={(e) =>
                    setEditingMaster({
                      ...editingMaster,
                      budgetCap: e.target.value,
                    })
                  }
                  required
                  className={inputClass}
                />
              </div>
              <div className="p-3 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-stone-700">
                  Main Event Head(s) ({(editingMaster.mainHeadIds || []).length}{' '}
                  selected)
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5">
                  {mainEventHeads.map((h) => (
                    <label
                      key={h.id}
                      className="flex items-center gap-2 text-xs bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(editingMaster.mainHeadIds || []).includes(
                          Number(h.id)
                        )}
                        onChange={() =>
                          setEditingMaster((prev) => ({
                            ...prev,
                            mainHeadIds: toggleIdSelection(
                              prev.mainHeadIds || [],
                              h.id
                            ),
                          }))
                        }
                      />
                      <span className="font-medium">{h.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-sage-50/60 border border-sage-200/80 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-stone-700">
                  Student Head(s) ({(editingMaster.studentHeadIds || []).length}{' '}
                  selected)
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5">
                  {studentHeads.map((sh) => (
                    <label
                      key={sh.id}
                      className="flex items-center gap-2 text-xs bg-white px-2.5 py-1.5 rounded border border-sage-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(editingMaster.studentHeadIds || []).includes(
                          Number(sh.id)
                        )}
                        onChange={() =>
                          setEditingMaster((prev) => ({
                            ...prev,
                            studentHeadIds: toggleIdSelection(
                              prev.studentHeadIds || [],
                              sh.id
                            ),
                          }))
                        }
                      />
                      <span className="font-medium">{sh.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMaster(null)}
                  className="px-4 py-2 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 