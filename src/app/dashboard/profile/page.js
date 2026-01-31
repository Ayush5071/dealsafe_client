"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to fetch profile');
        const json = await res.json();
        setProfile(json.profile || {});
      } catch (err) {
        console.error('Error fetching profile', err);
      } finally {
        setLoading(false);
      }
    }
    if (session) fetchProfile();
  }, [session]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      if (!res.ok) throw new Error('Failed to save profile');
      alert('Profile saved successfully!');
    } catch (err) {
      alert('Failed to save profile: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  function updateField(key, value) {
    setProfile(p => ({ ...p, [key]: value }));
  }

  if (!session) return <div>Please sign in to view your profile.</div>;
  if (loading) return <div>Loading profile...</div>;

  const role = profile?.role;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="bg-zinc-900 p-6 rounded-lg mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
            {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
          </div>
          <div>
            <h3 className="text-xl font-semibold">{session.user?.name || "User"}</h3>
            <p className="text-zinc-400">{session.user?.email}</p>
            <p className="text-blue-400 mt-1">Role: {role || 'Not set'}</p>
          </div>
        </div>

        {/* Claim Admin/Expert Access for default admins */}

        {!profile?.isAdmin && !profile?.isExpert && (
          <div className="bg-yellow-900/10 border border-yellow-800 rounded p-4 mb-6">
            <p className="text-yellow-200 text-sm mb-3">If you are listed as a default admin email and don't have admin privileges yet, click below to claim admin/expert access.</p>
            <p className="text-yellow-200 text-xs mb-3">Authorized admin emails: <strong className="text-white">{(process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAILS || process.env.DEFAULT_ADMIN_EMAILS || 'Not configured')}</strong></p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/promote-me', { method: 'POST' });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    alert('Failed to claim admin access: ' + (j.error || res.status));
                    return;
                  }
                  alert('Admin & Expert privileges granted. Refreshing profile...');
                  const r = await fetch('/api/user/profile');
                  const j = await r.json();
                  setProfile(j.profile || {});
                } catch (e) {
                  console.error('Claim admin error:', e);
                  alert('Failed to claim admin access');
                }
              }}
              className="px-4 py-2 bg-yellow-600 text-black rounded"
            >Claim Admin / Expert Access</button>
          </div>
        )}

      <form onSubmit={handleSave} className="bg-zinc-900 p-6 rounded-lg space-y-6">
        <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>
        <p className="text-zinc-400 mb-4">Help us tailor contract analysis and recommendations to your needs.</p>

        {role === 'Freelancer' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Total Earnings (₹)</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.totalEarnings || ''} onChange={(e) => updateField('totalEarnings', e.target.value)} placeholder="e.g., 500000" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Number of Projects Completed</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.projectsCompleted || ''} onChange={(e) => updateField('projectsCompleted', e.target.value)} placeholder="e.g., 5" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Short Description of Projects</label>
              <textarea className="w-full p-2 bg-zinc-800 text-white rounded" rows="4" value={profile.projectsDescription || ''} onChange={(e) => updateField('projectsDescription', e.target.value)} placeholder="Describe the projects you've worked on (tech stack, domain, etc.)" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Years of Freelancing Experience</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', e.target.value)} placeholder="e.g., 2" />
            </div>
          </>
        )}

        {role === 'Corporate Employee' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Current Salary (₹/year)</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.currentSalary || ''} onChange={(e) => updateField('currentSalary', e.target.value)} placeholder="e.g., 1200000" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Years of Experience</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', e.target.value)} placeholder="e.g., 5" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Tech Stack / Skills</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.techStack || ''} onChange={(e) => updateField('techStack', e.target.value)} placeholder="e.g., React, Node.js, Python, AWS" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Current Company</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.currentCompany || ''} onChange={(e) => updateField('currentCompany', e.target.value)} placeholder="e.g., Acme Corp" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Previous Companies</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.previousCompanies || ''} onChange={(e) => updateField('previousCompanies', e.target.value)} placeholder="e.g., TechCo, StartupXYZ" />
            </div>
          </>
        )}

        {role === 'Agency' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Agency Name</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.agencyName || ''} onChange={(e) => updateField('agencyName', e.target.value)} placeholder="e.g., Creative Solutions Agency" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Number of Employees</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.employeeCount || ''} onChange={(e) => updateField('employeeCount', e.target.value)} placeholder="e.g., 15" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Clients Served</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.clientsServed || ''} onChange={(e) => updateField('clientsServed', e.target.value)} placeholder="e.g., 50" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Services Offered</label>
              <textarea className="w-full p-2 bg-zinc-800 text-white rounded" rows="3" value={profile.servicesOffered || ''} onChange={(e) => updateField('servicesOffered', e.target.value)} placeholder="e.g., Web development, branding, SEO" />
            </div>
          </>
        )}

        {role === 'Employer' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Company Name</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.companyName || ''} onChange={(e) => updateField('companyName', e.target.value)} placeholder="e.g., My Company Pvt Ltd" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Industry</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.industry || ''} onChange={(e) => updateField('industry', e.target.value)} placeholder="e.g., IT Services" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Number of Employees</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.employeeCount || ''} onChange={(e) => updateField('employeeCount', e.target.value)} placeholder="e.g., 200" />
            </div>
          </>
        )}

        {role === 'Startup Founder' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Startup Name</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.startupName || ''} onChange={(e) => updateField('startupName', e.target.value)} placeholder="e.g., InnovateTech" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Funding Stage</label>
              <select className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.fundingStage || ''} onChange={(e) => updateField('fundingStage', e.target.value)}>
                <option value="">Select stage</option>
                <option>Bootstrapped</option>
                <option>Pre-seed</option>
                <option>Seed</option>
                <option>Series A</option>
                <option>Series B+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Team Size</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.teamSize || ''} onChange={(e) => updateField('teamSize', e.target.value)} placeholder="e.g., 10" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Domain / Product</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.domain || ''} onChange={(e) => updateField('domain', e.target.value)} placeholder="e.g., FinTech, EdTech" />
            </div>
          </>
        )}

        {role === 'HR Professional' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Company Name</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.companyName || ''} onChange={(e) => updateField('companyName', e.target.value)} placeholder="e.g., HR Solutions Inc" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Years of HR Experience</label>
              <input type="number" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', e.target.value)} placeholder="e.g., 7" />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Specialization</label>
              <input type="text" className="w-full p-2 bg-zinc-800 text-white rounded" value={profile.specialization || ''} onChange={(e) => updateField('specialization', e.target.value)} placeholder="e.g., Recruitment, Policy Design" />
            </div>
          </>
        )}

        {!role && (
          <p className="text-zinc-400">Please select your role first to complete your profile.</p>
        )}

        {role && (
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-blue-600 px-4 py-2 rounded">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </form>
      </div>
    </div>
  );
}
