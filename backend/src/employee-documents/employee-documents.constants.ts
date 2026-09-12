/**
 * Allowlisted upload mimetypes for employee documents (spec section 46).
 * Anything outside this list is rejected before the file is written to
 * disk, regardless of the client-reported filename extension.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
