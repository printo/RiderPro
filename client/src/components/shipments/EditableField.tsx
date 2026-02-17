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
  on_save: (new_value: string) => Promise<void> | void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  options?: Array<{ label: string; value: string }>; // For dropdown mode
  fetch_options?: () => Promise<Array<{ label: string; value: string }>>; // For async options
}

export default function EditableField({
  label,
  value,
  on_save,
  multiline = false,
  placeholder,
  className,
  disabled = false,
  icon,
  options,
  fetch_options
}: EditableFieldProps) {
  const [is_editing, set_is_editing] = useState(false);
  const [edit_value, set_edit_value] = useState(value);
  const [is_saving, set_is_saving] = useState(false);
  const [available_options, set_available_options] = useState<Array<{ label: string; value: string }>>(options || []);
  const [is_loading_options, set_is_loading_options] = useState(false);

  const is_dropdown = !!(options || fetch_options);

  const handle_start_edit = async () => {
    set_edit_value(value);
    set_is_editing(true);

    // Fetch options if needed
    if (fetch_options && available_options.length === 0) {
      set_is_loading_options(true);
      try {
        const fetched_options = await fetch_options();
        set_available_options(fetched_options);
      } catch (error) {
        console.error('Error fetching options:', error);
      } finally {
        set_is_loading_options(false);
      }
    }
  };

  const handle_cancel = () => {
    set_edit_value(value);
    set_is_editing(false);
  };

  const handle_save = async () => {
    if (edit_value === value) {
      set_is_editing(false);
      return;
    }

    set_is_saving(true);
    try {
      await on_save(edit_value);
      set_is_editing(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      set_is_saving(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-semibold">{label}</h4>
        </div>
        {!is_editing && !disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={handle_start_edit}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {is_editing ? (
        <div className="space-y-3 bg-blue-50/30 dark:bg-blue-950/20 rounded-lg p-4 border">
          {is_dropdown ? (
            <div className="space-y-2">
              {is_loading_options ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading options...
                </div>
              ) : (
                <Select
                  value={edit_value || undefined}
                  onValueChange={set_edit_value}
                  disabled={is_saving || is_loading_options}
                >
                  <SelectTrigger className="w-full h-11 bg-background">
                    <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {available_options.length > 0 ? (
                      available_options.map((option) => (
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
              value={edit_value}
              onChange={(e) => set_edit_value(e.target.value)}
              placeholder={placeholder}
              rows={4}
              disabled={is_saving}
              className="bg-background"
            />
          ) : (
            <Input
              value={edit_value}
              onChange={(e) => set_edit_value(e.target.value)}
              placeholder={placeholder}
              disabled={is_saving}
              className="bg-background"
            />
          )}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handle_save}
              disabled={is_saving || (is_dropdown && !edit_value)}
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {is_saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handle_cancel}
              disabled={is_saving}
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
