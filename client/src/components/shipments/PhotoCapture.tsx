import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  on_photo_complete: (photo_file: File) => void;
  on_remove?: () => void;
  className?: string;
}

export default function PhotoCapture({
  on_photo_complete,
  on_remove,
  className
}: PhotoCaptureProps) {
  const file_input_ref = useRef<HTMLInputElement>(null);
  const [photo_preview, set_photo_preview] = useState<string | null>(null);
  const [_photo_file, set_photo_file] = useState<File | null>(null);

  const handle_capture = () => {
    file_input_ref.current?.click();
  };

  const handle_photo_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      set_photo_file(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        set_photo_preview(reader.result as string);
      };
      reader.readAsDataURL(file);
      on_photo_complete(file);
    }
  };

  const handle_remove = () => {
    set_photo_file(null);
    set_photo_preview(null);
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
    if (on_remove) on_remove();
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!photo_preview ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Camera className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Take a photo of the delivered package
          </p>
          <Button
            onClick={handle_capture}
            variant="outline"
            className="w-full"
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture Photo
          </Button>
          <input
            ref={file_input_ref}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handle_photo_change}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border rounded-lg p-2 bg-white">
          <img
            src={photo_preview}
            alt="Proof of delivery"
            className="w-full h-48 object-contain rounded bg-gray-50"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Photo captured
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handle_remove}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
