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
 * Calculate hashes for multiple files using adaptive concurrency
 * Returns a Map of file name to hash
 */
export async function calculateFileHashes(
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const CONCURRENCY = navigator.hardwareConcurrency || 4;
  let completed = 0;
  
  const queue = [...files];
  const workers: Promise<void>[] = [];
  
  const processFile = async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      try {
        const hash = await calculateFileHash(file);
        result.set(file.name, hash);
      } catch {
        result.set(file.name, `${file.name}-${file.size}`);
      }
      completed++;
      onProgress?.(completed, files.length);
    }
  };
  
  for (let i = 0; i < Math.min(CONCURRENCY, files.length); i++) {
    workers.push(processFile());
  }
  
  await Promise.all(workers);
  return result;
}
