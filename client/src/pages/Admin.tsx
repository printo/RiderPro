import authService from "@/services/AuthService";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const user = authService.getUser();
  const role = user?.role || "viewer";

  const canAccessAdmin = role === "admin" || role === "isops";
  const canEdit = role === "admin";

  if (!canAccessAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Access denied</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You do not have permission to view the admin dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* System Settings Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">System Settings</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Configure global system preferences.</p>
          <div className="flex gap-3">
            <Button disabled={!canEdit}>Save Settings</Button>
            {!canEdit && <span className="text-xs text-muted-foreground">View only (isops)</span>}
          </div>
        </CardContent>
      </Card>

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">User Management</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Create, update or disable users.</p>
          <div className="flex gap-3">
            <Button disabled={!canEdit}>Add User</Button>
            <Button variant="secondary" disabled={!canEdit}>Update Roles</Button>
          </div>
          {!canEdit && <span className="text-xs text-muted-foreground">View only (isops)</span>}
        </CardContent>
      </Card>

      {/* Audit & Monitoring Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Audit & Monitoring</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Review system activity and health checks.</p>
          <div className="flex gap-3">
            <Button variant="outline">View Logs</Button>
            <Button variant="outline">System Health</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


