"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function AdminPanel() {
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/manage-experts');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        alert('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function promoteToExpert(email) {
    if (!confirm(`Promote ${email} to Expert?`)) return;

    try {
      const res = await fetch('/api/admin/manage-experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'promote_expert' })
      });

      if (res.ok) {
        alert('User promoted to Expert successfully');
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to promote user'));
      }
    } catch (error) {
      console.error('Promote error:', error);
      alert('Failed to promote user');
    }
  }

  async function revokeExpert(email) {
    if (!confirm(`Revoke Expert privileges for ${email}?`)) return;

    try {
      const res = await fetch('/api/admin/manage-experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'revoke_expert' })
      });

      if (res.ok) {
        alert('Expert privileges revoked successfully');
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to revoke privileges'));
      }
    } catch (error) {
      console.error('Revoke error:', error);
      alert('Failed to revoke privileges');
    }
  }

  async function promoteToAdmin(email) {
    if (!confirm(`Promote ${email} to Admin?`)) return;
    try {
      const res = await fetch('/api/admin/manage-experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'promote_admin' })
      });
      if (res.ok) {
        alert('User promoted to Admin successfully');
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to promote admin'));
      }
    } catch (err) {
      console.error('Promote admin error:', err);
      alert('Failed to promote admin');
    }
  }

  async function revokeAdmin(email) {
    if (!confirm(`Revoke Admin privileges for ${email}?`)) return;
    try {
      const res = await fetch('/api/admin/manage-experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'revoke_admin' })
      });
      if (res.ok) {
        alert('Admin privileges revoked successfully');
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Failed to revoke admin'));
      }
    } catch (err) {
      console.error('Revoke admin error:', err);
      alert('Failed to revoke admin');
    }
  }

  if (loading) {
    return <div className="text-zinc-400">Loading users...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔑 Admin Panel</h1>
      <p className="text-zinc-400 mb-8">
        Manage user roles and expert privileges. Only admins can access this panel.
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 border-b border-zinc-700">
              <tr>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Role</th>
                <th className="text-left p-4">Expert</th>
                <th className="text-left p-4">Expert Flag</th>
                <th className="text-left p-4">Admin</th>
                <th className="text-left p-4">Joined</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="p-4 text-sm">{user.email}</td>
                  <td className="p-4 text-sm">{user.name || '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="px-2 py-1 bg-zinc-700 rounded text-xs">
                      {user.role || 'None'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    {user.isExpert ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">✗</span>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {user.expert ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">✗</span>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {user.isAdmin ? (
                      <span className="text-blue-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">✗</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-zinc-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {!user.isExpert ? (
                        <button
                          onClick={() => promoteToExpert(user.email)}
                          className="px-3 py-1 bg-green-600 rounded text-sm hover:bg-green-700"
                          disabled={user.isAdmin && user.email === session?.user?.email}
                        >
                          Promote to Expert
                        </button>
                      ) : (
                        <button
                          onClick={() => revokeExpert(user.email)}
                          className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
                          disabled={user.isAdmin && user.email === session?.user?.email}
                        >
                          Revoke Expert
                        </button>
                      )}

                      {!user.isAdmin ? (
                        <button
                          onClick={() => promoteToAdmin(user.email)}
                          className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                          disabled={user.email === session?.user?.email}
                        >
                          Make Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => revokeAdmin(user.email)}
                          className="px-3 py-1 bg-orange-600 rounded text-sm hover:bg-orange-700"
                          disabled={user.email === session?.user?.email}
                        >
                          Revoke Admin
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center text-zinc-400 mt-8">
          No users found
        </div>
      )}
    </div>
  );
}
