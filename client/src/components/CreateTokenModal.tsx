import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/ApiClient";
import { Copy, Eye, EyeOff, Key, Shield, AlertCircle, CheckCircle } from "lucide-react";

interface CreateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenCreated: (token: any) => void;
}

interface TokenFormData {
  name: string;
  description: string;
  permissions: 'read' | 'write' | 'admin';
  expirationOption: 'never' | '30days' | '90days' | '1year' | 'custom';
  customExpiration: string;
}

const CreateTokenModal: React.FC<CreateTokenModalProps> = ({
  isOpen,
  onClose,
  onTokenCreated
}) => {
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    description: '',
    permissions: 'read',
    expirationOption: '90days',
    customExpiration: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"&]/g, '');

    return sanitized;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Sanitize and validate name
    const sanitizedName = sanitizeInput(formData.name);
    if (!sanitizedName) {
      newErrors.name = 'Token name is required';
    } else if (sanitizedName.length < 3) {
      newErrors.name = 'Token name must be at least 3 characters long';
    } else if (sanitizedName.length > 50) {
      newErrors.name = 'Token name must be less than 50 characters long';
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitizedName)) {
      newErrors.name = 'Token name can only contain letters, numbers, spaces, hyphens, and underscores';
    }

    // Sanitize and validate description
    const sanitizedDescription = sanitizeInput(formData.description);
    if (sanitizedDescription.length > 200) {
      newErrors.description = 'Description must be less than 200 characters long';
    }

    // Validate permissions
    if (!['read', 'write', 'admin'].includes(formData.permissions)) {
      newErrors.permissions = 'Invalid permissions selected';
    }

    // Validate expiration
    if (formData.expirationOption === 'custom') {
      if (!formData.customExpiration) {
        newErrors.customExpiration = 'Custom expiration date is required';
      } else {
        const expiryDate = new Date(formData.customExpiration);
        const now = new Date();

        // Check if date is valid
        if (isNaN(expiryDate.getTime())) {
          newErrors.customExpiration = 'Invalid expiration date format';
        } else if (expiryDate <= now) {
          newErrors.customExpiration = 'Expiration date must be in the future';
        } else {
          // Check if date is not too far in the future (max 10 years)
          const maxDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
          if (expiryDate > maxDate) {
            newErrors.customExpiration = 'Expiration date cannot be more than 10 years in the future';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Mark field as touched
    setTouched(prev => ({ ...prev, [field]: true }));

    // Clear existing error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate specific field on blur
    const newErrors: Record<string, string> = {};

    if (field === 'name') {
      const sanitizedName = sanitizeInput(formData.name);
      if (!sanitizedName) {
        newErrors.name = 'Token name is required';
      } else if (sanitizedName.length < 3) {
        newErrors.name = 'Token name must be at least 3 characters long';
      } else if (sanitizedName.length > 50) {
        newErrors.name = 'Token name must be less than 50 characters long';
      } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitizedName)) {
        newErrors.name = 'Token name can only contain letters, numbers, spaces, hyphens, and underscores';
      }
    } else if (field === 'description') {
      const sanitizedDescription = sanitizeInput(formData.description);
      if (sanitizedDescription.length > 200) {
        newErrors.description = 'Description must be less than 200 characters long';
      }
    } else if (field === 'customExpiration' && formData.expirationOption === 'custom') {
      if (!formData.customExpiration) {
        newErrors.customExpiration = 'Custom expiration date is required';
      } else {
        const expiryDate = new Date(formData.customExpiration);
        const now = new Date();

        if (isNaN(expiryDate.getTime())) {
          newErrors.customExpiration = 'Invalid expiration date format';
        } else if (expiryDate <= now) {
          newErrors.customExpiration = 'Expiration date must be in the future';
        } else {
          const maxDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
          if (expiryDate > maxDate) {
            newErrors.customExpiration = 'Expiration date cannot be more than 10 years in the future';
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare sanitized data for submission
      const sanitizedData = {
        name: sanitizeInput(formData.name),
        description: sanitizeInput(formData.description),
        permissions: formData.permissions,
        expirationOption: formData.expirationOption,
        customExpiration: formData.customExpiration
      };

      const response = await apiClient.post('/api/admin/tokens', sanitizedData);

      if (response.ok) {
        const data = await response.json();
        setGeneratedToken(data.data.token);
        onTokenCreated(data.data.tokenData);

        toast({
          title: "Success",
          description: "API token created successfully",
        });
      } else {
        const errorData = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const resetTime = errorData.resetTime ? new Date(errorData.resetTime).toLocaleString() : 'later';
          toast({
            title: "Rate Limit Exceeded",
            description: `Too many token creation attempts. Please try again ${resetTime === 'later' ? resetTime : 'at ' + resetTime}.`,
            variant: "destructive"
          });
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          // Handle validation errors
          const validationErrors: Record<string, string> = {};
          errorData.errors.forEach((error: any) => {
            if (error.field && error.message) {
              validationErrors[error.field] = error.message;
            }
          });
          setErrors(validationErrors);

          toast({
            title: "Validation Error",
            description: "Please check the form for errors",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: errorData.message || "Failed to create API token",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create API token: " + (error.message || 'Unknown error'),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async () => {
    if (generatedToken) {
      try {
        await navigator.clipboard.writeText(generatedToken);
        setCopied(true);
        toast({
          title: "Copied",
          description: "Token copied to clipboard",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to copy token to clipboard",
          variant: "destructive"
        });
      }
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      permissions: 'read',
      expirationOption: '90days',
      customExpiration: ''
    });
    setGeneratedToken(null);
    setShowToken(false);
    setCopied(false);
    setErrors({});
    setTouched({});
    onClose();
  };

  const getPermissionDescription = (permission: string) => {
    switch (permission) {
      case 'read':
        return 'Can only read data (GET requests)';
      case 'write':
        return 'Can read and modify data (GET, POST, PATCH requests)';
      case 'admin':
        return 'Full access including delete operations (all HTTP methods)';
      default:
        return '';
    }
  };

  const getExpirationDescription = (option: string) => {
    switch (option) {
      case 'never':
        return 'Token will never expire (not recommended for production)';
      case '30days':
        return 'Token will expire in 30 days';
      case '90days':
        return 'Token will expire in 90 days (recommended)';
      case '1year':
        return 'Token will expire in 1 year';
      case 'custom':
        return 'Set a custom expiration date';
      default:
        return '';
    }
  };

  if (generatedToken) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Token Created Successfully
            </DialogTitle>
            <DialogDescription>
              Your new API token has been generated. Copy and store it securely as it won't be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Important Security Notice</p>
                  <p className="text-yellow-700 mt-1">
                    This is the only time you'll see this token. Copy it now and store it securely.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Your API Token</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={generatedToken}
                    readOnly
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToken}
                  className={copied ? 'bg-green-50 border-green-200' : ''}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Token Details</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permissions:</span>
                  <Badge variant={formData.permissions === 'admin' ? 'destructive' : 'default'}>
                    {formData.permissions}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span>
                    {formData.expirationOption === 'never'
                      ? 'Never'
                      : formData.expirationOption === 'custom'
                        ? new Date(formData.customExpiration).toLocaleDateString()
                        : formData.expirationOption.replace('days', ' days').replace('year', ' year')
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">Usage Example</p>
                <code className="text-blue-700 text-xs block bg-blue-100 p-2 rounded">
                  curl -H "Authorization: Bearer {generatedToken.substring(0, 20)}..." \\<br />
                  &nbsp;&nbsp;https://your-api.com/api/shipments
                </code>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Create API Token
          </DialogTitle>
          <DialogDescription>
            Create a new API token for external integrations and automated access to your account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Token Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              placeholder="e.g., Mobile App Integration"
              className={errors.name ? 'border-red-500' : ''}
              maxLength={50}
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              onBlur={() => handleFieldBlur('description')}
              placeholder="Optional description of what this token is used for"
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
              maxLength={200}
            />
            {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="permissions">Permissions *</Label>
            <Select
              value={formData.permissions}
              onValueChange={(value: 'read' | 'write' | 'admin') =>
                setFormData(prev => ({ ...prev, permissions: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>Read Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="write">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    <span>Read & Write</span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Admin (Full Access)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getPermissionDescription(formData.permissions)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration">Expiration *</Label>
            <Select
              value={formData.expirationOption}
              onValueChange={(value: any) =>
                setFormData(prev => ({ ...prev, expirationOption: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30days">30 Days</SelectItem>
                <SelectItem value="90days">90 Days (Recommended)</SelectItem>
                <SelectItem value="1year">1 Year</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
                <SelectItem value="never">Never Expires</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getExpirationDescription(formData.expirationOption)}
            </p>
          </div>

          {formData.expirationOption === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customExpiration">Custom Expiration Date *</Label>
              <Input
                id="customExpiration"
                type="datetime-local"
                value={formData.customExpiration}
                onChange={(e) => handleFieldChange('customExpiration', e.target.value)}
                onBlur={() => handleFieldBlur('customExpiration')}
                className={errors.customExpiration ? 'border-red-500' : ''}
                min={new Date().toISOString().slice(0, 16)}
              />
              {errors.customExpiration && <p className="text-sm text-red-600">{errors.customExpiration}</p>}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Token'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTokenModal;