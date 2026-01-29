import * as faceapi from 'face-api.js'

let modelsLoaded = false

export async function loadModels() {
  if (modelsLoaded) return

  // Use CDN instead of local files
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    modelsLoaded = true
    console.log('Face detection models loaded from CDN')
  } catch (error) {
    console.error('Error loading models:', error)
    throw error
  }
}

export async function detectFace(imageElement) {
  if (!modelsLoaded) {
    await loadModels()
  }

  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()

  return detection
}

export async function detectAllFaces(imageElement) {
  if (!modelsLoaded) {
    await loadModels()
  }

  const detections = await faceapi
    .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors()

  return detections
}

export function compareFaces(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2) return 1

  const distance = faceapi.euclideanDistance(descriptor1, descriptor2)
  return distance
}

export function isFaceMatch(distance, threshold = 0.6) {
  return distance < threshold
}
