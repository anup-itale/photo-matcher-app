import React, { useState, useCallback } from 'react'
import axios from 'axios'

function HostUpload() {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sessionData, setSessionData] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || ''

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    console.log('Drop event files:', e.dataTransfer.files.length)
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )

    console.log('Filtered image files:', droppedFiles.length)
    console.log('Files:', droppedFiles.map(f => f.name))

    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }, [])

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => file.type.startsWith('image/')
    )
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles) => {
    console.log('Adding files:', newFiles.length)
    
    setFiles(prev => [...prev, ...newFiles])

    newFiles.forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        console.log('Preview loaded for:', file.name)
        setPreviews(prev => [...prev, { file: file.name, url: e.target.result }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const response = await axios.post(`${apiUrl}/api/host/create-session`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setSessionData(response.data)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload photos. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(sessionData.share_url)
    alert('Link copied to clipboard!')
  }

  const resetForm = () => {
    setFiles([])
    setPreviews([])
    setSessionData(null)
  }

  if (sessionData) {
    return (
      <div className="container">
        <div className="success-message">
          <h1>Session Created Successfully!</h1>
          <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>
            Uploaded {sessionData.photo_count} photos
          </p>

          <div className="share-link">
            <input
              type="text"
              value={sessionData.share_url}
              readOnly
            />
            <button onClick={copyLink} className="btn btn-secondary">
              Copy Link
            </button>
          </div>

          <p style={{ margin: '20px 0', color: '#666' }}>
            Share this link with your friends so they can upload their selfie
            and find photos they're in!
          </p>

          <button onClick={resetForm} className="btn btn-primary">
            Create Another Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
  <h1>Photo Matcher</h1>
  <h2>Upload photos and create a shareable link</h2>
  <p style={{ textAlign: 'center', color: '#666', fontSize: '1.1rem', marginBottom: '30px', lineHeight: '1.6' }}>
    Upload event photos, get a shareable link. Friends upload their selfie and instantly see only photos they appear in using AI face recognition.
  </p>


      <div
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput').click()}
      >
        <div className="dropzone-content">
          <div className="dropzone-icon">📸</div>
          <h3>Drag & drop photos here</h3>
          <p>or click to select files</p>
        </div>
      </div>

      <input
        id="fileInput"
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
      />

      {previews.length > 0 && (
        <div>
          <h3>Selected Photos ({previews.length})</h3>
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                <img src={preview.url} alt={`Preview ${index + 1}`} />
                <button
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn btn-primary"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} Photos`}
          </button>
        </div>
      )}
    </div>
  )
}

export default HostUpload
