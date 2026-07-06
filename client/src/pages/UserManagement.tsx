import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import { DispatchBadge } from '@/components/ui/DispatchBadge';
import { HomebaseBadge } from '@/components/ui/HomebaseBadge';

import { apiRequest } from '@/lib/queryClient';
import { API_ENDPOINTS } from '@/config/api';
import { AllUser } from '@shared/types';
import { Search, LayoutGrid, List, Users, CloudDownload } from 'lucide-react';

// Maps raw backend role strings to human-readable labels
function roleLabel(role: string): string {
  switch (role) {
    case 'admin':       return 'Super Admin';
    case 'manager':     return 'Manager';
    case 'is_driver':   return 'Rider';
    case 'driver':      return 'Rider';
    case 'viewer':      return 'Viewer';
    case 'is_staff':    return 'Staff';
    default:            return role;
  }
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':       return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'manager':     return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'is_driver':
    case 'driver':      return 'bg-green-100 text-green-800 border-green-200';
    case 'viewer':      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:            return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeOtp, setActiveOtp] = useState<{ rider_id: string; otp: string; expires_in: number } | null>(null);

  const canAccess = !!(currentUser?.is_super_user || currentUser?.is_ops_team || currentUser?.is_staff);

  useEffect(() => {
    if (canAccess) loadUsers();
  }, [canAccess]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('GET', '/api/v1/auth/all-users');
      const data = await res.json();
      setAllUsers(data.users || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const syncFromPops = async () => {
    setIsSyncing(true);
    try {
      // Step 1: Sync homebases first (riders depend on homebase FK references)
      const hbRes = await apiRequest('POST', API_ENDPOINTS.auth.syncHomebases);
      const hbData = await hbRes.json();
      if (!hbData.success) {
        toast({ title: 'Homebase sync failed', description: hbData.message, variant: 'destructive' });
        return;
      }

      // Step 2: Sync riders
      const rRes = await apiRequest('POST', API_ENDPOINTS.auth.syncRiders);
      const rData = await rRes.json();
      if (!rData.success) {
        toast({ title: 'Rider sync failed', description: rData.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Sync complete', description: `Homebases: ${hbData.message}. Riders: ${rData.message}` });

      // Step 3: Refresh user list
      await loadUsers();
    } catch (e: any) {
      // Surface POPS-specific errors clearly instead of generic "session expired"
      const msg = e.message || 'Sync failed';
      const isPopsError = msg.includes('POPS') || msg.includes('token');
      toast({
        title: isPopsError ? 'POPS sync error' : 'Sync failed',
        description: isPopsError
          ? 'The POPS service token may have expired. Please contact an admin to update it.'
          : msg,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const archiveUser = async (userId: string, name: string) => {
    if (!window.confirm(`Archive ${name}?`)) return;
    try {
      const res = await apiRequest('POST', API_ENDPOINTS.auth.archive(userId));
      const data = await res.json();
      toast({ title: data.success ? 'Archived' : 'Error', description: data.message, variant: data.success ? 'default' : 'destructive' });
      if (data.success) loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to archive user', variant: 'destructive' });
    }
  };

  const restoreUser = async (userId: string, name: string) => {
    if (!window.confirm(`Restore ${name}?`)) return;
    try {
      const res = await apiRequest('POST', API_ENDPOINTS.auth.restore(userId));
      const data = await res.json();
      toast({ title: data.success ? 'Restored' : 'Error', description: data.message, variant: data.success ? 'default' : 'destructive' });
      if (data.success) loadUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to restore user', variant: 'destructive' });
    }
  };

  const fetchOtp = async (riderId: string) => {
    try {
      const res = await apiRequest('GET', `/api/v1/auth/riders/${riderId}/active-otp`);
      const data = await res.json();
      if (data.success) {
        setActiveOtp({ rider_id: riderId, otp: data.otp, expires_in: data.expires_in_seconds });
      } else {
        toast({ title: 'No active OTP', description: data.message || 'Rider has no pending OTP.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'No active OTP', description: 'Rider has no pending OTP.', variant: 'destructive' });
    }
  };

  const filtered = allUsers.filter(u => {
    if (!showArchived && u.archived_at) return false;
    const q = search.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.rider_id || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  });

  const isRider = (u: AllUser) => u.role === 'is_driver' || u.role === 'driver';

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={syncFromPops} disabled={isSyncing || loading} variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <CloudDownload className={`h-4 w-4 mr-1.5 ${isSyncing || loading ? 'animate-pulse' : ''}`} />
            {isSyncing ? 'Syncing…' : loading ? 'Refreshing…' : 'Sync & Refresh'}
          </Button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, ID, email, phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
            Show Archived
          </label>
          {/* View toggle — hidden on mobile, always card */}
          <div className="hidden sm:flex border rounded-md overflow-hidden">
            <button onClick={() => setViewMode('card')} className={`px-2.5 py-1.5 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`} title="Card view">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('table')} className={`px-2.5 py-1.5 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`} title="Table view">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm">Loading users…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Users className="h-10 w-10 opacity-40" />
          <p className="text-sm">No users found.</p>
        </div>
      ) : viewMode === 'table' ? (
        // ── Table view (sm+) ──────────────────────────────────────────────
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">ID</th>
                <th className="hidden md:table-cell px-4 py-3 text-left font-semibold text-muted-foreground">Phone</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left font-semibold text-muted-foreground">Homebase</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden sm:table-cell">Last Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(u => (
                <tr key={u.id} className={u.archived_at ? 'opacity-60 bg-red-50/30' : 'hover:bg-muted/30'}>
                  <td className="px-4 py-3 font-medium truncate max-w-[150px]">{u.full_name || u.rider_id}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">{u.rider_id}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{u.phone || '—'}</td>
                  <td className="hidden lg:table-cell px-4 py-3">
                    {u.primary_homebase_details && <HomebaseBadge homebase={u.primary_homebase_details} className="text-xs" />}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.archived_at
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">Archived</span>
                      : <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    }
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {currentUser?.is_super_user && u.phone && isRider(u) && (
                        <Button onClick={() => fetchOtp(u.rider_id)} size="sm" variant="outline" className="h-7 px-2 border-purple-200 text-purple-600 hover:bg-purple-50 text-xs">OTP</Button>
                      )}
                      {!u.archived_at
                        ? <Button onClick={() => archiveUser(u.id, u.full_name || u.rider_id)} size="sm" variant="outline" className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-50 text-xs">Archive</Button>
                        : <Button onClick={() => restoreUser(u.id, u.full_name || u.rider_id)} size="sm" variant="outline" className="h-7 px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs">Restore</Button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // ── Card view (default / mobile) ──────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(u => (
            <div key={u.id} className={`flex flex-col border rounded-xl p-4 gap-3 ${u.archived_at ? 'bg-red-50/40 border-red-200 opacity-75' : 'bg-card'}`}>
              {/* Top: avatar area + name + badges */}
              <div className="flex items-start gap-3">
                {u.dispatch_option && (
                  <DispatchBadge dispatchOption={u.dispatch_option} iconOnly className="w-9 h-9 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold truncate">{u.full_name || u.rider_id}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                    {u.archived_at
                      ? <Badge variant="destructive" className="text-xs">Archived</Badge>
                      : <Badge variant={u.is_active ? 'default' : 'secondary'} className="text-xs">{u.is_active ? 'Active' : 'Inactive'}</Badge>
                    }
                  </div>
                  {u.primary_homebase_details && (
                    <HomebaseBadge homebase={u.primary_homebase_details} className="text-xs" />
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="truncate">ID: {u.rider_id}</p>
                {u.email && <p className="truncate">{u.email}</p>}
                {u.phone && <p>Phone: {u.phone}</p>}
                <p className="text-xs">Last login: {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end mt-auto">
                {currentUser?.is_super_user && u.phone && isRider(u) && (
                  <Button onClick={() => fetchOtp(u.rider_id)} size="sm" variant="outline" className="h-8 px-3 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 text-xs" title="Show active OTP (emergency bypass)">
                    OTP
                  </Button>
                )}
                {!u.archived_at
                  ? <Button onClick={() => archiveUser(u.id, u.full_name || u.rider_id)} size="sm" variant="outline" className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs">Archive</Button>
                  : <Button onClick={() => restoreUser(u.id, u.full_name || u.rider_id)} size="sm" variant="outline" className="h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs">Restore</Button>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* OTP modal */}
      {activeOtp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Emergency OTP</p>
            <h3 className="text-base font-semibold mb-0.5">{activeOtp.rider_id}</h3>
            <div className="text-5xl font-mono font-bold tracking-[0.3em] text-purple-700 py-4">
              {activeOtp.otp}
            </div>
            <p className="text-xs text-muted-foreground mb-5">Expires in ~{activeOtp.expires_in}s</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setActiveOtp(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default withPageErrorBoundary(UserManagementPage, 'User Management');
