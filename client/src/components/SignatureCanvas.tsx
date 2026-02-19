import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

interface SignatureCanvasProps {
  onSignatureChange: (signature: string) => void;
}

function SignatureCanvas({ onSignatureChange }: SignatureCanvasProps) {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [is_drawing, set_is_drawing] = useState(false);
  const [has_signature, set_has_signature] = useState(false);
  
  // Refs to track current state values for touch handlers
  const is_drawing_ref = useRef(is_drawing);
  const has_signature_ref = useRef(has_signature);
  
  // Update refs when state changes
  useEffect(() => {
    is_drawing_ref.current = is_drawing;
  }, [is_drawing]);
  
  useEffect(() => {
    has_signature_ref.current = has_signature;
  }, [has_signature]);

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // Set drawing styles
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add non-passive touch event listeners to prevent default browser behavior
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      set_is_drawing(true);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!is_drawing_ref.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      ctx.lineTo(x, y);
      ctx.stroke();
      set_has_signature(true);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      set_is_drawing(false);
      
      if (has_signature_ref.current) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    };

    // Register non-passive event listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Cleanup function
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSignatureChange]);

  const start_drawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    set_is_drawing(true);
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x, y;
    if ('touches' in event) {
      // Touch events are now handled by non-passive listeners
      return;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!is_drawing) return;

    const canvas = canvas_ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x, y;
    if ('touches' in event) {
      // Touch events are now handled by non-passive listeners
      return;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    set_has_signature(true);
  };

  const stop_drawing = () => {
    if (!is_drawing) return;
    set_is_drawing(false);

    // Convert to base64 and notify parent
    const canvas = canvas_ref.current;
    if (canvas && has_signature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clear_signature = () => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    set_has_signature(false);
    onSignatureChange('');
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/20">
      <canvas
        ref={canvas_ref}
        className="w-full h-32 bg-white rounded border border-border cursor-crosshair touch-none"
        onMouseDown={start_drawing}
        onMouseMove={draw}
        onMouseUp={stop_drawing}
        onMouseLeave={stop_drawing}
        onTouchStart={start_drawing}
        onTouchMove={draw}
        onTouchEnd={stop_drawing}
        data-testid="canvas-signature"
      />
      <div className="flex justify-between items-center mt-2">
        <p className="text-sm text-muted-foreground">Draw customer signature above</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear_signature}
          className="text-sm text-primary hover:text-primary/80"
          data-testid="button-clear-signature"
        >
          Clear Signature
        </Button>
      </div>
    </div>
  );
}
export default withComponentErrorBoundary(SignatureCanvas, {
  componentVariant: 'card',
  componentName: 'SignatureCanvas'
});