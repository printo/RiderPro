import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Save, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  options?: Array<{ label: string; value: string }>; // For dropdown mode
  fetchOptions?: () => Promise<Array<{ label: string; value: string }>>; // For async options
}

export default function EditableField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  className,
  disabled = false,
  icon,
  options,
  fetchOptions
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<Array<{ label: string; value: string }>>(options || []);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const isDropdown = !!(options || fetchOptions);

  const handleStartEdit = async () => {
    setEditValue(value);
    setIsEditing(true);
    
    // Fetch options if needed
    if (fetchOptions && availableOptions.length === 0) {
      setIsLoadingOptions(true);
      try {
        const fetchedOptions = await fetchOptions();
        setAvailableOptions(fetchedOptions);
      } catch (error) {
        console.error('Error fetching options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold">{label}</h4>
        </div>
        {!isEditing && !disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartEdit}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3 bg-blue-50/30 dark:bg-blue-950/20 rounded-lg p-4 border">
          {isDropdown ? (
            <div className="space-y-2">
              {isLoadingOptions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading options...
                </div>
              ) : (
                <Select
                  value={editValue || undefined}
                  onValueChange={setEditValue}
                  disabled={isSaving || isLoadingOptions}
                >
                  <SelectTrigger className="w-full h-11 bg-background">
                    <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.length > 0 ? (
                      availableOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No options available</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              rows={4}
              disabled={isSaving}
              className="bg-background"
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              disabled={isSaving}
              className="bg-background"
            />
          )}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || (isDropdown && !editValue)}
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              size="sm"
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border">
          <p className="text-sm font-medium text-foreground">
            {value || <span className="text-muted-foreground italic">No {label.toLowerCase()}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

