import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
const signaturesDir = path.join(uploadsDir, 'signatures');
const photosDir = path.join(uploadsDir, 'photos');

[uploadsDir, signaturesDir, photosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File filter for images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Process the image before saving
export async function processImage(file: Express.Multer.File, type: 'signature' | 'photo'): Promise<string> {
  const extension = path.extname(file.originalname) || '.jpg';
  const filename = `${randomUUID()}${extension}`;
  const outputPath = path.join(type === 'signature' ? signaturesDir : photosDir, filename);

  if (type === 'photo') {
    // Get image metadata
    const metadata = await sharp(file.buffer).metadata();

    // Calculate resize dimensions while maintaining aspect ratio
    let width = metadata.width || 0;
    let height = metadata.height || 0;

    // More aggressive scaling - limit to 1200px for preview purposes
    const maxDimension = 1200;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Initial compression with moderate settings
    await sharp(file.buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 75,  // More aggressive compression
        chromaSubsampling: '4:2:0'  // Standard chroma subsampling
      })
      .toFile(outputPath);

    // Check if the output file is still too large (> 3MB)
    const stats = await fs.promises.stat(outputPath);
    if (stats.size > 3 * 1024 * 1024) {
      // If still too large, apply more aggressive compression
      await sharp(file.buffer)
        .resize(Math.round(width * 0.8), Math.round(height * 0.8), {  // Further reduce dimensions
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 65,  // More aggressive compression
          chromaSubsampling: '4:2:0'
        })
        .toFile(outputPath);
    }
  } else {
    // For signatures: optimize for clarity while maintaining small size
    await sharp(file.buffer)
      .resize(1000, 400, {  // Slightly larger dimensions for better quality
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({
        compressionLevel: 6,  // Balanced compression
        quality: 90
      })
      .toFile(outputPath);
  }

  return filename;
}

// Configure multer to store files in memory for processing
const memoryStorage = multer.memoryStorage();

export const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for raw files (will be compressed to max 3MB)
  },
});

// Helper function to get file URL
export function getFileUrl(filename: string, type: 'signature' | 'photo'): string {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${type}s/${filename}`;
}

// Helper function to convert base64 to file
export async function saveBase64File(base64Data: string, type: 'signature' | 'photo'): Promise<string> {
  const matches = base64Data.match(new RegExp('^data:([A-Za-z-+/]+);base64,(.+)$'));
  if (!matches) {
    throw new Error('Invalid base64 data');
  }

  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, 'base64');
  const filename = `${randomUUID()}.${type === 'signature' ? 'png' : 'jpg'}`;
  const outputPath = path.join(type === 'signature' ? signaturesDir : photosDir, filename);

  if (type === 'photo') {
    await sharp(buffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 75,
        chromaSubsampling: '4:2:0'
      })
      .toFile(outputPath);
  } else {
    await sharp(buffer)
      .resize(600, 200, {  // Smaller signature size
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({
        compressionLevel: 9,
        quality: 75
      })
      .toFile(outputPath);
  }

  return filename;
}
