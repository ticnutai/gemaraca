/**
 * Calculate a hash for file content using SubtleCrypto
 * This is used for content-based duplicate detection
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Calculate hashes for multiple files in parallel with chunking
 * Returns a Map of file name to hash
 */
export async function calculateFileHashes(
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const CHUNK_SIZE = 5;
  
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const hashes = await Promise.all(chunk.map(async (file) => {
      try {
        const hash = await calculateFileHash(file);
        return { name: file.name, hash };
      } catch {
        // If hashing fails, use file name + size as fallback
        return { name: file.name, hash: `${file.name}-${file.size}` };
      }
    }));
    
    hashes.forEach(({ name, hash }) => {
      result.set(name, hash);
    });
    
    onProgress?.(Math.min(i + CHUNK_SIZE, files.length), files.length);
  }
  
  return result;
}
