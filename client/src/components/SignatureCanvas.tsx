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
  
  // Use refs for drawing state to ensure immediate updates in event handlers
  const drawing_state = useRef({
    is_drawing: false,
    has_signature: false
  });

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: no alpha
    if (!ctx) return;

    // Set canvas size for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Set drawing styles
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3; // Slightly thicker for better visibility
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const getCoordinates = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const { x, y } = getCoordinates(e);
      
      drawing_state.current.is_drawing = true;
      set_is_drawing(true);
      
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!drawing_state.current.is_drawing) return;
      e.preventDefault();
      const { x, y } = getCoordinates(e);
      
      ctx.lineTo(x, y);
      ctx.stroke();
      
      if (!drawing_state.current.has_signature) {
        drawing_state.current.has_signature = true;
        set_has_signature(true);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      drawing_state.current.is_drawing = false;
      set_is_drawing(false);
      
      if (drawing_state.current.has_signature) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    };

    // Register non-passive event listeners for better mobile performance
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSignatureChange]);

  const start_drawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    drawing_state.current.is_drawing = true;
    set_is_drawing(true);
    
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing_state.current.is_drawing) return;

    const canvas = canvas_ref.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (!drawing_state.current.has_signature) {
      drawing_state.current.has_signature = true;
      set_has_signature(true);
    }
  };

  const stop_drawing = () => {
    if (!drawing_state.current.is_drawing) return;
    drawing_state.current.is_drawing = false;
    set_is_drawing(false);

    const canvas = canvas_ref.current;
    if (canvas && drawing_state.current.has_signature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange(dataUrl);
    }
  };

  const clear_signature = () => {
    const canvas = canvas_ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    drawing_state.current.has_signature = false;
    set_has_signature(false);
    onSignatureChange('');
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/20">
      <canvas
        ref={canvas_ref}
        className="w-full h-48 bg-white rounded border border-border cursor-crosshair touch-none"
        onMouseDown={start_drawing}
        onMouseMove={draw}
        onMouseUp={stop_drawing}
        onMouseLeave={stop_drawing}
        data-testid="canvas-signature"
      />
      <div className="flex justify-between items-center mt-2">
        <p className="text-sm text-muted-foreground">Draw customer signature above</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear_signature}
          disabled={!has_signature}
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