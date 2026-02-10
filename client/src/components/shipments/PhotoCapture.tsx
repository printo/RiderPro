import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  onPhotoComplete: (photoFile: File) => void;
  onRemove?: () => void;
  className?: string;
}

export default function PhotoCapture({
  onPhotoComplete,
  onRemove,
  className
}: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      onPhotoComplete(file);
    }
  };

  const handleRemove = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onRemove) onRemove();
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!photoPreview ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Camera className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            Take a photo of the delivered package
          </p>
          <Button
            onClick={handleCapture}
            variant="outline"
            className="w-full"
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border rounded-lg p-2 bg-white">
          <img
            src={photoPreview}
            alt="Proof of delivery"
            className="w-full h-48 object-cover rounded"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Photo captured
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
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

