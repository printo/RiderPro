import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PenTool, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignatureCanvasProps {
  onSignatureComplete: (signatureData: string) => void;
  onClear?: () => void;
  className?: string;
  width?: number;
  height?: number;
}

export default function SignatureCanvas({
  onSignatureComplete,
  onClear,
  className,
  width = 600,
  height = 200
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSigning || !canvasRef.current) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);
    const signatureData = canvasRef.current.toDataURL('image/png');
    setHasSignature(true);
    setIsSigning(false);
    onSignatureComplete(signatureData);
  };

  const handleStartSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    setIsSigning(true);
    setHasSignature(false);
  };

  const handleClear = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
    setIsSigning(false);
    if (onClear) onClear();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={cn(
            "w-full border rounded cursor-crosshair",
            isSigning && "border-blue-500"
          )}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {isSigning ? 'Sign above' : hasSignature ? 'Signature captured' : 'Click and drag to sign'}
        </p>
      </div>

      <div className="flex gap-2">
        {!hasSignature && !isSigning && (
          <Button
            onClick={handleStartSignature}
            variant="outline"
            className="flex-1"
          >
            <PenTool className="h-4 w-4 mr-2" />
            Start Signature
          </Button>
        )}
        {hasSignature && (
          <>
            <div className="flex items-center gap-2 text-green-600 text-sm flex-1">
              <CheckCircle className="h-4 w-4" />
              Signature captured
            </div>
            <Button
              variant="outline"
              onClick={handleClear}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

