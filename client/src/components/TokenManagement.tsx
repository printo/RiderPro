import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Plus,
  Eye,
  MoreVertical,
  Shield,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import authService from "@/services/AuthService";
import CreateTokenModal from "./CreateTokenModal";
import TokenDetailsModal from "./TokenDetailsModal";

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

interface TokenManagementProps {
  canEdit: boolean;
}

const TokenManagement: React.FC<TokenManagementProps> = ({ canEdit }) => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await authService.fetchWithAuth('/api/admin/tokens');

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data || []);
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to load API tokens",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load API tokens: " + (error.message || 'Unknown error'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTokenCreated = (newToken: ApiToken) => {
    setTokens(prev => [newToken, ...prev]);
    setShowCreateModal(false);
  };

  const handleStatusChange = async (tokenId: number, newStatus: 'active' | 'disabled' | 'revoked') => {
    try {
      const response = await authService.fetchWithAuth(`/api/admin/tokens/${tokenId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setTokens(prev => prev.map(token =>
          token.id === tokenId ? { ...token, status: newStatus } : token
        ));

        toast({
          title: "Success",
          description: `Token ${newStatus} successfully`,
        });
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
    }
  };

  const handleViewDetails = (token: ApiToken) => {
    setSelectedToken(token);
    setShowDetailsModal(true);
  };

  const handleCleanupExpired = async () => {
    try {
      const response = await authService.fetchWithAuth('/api/admin/tokens/cleanup', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Cleanup Complete",
          description: data.message,
        });
        // Reload tokens to reflect changes
        loadTokens();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to cleanup expired tokens",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to cleanup expired tokens: " + (error.message || 'Unknown error'),
        variant: "destructive"
      });
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

  const getExpirationStatus = (expiresAt?: string) => {
    if (!expiresAt) {
      return { status: 'never_expires', daysUntilExpiration: null, message: 'Never expires' };
    }

    const now = new Date();
    const expirationDate = new Date(expiresAt);
    const timeDiff = expirationDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysUntilExpiration < 0) {
      return {
        status: 'expired',
        daysUntilExpiration: Math.abs(daysUntilExpiration),
        message: `Expired ${Math.abs(daysUntilExpiration)} day(s) ago`
      };
    } else if (daysUntilExpiration <= 7) {
      return {
        status: 'expiring_soon',
        daysUntilExpiration,
        message: daysUntilExpiration === 0
          ? 'Expires today'
          : `Expires in ${daysUntilExpiration} day(s)`
      };
    } else {
      return {
        status: 'active',
        daysUntilExpiration,
        message: `Expires in ${daysUntilExpiration} day(s)`
      };
    }
  };

  const getExpirationBadge = (expiresAt?: string) => {
    const expiration = getExpirationStatus(expiresAt);

    switch (expiration.status) {
      case 'expired':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'expiring_soon':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertTriangle className="w-3 h-3 mr-1" />Expiring Soon</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><Clock className="w-3 h-3 mr-1" />Active</Badge>;
      case 'never_expires':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" />Never Expires</Badge>;
      default:
        return null;
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

  const isExpiringSoon = (expiresAt?: string) => {
    const expiration = getExpirationStatus(expiresAt);
    return expiration.status === 'expiring_soon';
  };

  const isExpired = (expiresAt?: string) => {
    const expiration = getExpirationStatus(expiresAt);
    return expiration.status === 'expired';
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Token Management
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading tokens...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Token Management
            </h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCleanupExpired}
                disabled={!canEdit}
                variant="outline"
                size="sm"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Cleanup Expired
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!canEdit}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Manage API tokens for programmatic access to the system.
          </p>

          {tokens.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No API tokens</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first API token to enable programmatic access.
              </p>
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!canEdit}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{token.name}</h3>
                      {getStatusBadge(token.status)}
                      {getPermissionBadge(token.permissions)}
                      {getExpirationBadge(token.expiresAt)}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      {token.description && <p>{token.description}</p>}
                      <div className="flex items-center gap-4">
                        <span>Token: {token.prefix}...</span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {token.requestCount} requests
                        </span>
                        {token.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last used: {formatDate(token.lastUsedAt)}
                          </span>
                        )}
                        {token.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getExpirationStatus(token.expiresAt).message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(token)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>

                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {token.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(token.id, 'disabled')}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Disable
                            </DropdownMenuItem>
                          )}
                          {token.status === 'disabled' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(token.id, 'active')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Enable
                            </DropdownMenuItem>
                          )}
                          {token.status !== 'revoked' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(token.id, 'revoked')}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Revoke
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canEdit && (
            <p className="text-xs text-muted-foreground mt-4">
              Admin access required to manage tokens
            </p>
          )}
        </CardContent>
      </Card>

      <CreateTokenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTokenCreated={handleTokenCreated}
      />

      <TokenDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        token={selectedToken}
        onTokenUpdated={loadTokens}
      />
    </>
  );
};

export default TokenManagement;