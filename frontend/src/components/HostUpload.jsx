import React, { useState, useCallback } from 'react'
import axios from 'axios'

function HostUpload() {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sessionData, setSessionData] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // Session settings
  const [sessionName, setSessionName] = useState('')
  const [sessionMode, setSessionMode] = useState('browse')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [themePrimary, setThemePrimary] = useState('#FF6B35')
  const [themeSecondary, setThemeSecondary] = useState('#F7931E')

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

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )

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
    // Check limit (100 photos)
    const totalFiles = files.length + newFiles.length
    if (totalFiles > 100) {
      alert(`Maximum 100 photos allowed. You tried to add ${newFiles.length} photos but only ${100 - files.length} slots available.`)
      newFiles = newFiles.slice(0, 100 - files.length)
    }

    setFiles(prev => [...prev, ...newFiles])

    newFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
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
    if (files.length === 0) {
      alert('Please select at least one photo')
      return
    }

    if (!sessionName.trim()) {
      alert('Please enter an event name')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    
    // Add files
    files.forEach(file => {
      formData.append('files', file)
    })

    // Add session settings
    formData.append('session_name', sessionName)
    formData.append('session_mode', sessionMode)
    if (welcomeMessage) formData.append('welcome_message', welcomeMessage)
    formData.append('theme_primary', themePrimary)
    formData.append('theme_secondary', themeSecondary)

    try {
      const response = await axios.post(`${apiUrl}/api/host/create-session`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
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
    alert('Link copied to clipboard! 🎉')
  }

  const resetForm = () => {
    setFiles([])
    setPreviews([])
    setSessionData(null)
    setSessionName('')
    setWelcomeMessage('')
    setUploadProgress(0)
  }

  if (sessionData) {
    return (
      <div className="container">
        <div className="success-message">
          <h1>🎉 Session Created!</h1>
          <p style={{ fontSize: '1.3rem', margin: '20px 0', fontWeight: '600' }}>
            {sessionData.photo_count} photos uploaded successfully
          </p>

          <div style={{ margin: '30px 0', padding: '20px', background: 'white', borderRadius: '12px' }}>
            <p style={{ fontWeight: '600', marginBottom: '10px', color: '#333' }}>Event: {sessionName}</p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Mode: {sessionMode === 'privacy' ? '🔐 Privacy Mode - Users see only their photos' : '👀 Browse Mode - Users can see all photos'}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
              Expires: {new Date(sessionData.expires_at).toLocaleDateString()}
            </p>
          </div>

          <div className="share-link">
            <input
              type="text"
              value={sessionData.share_url}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <button onClick={copyLink} className="btn btn-secondary">
              📋 Copy Link
            </button>
          </div>

          <p style={{ margin: '20px 0', color: '#666', fontSize: '1.1rem' }}>
            Share this link with your guests so they can find their photos! 📸
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
      <h1>📸 Photo Matcher</h1>
      <p className="subtitle">
        Upload event photos, get a shareable link. Your guests upload selfies and AI finds their photos automatically.
      </p>

      {/* Session Settings Form */}
      <div style={{ marginBottom: '30px', padding: '25px', background: 'linear-gradient(135deg, #FFF5F0 0%, #FFFAF5 100%)', borderRadius: '16px' }}>
        <h3 style={{ marginBottom: '20px', color: '#FF6B35' }}>⚙️ Event Settings</h3>
        
        <div className="form-group">
          <label>Event Name *</label>
          <input
            type="text"
            placeholder="e.g., Priya & Rahul's Wedding"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label>Mode</label>
          <select value={sessionMode} onChange={(e) => setSessionMode(e.target.value)}>
            <option value="browse">👀 Browse Mode - Guests can see all photos</option>
            <option value="privacy">🔐 Privacy Mode - Guests see only their photos</option>
          </select>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
            {sessionMode === 'privacy' 
              ? 'Privacy mode: Guests must upload selfie to see any photos'
              : 'Browse mode: Guests can browse all photos, selfie helps download their photos'}
          </p>
        </div>

        <div className="form-group">
          <label>Welcome Message (Optional)</label>
          <textarea
            placeholder="e.g., Welcome! Upload your selfie to find all your photos from our special day 💖"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="form-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={themePrimary}
              onChange={(e) => setThemePrimary(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Secondary Color</label>
            <input
              type="color"
              value={themeSecondary}
              onChange={(e) => setThemeSecondary(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Photo Upload Area */}
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
          <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '10px' }}>
            Maximum 100 photos • JPG, PNG supported
          </p>
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
          <h3 style={{ color: '#333', marginBottom: '15px' }}>
            Selected Photos ({previews.length}/100)
          </h3>
          
          {uploading && (
            <div>
              <p style={{ marginBottom: '10px', color: '#666' }}>
                Uploading... {uploadProgress}%
              </p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                <img src={preview.url} alt={`Preview ${index + 1}`} />
                {!uploading && (
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <button
              onClick={handleUpload}
              disabled={uploading || !sessionName.trim()}
              className="btn btn-primary"
              style={{ fontSize: '1.1rem', padding: '16px 40px' }}
            >
              {uploading ? `Uploading... ${uploadProgress}%` : `🚀 Upload ${files.length} Photos`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HostUpload
