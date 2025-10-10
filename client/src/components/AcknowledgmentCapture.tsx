import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Save } from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";
import { cn } from "@/lib/utils";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface AcknowledgmentCaptureProps {
  onClose: () => void;
  onSubmit: (data: { photo: File | null; signature: string }) => void;
  isSubmitting?: boolean;
}

function AcknowledgmentCapture({
  onClose,
  onSubmit,
  isSubmitting = false
}: AcknowledgmentCaptureProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [signatureData, setSignatureData] = useState<string>("");

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      photo: photoFile,
      signature: signatureData
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Capture Acknowledgment</h2>
          {/* <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button> */}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          {/* Photo Capture */}
          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Delivery Photo</label>
            <div
              className={cn(
                "border-2 border-dashed border-border rounded-lg p-6",
                "text-center transition-colors",
                "hover:bg-muted/50 cursor-pointer"
              )}
              onClick={() => document.getElementById('photo-input')?.click()}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Delivery photo preview"
                  className="mx-auto mb-4 rounded-lg w-full max-w-md h-48 object-cover"
                  data-testid="img-photo-preview"
                />
              ) : (
                <div className="mb-4">
                  <img
                    src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"
                    alt="Delivery rider taking photo for package confirmation"
                    className="mx-auto rounded-lg w-full max-w-md h-48 object-cover opacity-50"
                  />
                </div>
              )}
              <p className="text-muted-foreground mb-4">
                {photoPreview ? "Tap to change photo" : "Tap to capture delivery photo"}
              </p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id="photo-input"
                onChange={handlePhotoCapture}
                data-testid="input-photo"
              />
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full max-w-[200px]"
                data-testid="button-capture-photo"
              >
                📷 {photoPreview ? "Change Photo" : "Capture Photo"}
              </Button>
            </div>
          </div>

          {/* Signature Capture */}
          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Customer Signature</label>
            <div className="bg-white rounded-lg border border-border p-4">
              <SignatureCanvas
                onSignatureChange={setSignatureData}
                data-testid="canvas-signature"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto p-4">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (!photoFile && !signatureData)}
            className="w-full h-12 text-lg font-medium"
            data-testid="button-save-acknowledgment"
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Saving..." : "Save Acknowledgment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
export default withModalErrorBoundary(AcknowledgmentCapture, {
  componentName: 'AcknowledgmentCapture'
});