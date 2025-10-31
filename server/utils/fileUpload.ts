import multer from 'multer';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Storage client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials not found. File uploads will fail. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Supabase Storage bucket names
const SIGNATURE_BUCKET = 'signature';
const PHOTOS_BUCKET = 'photos';

// Multer configuration - store in memory for processing
const memoryStorage = multer.memoryStorage();

// File filter for images
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Configure multer
export const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Sanitize shipment ID for use in filenames
function sanitizeShipmentId(shipmentId?: string): string {
  if (!shipmentId) return '';
  // Remove invalid filename characters: / \ : ? * " < > |
  // Replace spaces and dots with hyphens for cleaner filenames
  return shipmentId
    .replace(/[\/\\:\?\*"<>\|]/g, '') // Remove invalid chars
    .replace(/[\s\.]+/g, '-') // Replace spaces and dots with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Process image and upload to Supabase Storage
// shipmentId: Optional shipment ID to include in filename for traceability
async function processAndUploadImage(buffer: Buffer, type: 'signature' | 'photo', originalExtension: string, shipmentId?: string): Promise<string> {
  let processedBuffer: Buffer;
  let contentType: string;

  if (type === 'photo') {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Calculate resize dimensions while maintaining aspect ratio
    let width = metadata.width || 0;
    let height = metadata.height || 0;
    
    const maxDimension = 1200;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Compress and resize photo
    processedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 75,
        chromaSubsampling: '4:2:0'
      })
      .toBuffer();

    // If still too large, compress more aggressively
    if (processedBuffer.length > 3 * 1024 * 1024) {
      processedBuffer = await sharp(buffer)
        .resize(Math.round(width * 0.8), Math.round(height * 0.8), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 65,
          chromaSubsampling: '4:2:0'
        })
        .toBuffer();
    }

    contentType = 'image/jpeg';
  } else {
    // Process signature image
    processedBuffer = await sharp(buffer)
      .resize(1000, 400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ 
        compressionLevel: 6,
        quality: 90
      })
      .toBuffer();

    contentType = 'image/png';
  }

  // Generate unique filename for Supabase Storage
  // Normalize extension (ensure it starts with a dot)
  const ext = originalExtension 
    ? originalExtension.startsWith('.') ? originalExtension : `.${originalExtension}`
    : (type === 'signature' ? '.png' : '.jpg');
  
  // Include shipment ID in filename for traceability: {shipmentId}-{uuid}.png
  const uuid = randomUUID();
  const sanitizedId = sanitizeShipmentId(shipmentId);
  const filename = sanitizedId 
    ? `${sanitizedId}-${uuid}${ext}`
    : `${uuid}${ext}`;

  // Upload to Supabase Storage
  const bucket = type === 'signature' ? SIGNATURE_BUCKET : PHOTOS_BUCKET;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, processedBuffer, {
      contentType,
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`Failed to upload ${type} to Supabase Storage: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

// Helper function to get file URL from Supabase Storage
export function getFileUrl(filename: string, type: 'signature' | 'photo'): string {
  // If filename is already a full URL, return it
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  
  // Otherwise, construct Supabase public URL
  const bucket = type === 'signature' ? SIGNATURE_BUCKET : PHOTOS_BUCKET;
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);
  
  return data.publicUrl;
}

// Helper function to convert base64 to blob and upload
// shipmentId: Optional shipment ID to include in filename for traceability
export async function saveBase64File(base64Data: string, type: 'signature' | 'photo', shipmentId?: string): Promise<string> {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data');
  }

  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, 'base64');

  let processedBuffer: Buffer;
  let contentType: string;

  if (type === 'photo') {
    // Get image metadata to maintain aspect ratio
    const metadata = await sharp(buffer).metadata();
    
    // Calculate resize dimensions while maintaining aspect ratio (consistent with processAndUploadImage)
    let width = metadata.width || 0;
    let height = metadata.height || 0;
    
    const maxDimension = 1200;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    processedBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 75,
        chromaSubsampling: '4:2:0'
      })
      .toBuffer();

    // If still too large, compress more aggressively (consistent with processAndUploadImage)
    if (processedBuffer.length > 3 * 1024 * 1024) {
      processedBuffer = await sharp(buffer)
        .resize(Math.round(width * 0.8), Math.round(height * 0.8), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 65,
          chromaSubsampling: '4:2:0'
        })
        .toBuffer();
    }

    contentType = 'image/jpeg';
  } else {
    // Process signature image (consistent with processAndUploadImage: 1000x400)
    processedBuffer = await sharp(buffer)
      .resize(1000, 400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ 
        compressionLevel: 6,
        quality: 90
      })
      .toBuffer();

    contentType = 'image/png';
  }

  // Generate unique filename for Supabase Storage
  // Include shipment ID in filename for traceability: {shipmentId}-{uuid}.jpg
  const uuid = randomUUID();
  const sanitizedId = sanitizeShipmentId(shipmentId);
  const ext = type === 'signature' ? 'png' : 'jpg';
  const filename = sanitizedId 
    ? `${sanitizedId}-${uuid}.${ext}`
    : `${uuid}.${ext}`;

  // Upload to Supabase Storage
  const bucket = type === 'signature' ? SIGNATURE_BUCKET : PHOTOS_BUCKET;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, processedBuffer, {
      contentType,
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`Failed to upload ${type} to Supabase Storage: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

// Export the process function for use in route handlers
export { processAndUploadImage };
