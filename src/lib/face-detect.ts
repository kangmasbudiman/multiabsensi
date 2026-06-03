import * as faceapi from '@vladmandic/face-api'

let modelsLoaded = false

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
  modelsLoaded = true
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function centroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export interface FaceResult {
  descriptor: number[]
  geometry: FaceGeometry | null
}

export interface FaceGeometry {
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

// Lightweight detection for real-time 1:N scanning (no geometry, no retry, smaller input)
// Also returns eye aspect ratio for blink detection
export async function detectSingleDescriptor(
  imageEl: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<{ descriptor: number[]; box: { x: number; y: number; width: number; height: number }; ear: number } | null> {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })

  const detection = await faceapi
    .detectSingleFace(imageEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null

  // Calculate Eye Aspect Ratio (EAR) for blink detection
  const pts = detection.landmarks.positions
  const ear = calculateEAR(pts)

  return {
    descriptor: Array.from(detection.descriptor),
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
    ear,
  }
}

// Eye Aspect Ratio — measures how open the eyes are
// EAR drops significantly during a blink
// Landmarks: left eye = pts[36-41], right eye = pts[42-47]
function calculateEAR(pts: Array<{ x: number; y: number }>): number {
  const leftEar = singleEAR(pts[36], pts[37], pts[38], pts[39], pts[40], pts[41])
  const rightEar = singleEAR(pts[42], pts[43], pts[44], pts[45], pts[46], pts[47])
  return (leftEar + rightEar) / 2
}

function singleEAR(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  p3: { x: number; y: number }, p4: { x: number; y: number },
  p5: { x: number; y: number }, p6: { x: number; y: number }
): number {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  const vertical1 = dist(p2, p6)
  const vertical2 = dist(p3, p5)
  const horizontal = dist(p1, p4)
  if (horizontal === 0) return 0.3
  return (vertical1 + vertical2) / (2 * horizontal)
}
export async function detectAndExtract(
  imageEl: HTMLImageElement | HTMLCanvasElement
): Promise<FaceResult | null> {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })

  let detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null | undefined = null
  for (let attempt = 0; attempt < 3; attempt++) {
    detection = await faceapi
      .detectSingleFace(imageEl, options)
      .withFaceLandmarks()
      .withFaceDescriptor() ?? null
    if (detection) break
  }

  if (!detection) return null

  const pts = detection.landmarks.positions
  const box = detection.detection.box

  const imgWidth = imageEl instanceof HTMLImageElement ? imageEl.naturalWidth : imageEl.width
  const imgHeight = imageEl instanceof HTMLImageElement ? imageEl.naturalHeight : imageEl.height

  const leftEye = centroid(pts.slice(36, 42))
  const rightEye = centroid(pts.slice(42, 48))
  const noseTip = pts[30]
  const mouthLeft = pts[48]
  const mouthRight = pts[54]
  const mouthBottom = pts[57]
  const leftEar = pts[0]
  const rightEar = pts[16]
  const leftCheek = pts[3]
  const rightCheek = pts[13]

  const faceWidth = box.width
  const faceHeight = box.height
  const midEye = centroid([leftEye, rightEye])
  const eyeDistance = dist(leftEye, rightEye)

  return {
    descriptor: Array.from(detection.descriptor),
    geometry: {
      aspectRatio: faceHeight / faceWidth,
      normX: box.x / imgWidth,
      normY: box.y / imgHeight,
      normW: faceWidth / imgWidth,
      normH: faceHeight / imgHeight,
      eyeDistanceRatio: eyeDistance / faceWidth,
      noseToEyeRatio: dist(noseTip, midEye) / eyeDistance,
      mouthToEyeRatio: dist(mouthBottom, midEye) / eyeDistance,
      earDistanceRatio: dist(leftEar, rightEar) / faceWidth,
      mouthWidthRatio: dist(mouthLeft, mouthRight) / faceWidth,
      leftCheekNX: leftCheek.x / imgWidth,
      leftCheekNY: leftCheek.y / imgHeight,
      rightCheekNX: rightCheek.x / imgWidth,
      rightCheekNY: rightCheek.y / imgHeight,
      noseNX: noseTip.x / imgWidth,
      noseNY: noseTip.y / imgHeight,
    },
  }
}
