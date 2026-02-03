import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { detectFace, detectAllFaces, compareFaces, isFaceMatch } from '../services/faceDetection'

function UserView() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [photos, setPhotos] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPhotos, setTotalPhotos] = useState(0)
  
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [matchedPhotoIds, setMatchedPhotoIds] = useState([])
  const [showOnlyMyPhotos, setShowOnlyMyPhotos] = useState(false)
const [processingProgress, setProcessingProgress] = useState(0)
const [processingStatus, setProcessingStatus] = useState('')

  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingSelection, setDownloadingSelection] = useState(false)
  
  const selfieImageRef = useRef(null)
  const apiUrl = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (session) {
      loadPhotos(currentPage)
    }
  }, [currentPage, session])

  const loadSession = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/session/${sessionId}`)
      setSession(response.data)
    } catch (error) {
      console.error('Error loading session:', error)
      alert('Session not found or expired')
    }
  }

  const loadPhotos = async (page) => {
    try {
      const response = await axios.get(
        `${apiUrl}/api/session/${sessionId}/photos?page=${page}&per_page=10`
      )
      
      const photosWithUrls = response.data.photos.map(photo => ({
        ...photo,
        thumbnail_url: `${apiUrl}${photo.thumbnail_url}`,
        original_url: `${apiUrl}${photo.original_url}`
      }))
      
      setPhotos(photosWithUrls)
      setTotalPages(response.data.pagination.total_pages)
      setTotalPhotos(response.data.pagination.total_photos)
    } catch (error) {
      console.error('Error loading photos:', error)
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
  setProcessingProgress(0)
  setProcessingStatus('Loading face detection models...')

  try {
    setProcessingStatus('🔍 Detecting face in your selfie...')
    setProcessingProgress(5)
    
    const selfieDetection = await detectFace(selfieImageRef.current)

    if (!selfieDetection) {
      alert('No face detected in selfie. Please upload a clearer photo with your face visible.')
      setProcessing(false)
      return
    }

    setProcessingStatus('✓ Face detected! Loading all photos...')
    setProcessingProgress(10)

    // Gallery-based matching
    const referenceGallery = [selfieDetection.descriptor]
    const matched = []  // Use Set to ensure uniqueness

    const MATCH_THRESHOLD = 0.7
    const GALLERY_THRESHOLD = 0.4

    // Load all photos
    const allPhotosToCheck = []
    for (let page = 1; page <= totalPages; page++) {
      const response = await axios.get(
        `${apiUrl}/api/session/${sessionId}/photos?page=${page}&per_page=10`
      )
      const pagePhotos = response.data.photos.map(photo => ({
        ...photo,
        thumbnail_url: `${apiUrl}${photo.thumbnail_url}`,
        original_url: `${apiUrl}${photo.original_url}`
      }))
      allPhotosToCheck.push(...pagePhotos)
      
      const loadProgress = 10 + ((page / totalPages) * 10)
      setProcessingProgress(loadProgress)
      setProcessingStatus(`Loading photos... (${page}/${totalPages} pages)`)
    }

    setProcessingStatus(`🔍 Analyzing ${allPhotosToCheck.length} photos...`)
    setProcessingProgress(20)

    // Process each photo with progress updates
    for (let i = 0; i < allPhotosToCheck.length; i++) {
      const photo = allPhotosToCheck[i]
      
      // Update progress
      const progress = 20 + ((i / allPhotosToCheck.length) * 75)
      setProcessingProgress(Math.round(progress))
      setProcessingStatus(`Analyzing photo ${i + 1} of ${allPhotosToCheck.length}...`)
      
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = photo.original_url
        })

        const detections = await detectAllFaces(img)

        if (detections && detections.length > 0) {
          for (const detection of detections) {
            let bestMatch = 1
            
            for (const reference of referenceGallery) {
              const distance = compareFaces(reference, detection.descriptor)
              if (distance < bestMatch) bestMatch = distance
            }

            if (bestMatch < MATCH_THRESHOLD) {
  if (bestMatch < MATCH_THRESHOLD) {
  // Prevent duplicates
  if (!matched.includes(photo.id)) {
    matched.push(photo.id)
  }



              
              if (bestMatch < GALLERY_THRESHOLD && referenceGallery.length < 3) {
                referenceGallery.push(detection.descriptor)
                console.log(`✓ Added face to gallery (${referenceGallery.length} references)`)
              }
              
              break
            }
          }
        }
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error)
      }
    }

    setProcessingProgress(100)
    setProcessingStatus(`✓ Done! Found ${matched.length} matches`)
    
    setMatchedPhotoIds(matched)
    
    setTimeout(() => {
      if (matched.length === 0) {
        alert('No matches found 😔\n\nTry uploading a different selfie with better lighting and a clear view of your face.')
      } else {
        alert(`Found ${matched.length} photo${matched.size > 1 ? 's' : ''} with you! 🎉`)

      }
    }, 500)
    
  } catch (error) {
    console.error('Error processing selfie:', error)
    alert('Error processing selfie. Please try again.')
    // In privacy mode, reload photos to show all matches across all pages
    if (isPrivacyMode && matched.length > 0) {
      setProcessingStatus('Loading your photos...')
      
      // Load all pages to get all matched photos
      const allMatchedPhotos = []
      for (let page = 1; page <= totalPages; page++) {
        const response = await axios.get(
          `${apiUrl}/api/session/${sessionId}/photos?page=${page}&per_page=10`
        )
        const pagePhotos = response.data.photos.map(photo => ({
          ...photo,
          thumbnail_url: `${apiUrl}${photo.thumbnail_url}`,
          original_url: `${apiUrl}${photo.original_url}`
        })).filter(photo => matched.includes(photo.id))

        
        allMatchedPhotos.push(...pagePhotos)
      }
      
      // Set all matched photos
      setPhotos(allMatchedPhotos)
    }

  } finally {
    setProcessing(false)
    setProcessingProgress(0)
    setProcessingStatus('')
  }
}


  const downloadAllPhotos = async () => {
    setDownloadingAll(true)
    try {
      const response = await axios.post(
        `${apiUrl}/api/session/${sessionId}/download`,
        [],  // Empty array = all photos
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `all_photos_${sessionId.slice(0, 8)}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert('Failed to download photos')
    } finally {
      setDownloadingAll(false)
    }
  }

  const downloadMyPhotos = async () => {
    if (matchedPhotoIds.length === 0) {
      alert('Please upload your selfie first to find your photos!')
      return
    }

    setDownloadingSelection(true)
    try {
      const response = await axios.post(
        `${apiUrl}/api/session/${sessionId}/download`,
        matchedPhotoIds,
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
    } finally {
      setDownloadingSelection(false)
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

  // Privacy mode and no selfie uploaded yet
  const isPrivacyMode = session.mode === 'privacy'
  // In privacy mode: only show photos after matching is complete
// In browse mode: show photos always
const hasUploadedSelfie = matchedPhotoIds.length > 0
const canShowPhotos = !isPrivacyMode || (isPrivacyMode && hasUploadedSelfie && !processing)


// In privacy mode: ALWAYS show only matched photos
// In browse mode: filter based on checkbox
const displayPhotos = isPrivacyMode
  ? photos.filter(photo => matchedPhotoIds.includes(photo.id))
  : (showOnlyMyPhotos 
      ? photos.filter(photo => matchedPhotoIds.includes(photo.id))
      : photos)


  return (
    <div className="container">
      <h1>📸 {session.name}</h1>
      {session.welcome_message && (
        <p className="subtitle">{session.welcome_message}</p>
      )}

      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        background: 'linear-gradient(135deg, #FFF5F0 0%, #FFFAF5 100%)', 
        borderRadius: '16px',
        marginBottom: '30px'
      }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          📊 {totalPhotos} photos • 
          {isPrivacyMode ? ' 🔐 Privacy Mode' : ' 👀 Browse Mode'}
        </p>
        <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '5px' }}>
          {isPrivacyMode 
            ? 'Upload your selfie to see photos you appear in'
            : 'Browse all photos or upload selfie to find yours'}
        </p>
      </div>

{/* Selfie Upload Section */}
<div style={{ 
  padding: '30px', 
  background: 'white',
  border: '2px solid #FF6B35',
  borderRadius: '16px',
  marginBottom: '30px'
}}>
  <h3 style={{ marginBottom: '15px', color: '#FF6B35', textAlign: 'center' }}>
    📷 {hasUploadedSelfie ? 'Your Selfie' : 'Upload Your Selfie'}
  </h3>
  
  {!selfiePreview ? (
    <>
      <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
        {isPrivacyMode 
          ? 'Upload a selfie to view photos you appear in'
          : 'Upload a selfie to easily find and download your photos'}
      </p>

      <div style={{ textAlign: 'center' }}>
        <input
          id="selfieInput"
          type="file"
          accept="image/*"
          onChange={handleSelfieUpload}
        />
        <label htmlFor="selfieInput" className="file-input-label">
          📸 Upload Selfie
        </label>
      </div>
    </>
  ) : (
    <div style={{ textAlign: 'center' }}>
      <img
        ref={selfieImageRef}
        src={selfiePreview}
        alt="Your selfie"
        style={{ 
          maxWidth: '250px', 
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          marginBottom: '15px'
        }}
      />

      {!processing && matchedPhotoIds.length > 0 && (
        <p style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '15px' }}>
          ✓ Found {matchedPhotoIds.length} photo{matchedPhotoIds.length > 1 ? 's' : ''} with you!
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {!processing && !hasUploadedSelfie && (
          <button
            onClick={processSelfie}
            className="btn btn-primary"
          >
            🚀 Find My Photos
          </button>
        )}
        
        <label htmlFor="selfieInput2" className="btn btn-secondary">
          🔄 Try Different Selfie
        </label>
        <input
          id="selfieInput2"
          type="file"
          accept="image/*"
          onChange={(e) => {
            handleSelfieUpload(e)
            setMatchedPhotoIds([])  // Reset matches when changing selfie
          }}
          style={{ display: 'none' }}
        />
      </div>

      {processing && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ marginBottom: '10px', color: '#666', fontWeight: '500' }}>
            {processingStatus}
          </p>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${processingProgress}%` }}
            ></div>
          </div>
          <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#999' }}>
            {processingProgress}% complete • This may take a minute
          </p>
        </div>
      )}
    </div>
  )}
</div>


      {/* Show Photos (Privacy mode requires selfie) */}
      {canShowPhotos && (

        <>
          {/* Checkbox and Download Buttons */}
          <div style={{ marginBottom: '20px' }}>
            {!isPrivacyMode && matchedPhotoIds.length > 0 && (
  <div className="checkbox-container">

                <input
                  type="checkbox"
                  id="showOnlyMine"
                  checked={showOnlyMyPhotos}
                  onChange={(e) => setShowOnlyMyPhotos(e.target.checked)}
                />
                <label htmlFor="showOnlyMine">
                  ✅ Show only photos with me ({matchedPhotoIds.length} photos)
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap' }}>
              {!isPrivacyMode && (
  <button
    onClick={downloadAllPhotos}
    disabled={downloadingAll}
    className="btn btn-secondary"
  >
    {downloadingAll ? '⏳ Downloading...' : '📦 Download All Photos'}
  </button>
)}


              {matchedPhotoIds.length > 0 && (
                <button
                  onClick={downloadMyPhotos}
                  disabled={downloadingSelection}
                  className="btn btn-primary"
                >
                  {downloadingSelection ? '⏳ Downloading...' : `📸 Download My Photos (${matchedPhotoIds.length})`}
                </button>
              )}
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#999', marginTop: '10px' }}>
              💡 Download original quality photos as ZIP file
            </p>
          </div>

          {/* Photo Grid */}
          {displayPhotos.length > 0 ? (
            <>
              <div className="photo-grid">
                {displayPhotos.map((photo) => (
                  <div key={photo.id} className="photo-item">
                    <img 
                      src={photo.thumbnail_url} 
                      alt={photo.filename}
                      onClick={() => window.open(photo.original_url, '_blank')}
                    />
                    {matchedPhotoIds.includes(photo.id) && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'rgba(255, 107, 53, 0.9)',
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                      }}>
                        ✓ You
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {!isPrivacyMode && !showOnlyMyPhotos && totalPages > 1 && (

                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
              <h3>No photos to display</h3>
              <p style={{ marginTop: '10px' }}>
                {showOnlyMyPhotos 
                  ? 'No photos with you on this page. Try browsing all photos or check other pages.'
                  : 'No photos found'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default UserView
