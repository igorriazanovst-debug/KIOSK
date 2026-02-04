/**
 * Media Library Component
 * Browse, upload, and manage media files from server
 * NOW WITH: Insert media into project as widgets!
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient, MediaFile } from '../services/api-client';
import { useServerStore } from '../stores/serverStore';
import { useEditorStore } from '../stores/editorStore';
import './MediaLibrary.css';

interface MediaLibraryProps {
  onClose: () => void;
  onSelect?: (media: MediaFile) => void;
  type?: 'image' | 'video' | 'audio' | 'all';
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ onClose, onSelect, type = 'all' }) => {
  const { isConnected } = useServerStore();
  const { addWidget, project } = useEditorStore();
  
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio'>(type);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load media on mount
  useEffect(() => {
    if (isConnected) {
      loadMedia();
    }
  }, [isConnected, filterType]);
  
  const loadMedia = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = filterType !== 'all' ? { type: filterType } : undefined;
      const result = await apiClient.getMedia(params);
      
      // 🔍 DEBUG: Log media response
      console.log('[MediaLibrary] Media loaded:', result);
      
      if (result.success && result.data) {
        // 🔍 DEBUG: Log first media item with URL
        if (result.data.length > 0) {
          const first = result.data[0];
          const fullUrl = apiClient.getMediaUrl(first);
          console.log('[MediaLibrary] First media:', first);
          console.log('[MediaLibrary] Full URL:', fullUrl);
        }
        
        setMedia(result.data);
      } else {
        setError(result.error || 'Failed to load media');
      }
    } catch (err: any) {
      console.error('[MediaLibrary] Load error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await apiClient.uploadMedia(file);
        
        if (!result.success) {
          console.error(`Failed to upload ${file.name}:`, result.error);
        }
        
        return result;
      });
      
      const results = await Promise.all(uploadPromises);
      const successCount = results.filter((r) => r.success).length;
      
      if (successCount > 0) {
        alert(`✅ ${successCount} file(s) uploaded successfully!`);
        loadMedia(); // Reload list
      }
      
      const failCount = results.length - successCount;
      if (failCount > 0) {
        alert(`⚠️ ${failCount} file(s) failed to upload`);
      }
    } catch (err: any) {
      alert(`❌ Upload error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDelete = async (mediaFile: MediaFile, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Delete "${mediaFile.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      const result = await apiClient.deleteMedia(mediaFile.id);
      
      if (result.success) {
        loadMedia(); // Reload list
        if (selectedMedia?.id === mediaFile.id) {
          setSelectedMedia(null);
        }
      } else {
        alert(`❌ Failed to delete: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };
  
  const handleSelect = (mediaFile: MediaFile) => {
    setSelectedMedia(mediaFile);
    if (onSelect) {
      onSelect(mediaFile);
    }
  };

  /**
   * 🆕 NEW: Insert selected media into project as a widget
   */
  const handleInsertToProject = () => {
    console.log('[MediaLibrary] Insert clicked');
    console.log('[MediaLibrary] Selected media:', selectedMedia);
    console.log('[MediaLibrary] Project:', project);
    
    if (!selectedMedia || !project) {
      console.warn('[MediaLibrary] Missing selectedMedia or project');
      return;
    }

    const mediaUrl = apiClient.getMediaUrl(selectedMedia);
    console.log('[MediaLibrary] Media URL:', mediaUrl);
    
    // Определяем тип виджета по типу медиа
    let widgetType: 'image' | 'video' = 'image';
    let defaultProps: any = {};

    if (selectedMedia.type === 'image') {
      widgetType = 'image';
      defaultProps = {
        src: mediaUrl,
        objectFit: 'contain',
        borderEnabled: false,
        clipShape: 'rectangle'
      };
    } else if (selectedMedia.type === 'video') {
      widgetType = 'video';
      defaultProps = {
        src: mediaUrl,
        sourceType: 'url',
        autoplay: false,
        loop: false,
        muted: true,
        controls: true,
        objectFit: 'contain',
        borderEnabled: false
      };
    } else {
      alert('⚠️ Only images and videos can be inserted into project');
      return;
    }

    // Определяем размеры виджета
    let width = 400;
    let height = 300;

    if (selectedMedia.width && selectedMedia.height) {
      const ratio = selectedMedia.width / selectedMedia.height;
      const maxWidth = 600;
      const maxHeight = 400;

      if (selectedMedia.width > maxWidth || selectedMedia.height > maxHeight) {
        // Масштабируем с сохранением пропорций
        if (ratio > 1) {
          width = maxWidth;
          height = maxWidth / ratio;
        } else {
          height = maxHeight;
          width = maxHeight * ratio;
        }
      } else {
        width = selectedMedia.width;
        height = selectedMedia.height;
      }
    }

    // Создаем виджет в центре холста
    const x = (project.canvas.width - width) / 2;
    const y = (project.canvas.height - height) / 2;

    const newWidget = {
      id: `widget-${Date.now()}-${Math.random()}`,
      type: widgetType,
      x,
      y,
      width,
      height,
      zIndex: 0,
      properties: defaultProps
    };

    // Добавляем виджет в проект
    addWidget(newWidget);

    // Показываем уведомление
    alert(`✅ ${selectedMedia.type === 'image' ? 'Image' : 'Video'} widget added to project!`);
    
    // Закрываем Media Library
    onClose();
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Filter media
  const filteredMedia = media.filter((m) => {
    return (
      searchQuery === '' ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
  
  if (!isConnected) {
    return (
      <div className="media-library">
        <div className="library-header">
          <h2>Media Library</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="library-content">
          <div className="empty-state">
            <p>⚠️ Not connected to server</p>
            <p>Enable server integration in settings to use media library.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="media-library">
      <div className="library-header">
        <h2>Media Library</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="library-toolbar">
        <input
          type="text"
          placeholder="Search media..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="type-select"
        >
          <option value="all">All Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </select>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: 'none' }}
        />
        
        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ Uploading...' : '📤 Upload Files'}
        </button>
      </div>
      
      <div className="library-content">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading media...</p>
          </div>
        )}
        
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={loadMedia}>Retry</button>
          </div>
        )}
        
        {!loading && !error && filteredMedia.length === 0 && (
          <div className="empty-state">
            <p>📁 No media files found</p>
            {searchQuery && <p>Try a different search term</p>}
            {!searchQuery && <p>Upload your first file to get started!</p>}
          </div>
        )}
        
        {!loading && !error && filteredMedia.length > 0 && (
          <div className="media-grid">
            {filteredMedia.map((mediaFile) => (
              <div
                key={mediaFile.id}
                className={`media-card ${selectedMedia?.id === mediaFile.id ? 'selected' : ''}`}
                onClick={() => handleSelect(mediaFile)}
              >
                <div className="media-preview">
                  {mediaFile.type === 'image' && (
                    <img
                      src={apiClient.getMediaUrl(mediaFile)}
                      alt={mediaFile.name}
                      onError={(e) => {
                        console.error('[MediaLibrary] Image load error:', mediaFile.name, apiClient.getMediaUrl(mediaFile));
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('[MediaLibrary] Image loaded:', mediaFile.name);
                      }}
                    />
                  )}
                  {mediaFile.type === 'video' && (
                    <div className="video-preview">
                      🎬
                      {mediaFile.duration && (
                        <span className="duration">{formatDuration(mediaFile.duration)}</span>
                      )}
                    </div>
                  )}
                  {mediaFile.type === 'audio' && (
                    <div className="audio-preview">
                      🎵
                      {mediaFile.duration && (
                        <span className="duration">{formatDuration(mediaFile.duration)}</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="media-info">
                  <h4 title={mediaFile.name}>{mediaFile.name}</h4>
                  <div className="media-details">
                    <span className="file-size">{formatFileSize(mediaFile.file_size)}</span>
                    {mediaFile.width && mediaFile.height && (
                      <span className="dimensions">{mediaFile.width}×{mediaFile.height}</span>
                    )}
                  </div>
                  
                  <button
                    className="delete-button"
                    onClick={(e) => handleDelete(mediaFile, e)}
                    title="Delete file"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="library-footer">
        <p>{filteredMedia.length} file(s) • {(media.reduce((sum, m) => sum + m.file_size, 0) / (1024 * 1024)).toFixed(1)} MB total</p>
        
        {/* 🆕 NEW: Insert to Project button */}
        {(() => {
          console.log('[MediaLibrary] Render footer - selectedMedia:', selectedMedia);
          console.log('[MediaLibrary] Render footer - project:', project);
          return selectedMedia && (
            <button 
              className="insert-button" 
              onClick={handleInsertToProject}
              disabled={!project}
              title={!project ? 'No project loaded' : `Insert ${selectedMedia.name} into project`}
            >
              ➕ Insert into Project
            </button>
          );
        })()}
      </div>
    </div>
  );
};
