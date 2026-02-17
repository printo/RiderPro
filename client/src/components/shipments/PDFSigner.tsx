import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';
import PhotoCapture from './PhotoCapture';
import CardSection from './CardSection';

interface PDFSignerProps {
  pdf_url: string;
  on_signature_complete: (signature_data: string) => void;
  on_photo_complete: (photo_file: File) => void;
  on_signed_pdf_upload: (signed_pdf_url: string) => void;
  signature_required?: 'mandatory' | 'optional' | 'either';
  photo_required?: 'mandatory' | 'optional' | 'either';
  require_pdf?: boolean;
}

export default function PDFSigner({
  pdf_url,
  on_signature_complete,
  on_photo_complete,
  on_signed_pdf_upload: _on_signed_pdf_upload,
  signature_required = 'optional',
  photo_required = 'optional',
  require_pdf: _require_pdf = false
}: PDFSignerProps) {
  const [signature, set_signature] = useState<string | null>(null);
  const [photo, set_photo] = useState<File | null>(null);

  const get_requirement_text = (requirement: string) => {
    switch (requirement) {
      case 'mandatory':
        return 'Required';
      case 'either':
        return 'Either signature or photo required';
      default:
        return 'Optional';
    }
  };

  const is_signature_mandatory = signature_required === 'mandatory' || (signature_required === 'either' && !photo);
  const is_photo_mandatory = photo_required === 'mandatory' || (photo_required === 'either' && !signature);

  const handle_signature_complete = (signature_data: string) => {
    set_signature(signature_data);
    on_signature_complete(signature_data);
  };

  const handle_photo_complete = (photo_file: File) => {
    set_photo(photo_file);
    on_photo_complete(photo_file);
  };

  return (
    <div className="space-y-6">
      {/* PDF Display */}
      {pdf_url && (
        <CardSection
          title="Delivery Document"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        >
          <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <iframe
              src={pdf_url}
              className="w-full h-96"
              title="PDF Document"
              onError={() => {
                // Error handling for iframe
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3 px-1">
            Hand this device to the recipient to sign the document below
          </p>
        </CardSection>
      )}

      {/* Requirements Info */}
      <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm">
          <strong className="text-blue-900 dark:text-blue-100">Requirements:</strong>{' '}
          <span className="text-blue-800 dark:text-blue-200">
            Signature: <strong>{get_requirement_text(signature_required)}</strong>,
            Photo: <strong>{get_requirement_text(photo_required)}</strong>
          </span>
        </AlertDescription>
      </Alert>

      {/* Signature Section */}
      <CardSection
        title={
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 text-purple-600">✍</span>
            <span>Signature {is_signature_mandatory && <span className="text-red-600 font-bold">*</span>}</span>
          </div>
        }
      >
        <SignatureCanvas
          onSignatureChange={(signature_data) => {
            const normalized_signature = signature_data?.trim() || '';
            if (!normalized_signature) {
              set_signature(null);
              return;
            }
            handle_signature_complete(normalized_signature);
          }}
        />
      </CardSection>

      {/* Photo Section */}
      <CardSection
        title={
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 text-green-600">📷</span>
            <span>Proof of Delivery Photo {is_photo_mandatory && <span className="text-red-600 font-bold">*</span>}</span>
          </div>
        }
      >
        <PhotoCapture
          on_photo_complete={handle_photo_complete}
          on_remove={() => set_photo(null)}
        />
      </CardSection>

      {/* Validation Status */}
      {(signature || photo) && (
        <Alert className={signature && photo ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'}>
          {signature && photo ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Complete!</strong> Both signature and photo captured. Ready to submit.
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                {is_signature_mandatory && !signature && 'Signature is required. '}
                {is_photo_mandatory && !photo && 'Photo is required. '}
                {signature_required === 'either' && photo_required === 'either' && !signature && !photo && 'Either signature or photo is required.'}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
