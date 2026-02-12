import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";
import PhotoCapture from "@/components/shipments/PhotoCapture";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface AcknowledgmentCaptureProps {
  onClose: () => void;
  onSubmit: (data: { photo: File | null; signature: string }) => void;
  requireFullProof?: boolean;
  isSubmitting?: boolean;
}

function AcknowledgmentCapture({
  onClose: _onClose,
  onSubmit,
  requireFullProof = true,
  isSubmitting = false
}: AcknowledgmentCaptureProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureData, setSignatureData] = useState<string>("");
  const hasPhoto = Boolean(photoFile);
  const hasSignature = Boolean(signatureData.trim());
  const canSubmit = requireFullProof ? hasPhoto && hasSignature : hasPhoto || hasSignature;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

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
          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Shipment Photo</label>
            <PhotoCapture
              onPhotoComplete={setPhotoFile}
              onRemove={() => setPhotoFile(null)}
            />
          </div>

          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Customer Signature</label>
            <SignatureCanvas onSignatureChange={setSignatureData} />
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto p-4">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
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
