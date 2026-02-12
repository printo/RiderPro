import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';
import PhotoCapture from './PhotoCapture';
import CardSection from './CardSection';

interface PDFSignerProps {
  pdfUrl: string;
  onSignatureComplete: (signatureData: string) => void;
  onPhotoComplete: (photoFile: File) => void;
  onSignedPdfUpload: (signedPdfUrl: string) => void;
  signatureRequired?: 'mandatory' | 'optional' | 'either';
  photoRequired?: 'mandatory' | 'optional' | 'either';
  requirePdf?: boolean;
}

export default function PDFSigner({
  pdfUrl,
  onSignatureComplete,
  onPhotoComplete,
  onSignedPdfUpload: _onSignedPdfUpload,
  signatureRequired = 'optional',
  photoRequired = 'optional',
  requirePdf: _requirePdf = false
}: PDFSignerProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const getRequirementText = (requirement: string) => {
    switch (requirement) {
      case 'mandatory':
        return 'Required';
      case 'either':
        return 'Either signature or photo required';
      default:
        return 'Optional';
    }
  };

  const isSignatureMandatory = signatureRequired === 'mandatory' || (signatureRequired === 'either' && !photo);
  const isPhotoMandatory = photoRequired === 'mandatory' || (photoRequired === 'either' && !signature);

  const handleSignatureComplete = (signatureData: string) => {
    setSignature(signatureData);
    onSignatureComplete(signatureData);
  };

  const handlePhotoComplete = (photoFile: File) => {
    setPhoto(photoFile);
    onPhotoComplete(photoFile);
  };

  return (
    <div className="space-y-6">
      {/* PDF Display */}
      {pdfUrl && (
        <CardSection
          title="Delivery Document"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        >
          <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <iframe
              src={pdfUrl}
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
            Signature: <strong>{getRequirementText(signatureRequired)}</strong>, 
            Photo: <strong>{getRequirementText(photoRequired)}</strong>
          </span>
        </AlertDescription>
      </Alert>

      {/* Signature Section */}
      <CardSection
        title={
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 text-purple-600">✍</span>
            <span>Signature {isSignatureMandatory && <span className="text-red-600 font-bold">*</span>}</span>
          </div>
        }
      >
        <SignatureCanvas
          onSignatureChange={(signatureData) => {
            const normalizedSignature = signatureData?.trim() || '';
            if (!normalizedSignature) {
              setSignature(null);
              return;
            }
            handleSignatureComplete(normalizedSignature);
          }}
        />
      </CardSection>

      {/* Photo Section */}
      <CardSection
        title={
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 text-green-600">📷</span>
            <span>Proof of Delivery Photo {isPhotoMandatory && <span className="text-red-600 font-bold">*</span>}</span>
          </div>
        }
      >
        <PhotoCapture
          onPhotoComplete={handlePhotoComplete}
          onRemove={() => setPhoto(null)}
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
                {isSignatureMandatory && !signature && 'Signature is required. '}
                {isPhotoMandatory && !photo && 'Photo is required. '}
                {signatureRequired === 'either' && photoRequired === 'either' && !signature && !photo && 'Either signature or photo is required.'}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}
    </div>
  );
}
