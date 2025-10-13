import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import authService from "@/services/AuthService";
import {
  Key,
  Shield,
  Eye,
  Activity,
  Clock,
  User,
  Calendar,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  RefreshCw
} from "lucide-react";

interface ApiToken {
  id: number;
  name: string;
  description?: string;
  permissions: 'read' | 'write' | 'admin';
  status: 'active' | 'disabled' | 'revoked';
  prefix: string;
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  requestCount: number;
  createdBy: string;
}

interface TokenUsage {
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7d: number;
  requestsLast30d: number;
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
  recentActivity: Array<{
    timestamp: string;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress?: string;
  }>;
}

interface TokenDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: ApiToken | null;
  onTokenUpdated: () => void;
}

const TokenDetailsModal: React.FC<TokenDetailsModalProps> = ({
  isOpen,
  onClose,
  token,
  onTokenUpdated
}) => {
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && token) {
      loadUsageData();
    }
  }, [isOpen, token]);

  const loadUsageData = async () => {
    if (!token) return;

    try {
      setLoadingUsage(true);
      const response = await authService.fetchWithAuth(`/api/admin/tokens/${token.id}/usage`);

      if (response.ok) {
        const data = await response.json();
        setUsage(data.data.usage);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to load token usage data",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load token usage: " + (error.message || 'Unknown error'),
        variant: "destructive"
      });
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'disabled' | 'revoked') => {
    if (!token) return;

    try {
      setUpdatingStatus(true);
      const response = await authService.fetchWithAuth(`/api/admin/tokens/${token.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Token ${newStatus} successfully`,
        });
        onTokenUpdated();
        onClose();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || `Failed to ${newStatus} token`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${newStatus} token: ` + (error.message || 'Unknown error'),
        variant: "destructive"
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'disabled':
        return <Badge variant="secondary"><Pause className="w-3 h-3 mr-1" />Disabled</Badge>;
      case 'revoked':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPermissionBadge = (permission: string) => {
    switch (permission) {
      case 'admin':
        return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'write':
        return <Badge variant="default"><Key className="w-3 h-3 mr-1" />Write</Badge>;
      case 'read':
        return <Badge variant="secondary"><Eye className="w-3 h-3 mr-1" />Read</Badge>;
      default:
        return <Badge variant="outline">{permission}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  if (!token) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Token Details: {token.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Token Information */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Token Information</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm">{token.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(token.status)}
                    {isExpired(token.expiresAt) && (
                      <Badge variant="destructive" className="ml-2">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Expired
                      </Badge>
                    )}
                    {isExpiringSoon(token.expiresAt) && !isExpired(token.expiresAt) && (
                      <Badge variant="outline" className="border-orange-500 text-orange-700 ml-2">
                        <Clock className="w-3 h-3 mr-1" />
                        Expires Soon
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                  <div className="mt-1">{getPermissionBadge(token.permissions)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Token Prefix</label>
                  <p className="text-sm font-mono">{token.prefix}...</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created By</label>
                  <p className="text-sm flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {token.createdBy}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-sm flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(token.createdAt)}
                  </p>
                </div>
                {token.expiresAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Expires At</label>
                    <p className="text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(token.expiresAt)}
                    </p>
                  </div>
                )}
                {token.lastUsedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Used</label>
                    <p className="text-sm flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {formatDate(token.lastUsedAt)}
                    </p>
                  </div>
                )}
              </div>

              {token.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{token.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Statistics
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsageData}
                disabled={loadingUsage}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingUsage ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsage ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading usage data...</div>
                </div>
              ) : usage ? (
                <div className="space-y-6">
                  {/* Usage Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{usage.totalRequests}</div>
                      <div className="text-sm text-muted-foreground">Total Requests</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{usage.requestsLast24h}</div>
                      <div className="text-sm text-muted-foreground">Last 24 Hours</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{usage.requestsLast7d}</div>
                      <div className="text-sm text-muted-foreground">Last 7 Days</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{usage.requestsLast30d}</div>
                      <div className="text-sm text-muted-foreground">Last 30 Days</div>
                    </div>
                  </div>

                  {/* Top Endpoints */}
                  {usage.topEndpoints && usage.topEndpoints.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Top Endpoints</h4>
                      <div className="space-y-2">
                        {usage.topEndpoints.slice(0, 5).map((endpoint, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {endpoint.method}
                              </Badge>
                              <span className="text-sm font-mono">{endpoint.endpoint}</span>
                            </div>
                            <span className="text-sm font-medium">{endpoint.count} requests</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {usage.recentActivity && usage.recentActivity.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Recent Activity</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {usage.recentActivity.slice(0, 10).map((activity, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={activity.statusCode >= 200 && activity.statusCode < 300 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {activity.statusCode}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {activity.method}
                              </Badge>
                              <span className="font-mono">{activity.endpoint}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">
                                {formatDate(activity.timestamp)}
                              </div>
                              {activity.ipAddress && (
                                <div className="text-xs text-muted-foreground">
                                  {activity.ipAddress}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No usage data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              {token.status === 'active' && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('disabled')}
                  disabled={updatingStatus}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Disable Token
                </Button>
              )}
              {token.status === 'disabled' && (
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange('active')}
                  disabled={updatingStatus}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enable Token
                </Button>
              )}
              {token.status !== 'revoked' && (
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange('revoked')}
                  disabled={updatingStatus}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Revoke Token
                </Button>
              )}
            </div>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TokenDetailsModal;