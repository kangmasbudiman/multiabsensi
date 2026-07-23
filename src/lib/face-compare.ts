export interface FaceData {
  aspectRatio: number
  normX: number
  normY: number
  normW: number
  normH: number
  eyeDistanceRatio: number
  noseToEyeRatio: number
  mouthToEyeRatio: number
  earDistanceRatio: number
  mouthWidthRatio: number
  leftCheekNX: number
  leftCheekNY: number
  rightCheekNX: number
  rightCheekNY: number
  noseNX: number
  noseNY: number
}

export interface ComparisonResult {
  isMatch: boolean
  similarity: number
}

// Euclidean distance between two 128-dim face descriptors
export function descriptorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

// Compare using face descriptors (128-dim embeddings)
// Threshold dipertegas ke 0.5 (sebelumnya 0.6 dari literatur FaceNet).
// Di produksi 0.6 terlalu lenient — false-accept rate naik ke 1-5%.
// 0.5 menurunkan FAR ke ~0.1-1% dengan trade-off FRR naik (user legit
// kadang perlu retry kalau foto registrasi/foto capture jelek).
export const MATCH_THRESHOLD = 0.5

export function compareDescriptors(
  capturedDescriptor: number[],
  storedDescriptor: number[]
): ComparisonResult {
  const distance = descriptorDistance(capturedDescriptor, storedDescriptor)
  // Convert distance to similarity score (0-1)
  // distance 0 = 100% match, distance 0.5 = threshold, distance 1.0+ = very different
  const similarity = Math.max(0, Math.min(1, 1 - distance))
  return {
    isMatch: distance < MATCH_THRESHOLD,
    similarity,
  }
}

// Liveness check: compare two descriptors captured at different times
// If they're nearly identical (distance < threshold), it's likely a static photo
export function checkLiveness(
  descriptor1: number[],
  descriptor2: number[],
  minDistance: number = 0.02
): { isLive: boolean; distance: number } {
  const distance = descriptorDistance(descriptor1, descriptor2)
  return {
    isLive: distance >= minDistance,
    distance,
  }
}

// Check if face is large enough in frame (not a small photo from distance)
// minFaceRatio = minimum face width as fraction of image width
export function isFaceSizeAdequate(
  faceWidth: number,
  imageWidth: number,
  minFaceRatio: number = 0.2
): boolean {
  return (faceWidth / imageWidth) >= minFaceRatio
}

// 1:N identification — find the closest matching descriptor from a set
export function findBestMatch(
  capturedDescriptor: number[],
  storedDescriptors: Array<{ user_id: string; descriptor: number[] }>
): { user_id: string; distance: number; similarity: number; isMatch: boolean } | null {
  let bestDistance = Infinity
  let bestUserId: string | null = null

  for (const entry of storedDescriptors) {
    const dist = descriptorDistance(capturedDescriptor, entry.descriptor)
    if (dist < bestDistance) {
      bestDistance = dist
      bestUserId = entry.user_id
    }
  }

  if (bestUserId === null) return null

  return {
    user_id: bestUserId,
    distance: bestDistance,
    similarity: Math.max(0, Math.min(1, 1 - bestDistance)),
    isMatch: bestDistance < MATCH_THRESHOLD,
  }
}

// Legacy geometric comparison (kept for migration)
function ratioDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 1
  return Math.min(Math.abs(a - b) / b, 1)
}

function posDiff(a: number, b: number): number {
  return Math.abs(a - b)
}

export function compareFaceData(
  captured: FaceData,
  stored: FaceData
): ComparisonResult {
  const ratioDiffs = [
    ratioDiff(captured.eyeDistanceRatio, stored.eyeDistanceRatio),
    ratioDiff(captured.noseToEyeRatio, stored.noseToEyeRatio),
    ratioDiff(captured.mouthToEyeRatio, stored.mouthToEyeRatio),
    ratioDiff(captured.earDistanceRatio, stored.earDistanceRatio),
    ratioDiff(captured.mouthWidthRatio, stored.mouthWidthRatio),
    ratioDiff(captured.aspectRatio, stored.aspectRatio),
  ]

  const posDiffs = [
    posDiff(captured.leftCheekNX, stored.leftCheekNX),
    posDiff(captured.leftCheekNY, stored.leftCheekNY),
    posDiff(captured.rightCheekNX, stored.rightCheekNX),
    posDiff(captured.rightCheekNY, stored.rightCheekNY),
    posDiff(captured.noseNX, stored.noseNX),
    posDiff(captured.noseNY, stored.noseNY),
  ]

  const allDiffs = [...ratioDiffs, ...posDiffs]
  const avgDiff = allDiffs.reduce((sum, d) => sum + d, 0) / allDiffs.length

  const similarity = Math.max(0, Math.min(1, 1 - avgDiff * 3))

  return {
    isMatch: similarity >= 0.7,
    similarity,
  }
}
