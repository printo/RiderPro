import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import SignatureCanvas from "./SignatureCanvas";
import PhotoCapture from "@/components/shipments/PhotoCapture";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface AcknowledgmentCaptureProps {
  on_close: () => void;
  onSubmit: (data: { photo: File | null; signature: string }) => void;
  require_full_proof?: boolean;
  is_submitting?: boolean;
}

function AcknowledgmentCapture({
  on_close: _on_close,
  onSubmit,
  require_full_proof = true,
  is_submitting = false
}: AcknowledgmentCaptureProps) {
  const [photo_file, set_photo_file] = useState<File | null>(null);
  const [signature_data, set_signature_data] = useState<string>("");
  const has_photo = Boolean(photo_file);
  const has_signature = Boolean(signature_data.trim());
  const can_submit = require_full_proof ? has_photo && has_signature : has_photo || has_signature;

  const handle_submit = () => {
    if (!can_submit) {
      return;
    }

    onSubmit({
      photo: photo_file,
      signature: signature_data
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Capture Acknowledgment</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Shipment Photo</label>
            <PhotoCapture
              on_photo_complete={set_photo_file}
              on_remove={() => set_photo_file(null)}
            />
          </div>

          <div className="space-y-4">
            <label className="text-lg font-medium text-foreground">Customer Signature</label>
            <SignatureCanvas onSignatureChange={set_signature_data} />
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto p-4">
          <Button
            onClick={handle_submit}
            disabled={is_submitting || !can_submit}
            className="w-full h-12 text-lg font-medium"
            data-testid="button-save-acknowledgment"
          >
            <Save className="h-5 w-5 mr-2" />
            {is_submitting ? "Saving..." : "Save Acknowledgment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
export default withModalErrorBoundary(AcknowledgmentCapture, {
  componentName: 'AcknowledgmentCapture'
});
