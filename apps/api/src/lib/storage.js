// Object storage client. Mirrors Zincro's apps/api/src/services/files
// shape (S3 SDK + presigned URLs), pointed at Railway's S3-compatible
// object storage.
//
// Provisioning (you do this once, in Railway):
//   1. + Create → Object Storage in the believable-creation project.
//   2. Railway exposes these env vars on the new bucket service:
//        BUCKET_NAME, BUCKET_ENDPOINT, BUCKET_ACCESS_KEY_ID,
//        BUCKET_SECRET_ACCESS_KEY, BUCKET_REGION (usually "auto" or "us-east-1")
//   3. On the Nexus API service, add reference variables:
//        S3_BUCKET={{BucketName.BUCKET_NAME}}
//        S3_ENDPOINT={{BucketName.BUCKET_ENDPOINT}}
//        S3_ACCESS_KEY_ID={{BucketName.BUCKET_ACCESS_KEY_ID}}
//        S3_SECRET_ACCESS_KEY={{BucketName.BUCKET_SECRET_ACCESS_KEY}}
//        S3_REGION={{BucketName.BUCKET_REGION}}
//
// Until the bucket is provisioned, this module degrades gracefully:
// `client` and `bucket` export as null, and helpers throw a clear error.
// Nothing else in the codebase imports this yet — it's the foundation.

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const bucket = process.env.S3_BUCKET || null;
const endpoint = process.env.S3_ENDPOINT || null;
const accessKeyId = process.env.S3_ACCESS_KEY_ID || null;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || null;
const region = process.env.S3_REGION || "auto";

const client = (bucket && endpoint && accessKeyId && secretAccessKey)
  ? new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Railway's S3-compatible store wants path-style addressing.
      forcePathStyle: true,
    })
  : null;

function ensureClient() {
  if (!client) {
    throw new Error("storage: bucket not configured (S3_* env vars missing)");
  }
}

// Generate a presigned URL the browser can PUT directly to. Avoids
// streaming uploads through the API process. expiresIn is in seconds.
async function presignUpload(key, contentType, expiresIn = 300) {
  ensureClient();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, cmd, { expiresIn });
}

// Generate a presigned URL for downloading a private object. Use for any
// object that should not be world-readable.
async function presignDownload(key, expiresIn = 300) {
  ensureClient();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

// Direct put from the API process. Use when the upload originates server-
// side (e.g. system-generated PDFs); for browser-originated uploads,
// prefer presignUpload + a client-side PUT.
async function putObject(key, body, contentType) {
  ensureClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return { key, url: publicUrl(key) };
}

async function deleteObject(key) {
  ensureClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Public URL for a key. Only meaningful for buckets/objects with public
// read ACLs; otherwise use presignDownload.
function publicUrl(key) {
  if (!endpoint || !bucket) return null;
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeURI(key)}`;
}

module.exports = {
  client,
  bucket,
  isConfigured: () => Boolean(client),
  presignUpload,
  presignDownload,
  putObject,
  deleteObject,
  publicUrl,
};
