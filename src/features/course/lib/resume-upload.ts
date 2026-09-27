/**
 * Which stored TUS upload, if any, to resume for this lesson video.
 *
 * tus-js-client fingerprints the file (name, type, size, modified time), not
 * the target key, so the same recording picked for another lesson would find
 * the earlier upload and resume into that lesson's object, overwriting it.
 * Only an upload made to this exact key is resumed.
 */
export function pickResumableUpload<T extends { metadata?: Record<string, string> }>(
  previous: readonly T[],
  objectName: string,
): T | undefined {
  return previous.find((upload) => upload.metadata?.objectName === objectName);
}
