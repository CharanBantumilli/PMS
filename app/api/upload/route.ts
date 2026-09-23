import { NextRequest } from 'next/server';
import { apiContext, hasRole, jsonError, jsonOk } from '@/lib/api';
import crypto from 'crypto';

// Upload file to S3/R2 using presigned URL, or store locally if no S3 configured
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (!ctx?.organizationId) return jsonError('Unauthorized', 401);
  if (!hasRole(ctx, ['OWNER','ADMIN','MANAGER','RECEPTIONIST'])) return jsonError('Forbidden', 403);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const rawFolder = (formData.get('folder') as string) || 'uploads';
  const folder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  if (!file) return jsonError('No file provided', 400);

  // Check file size (10MB max)
  if (file.size > 10 * 1024 * 1024) return jsonError('File too large (max 10MB)', 400);

  // Check allowed types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) return jsonError('File type not allowed (JPEG, PNG, WebP, PDF only)', 400);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Generate unique filename
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  let ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  if (!allowedExts.includes(ext)) ext = 'bin';
  const key = `${ctx.organizationId}/${folder}/${crypto.randomUUID()}.${ext}`;

  // Check for S3/R2 config in environment
  const s3Bucket = process.env.S3_BUCKET;
  const s3Region = process.env.S3_REGION || 'auto';
  const s3AccessKey = process.env.S3_ACCESS_KEY;
  const s3SecretKey = process.env.S3_SECRET_KEY;
  const s3Endpoint = process.env.S3_ENDPOINT; // For R2

  if (s3Bucket && s3AccessKey && s3SecretKey) {
    // Upload to S3/R2
    try {
      let s3Client: any = null;
      let PutObjectCommand: any = null;
      try {
        const s3mod = await import('@aws-sdk/client-s3');
        s3Client = s3mod.S3Client;
        PutObjectCommand = s3mod.PutObjectCommand;
      } catch { return jsonError('AWS SDK not installed', 500); }

      const client = new s3Client({
        region: s3Region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      });

      await client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        Metadata: { organizationId: ctx.organizationId, uploadedBy: ctx.userId || '' },
      }));

      const url = s3Endpoint
        ? `${s3Endpoint}/${s3Bucket}/${key}`
        : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;

      return jsonOk({ url, key, storage: 's3' });
    } catch (e: any) {
      return jsonError('File upload failed', 500);
    }
  }

  // Fallback: store locally (dev mode)
  const fs = await import('fs/promises');
  const path = await import('path');
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', ctx.organizationId);
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${folder}_${crypto.randomUUID()}.${ext}`;
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);

  const url = `/uploads/${ctx.organizationId}/${filename}`;
  return jsonOk({ url, key: filename, storage: 'local' });
}
