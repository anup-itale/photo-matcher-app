import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { detectFace, detectAllFaces, compareFaces, isFaceMatch } from '../services/faceDetection'

function UserView() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [photos, setPhotos] = useState([])
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [matchedPhotos, setMatchedPhotos] = useState([])
  const [userFaceDescriptor, setUserFaceDescriptor] = useState(null)
  const [showMatches, setShowMatches] = useState(false)
  const selfieImageRef = useRef(null)

  const apiUrl = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    loadSession()
  }, [sessionId])

  const loadSession = async () => {
    try {
      const [sessionRes, photosRes] = await Promise.all([
        axios.get(`${apiUrl}/api/session/${sessionId}`),
        axios.get(`${apiUrl}/api/session/${sessionId}/photos`)
      ])

      setSession(sessionRes.data)
      
      // Update photo URLs to include apiUrl
      const photosWithFullUrls = photosRes.data.photos.map(photo => ({
        ...photo,
        url: `${apiUrl}${photo.url}`
      }))
      setPhotos(photosWithFullUrls)
    } catch (error) {
      console.error('Error loading session:', error)
      alert('Session not found')
    }
  }

  const handleSelfieUpload = (e) => {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/')) return

    setSelfieFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setSelfiePreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  const processSelfie = async () => {
    if (!selfieFile || !selfieImageRef.current) return

    setProcessing(true)
    setShowMatches(false)

    try {
      console.log('Detecting face in selfie...')
      const selfieDetection = await detectFace(selfieImageRef.current)

      if (!selfieDetection) {
        alert('No face detected in selfie. Please upload a clearer photo.')
        setProcessing(false)
        return
      }

      console.log('Face detected in selfie!')
      setUserFaceDescriptor(selfieDetection.descriptor)

      const matches = []

      for (const photo of photos) {
        try {
          const img = new Image()
          img.crossOrigin = 'anonymous'

          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = photo.url
          })

          const detections = await detectAllFaces(img)

          if (detections && detections.length > 0) {
            for (const detection of detections) {
              const distance = compareFaces(
                selfieDetection.descriptor,
                detection.descriptor
              )

              if (isFaceMatch(distance)) {
                matches.push({
                  ...photo,
                  confidence: (1 - distance).toFixed(2)
                })
                break
              }
            }
          }
        } catch (error) {
          console.error(`Error processing photo ${photo.id}:`, error)
        }
      }

      console.log(`Found ${matches.length} matching photos`)
      setMatchedPhotos(matches)
      setShowMatches(true)
    } catch (error) {
      console.error('Error processing selfie:', error)
      alert('Error processing selfie. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const downloadPhotos = async () => {
    if (matchedPhotos.length === 0) return

    try {
      const photoIds = matchedPhotos.map(p => p.id)

      const response = await axios.post(
        `${apiUrl}/api/session/${sessionId}/download`,
        photoIds,
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `my_photos_${sessionId.slice(0, 8)}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert('Failed to download photos')
    }
  }

  if (!session) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Find Your Photos</h1>
      <h2>{session.photo_count} photos uploaded</h2>

      {!showMatches && (
        <div className="selfie-upload">
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Upload a selfie to find photos you're in
          </p>

          <input
            id="selfieInput"
            type="file"
            accept="image/*"
            onChange={handleSelfieUpload}
          />

          <label htmlFor="selfieInput" className="file-input-label">
            {selfieFile ? 'Change Selfie' : 'Upload Selfie'}
          </label>

          {selfiePreview && (
            <div className="selfie-preview">
              <img
                ref={selfieImageRef}
                src={selfiePreview}
                alt="Your selfie"
                style={{ maxWidth: '300px', borderRadius: '12px' }}
              />

              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={processSelfie}
                  disabled={processing}
                  className="btn btn-primary"
                >
                  {processing ? 'Processing...' : 'Find My Photos'}
                </button>
              </div>

              {processing && (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Analyzing faces...</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showMatches && (
        <div>
          <div className="match-stats">
            <h2>Found {matchedPhotos.length} photo{matchedPhotos.length !== 1 ? 's' : ''} with you!</h2>
            {matchedPhotos.length > 0 && (
              <button onClick={downloadPhotos} className="btn btn-primary" style={{ marginTop: '15px' }}>
                Download All ({matchedPhotos.length} photos)
              </button>
            )}
          </div>

          {matchedPhotos.length > 0 ? (
            <div className="photo-grid">
              {matchedPhotos.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img src={photo.url} alt={`Match ${index + 1}`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="no-matches">
              <h3>No matches found</h3>
              <p>Sorry, we couldn't find any photos with your face.</p>
              <button
                onClick={() => {
                  setShowMatches(false)
                  setSelfieFile(null)
                  setSelfiePreview(null)
                }}
                className="btn btn-secondary"
                style={{ marginTop: '20px' }}
              >
                Try Another Selfie
              </button>
            </div>
          )}

          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <button
              onClick={() => {
                setShowMatches(false)
                setSelfieFile(null)
                setSelfiePreview(null)
                setMatchedPhotos([])
              }}
              className="btn btn-secondary"
            >
              Upload Different Selfie
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserView
