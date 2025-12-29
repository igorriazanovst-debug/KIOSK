/**
 * Templates Library Component
 * Browse and load project templates from server
 */

import React, { useState, useEffect } from 'react';
import { apiClient, Template } from '../services/api-client';
import { useServerStore } from '../stores/serverStore';
import { useEditorStore } from '../stores/editorStore';
import './TemplatesLibrary.css';

interface TemplatesLibraryProps {
  onClose: () => void;
  onLoad: (template: Template) => void;
}

export const TemplatesLibrary: React.FC<TemplatesLibraryProps> = ({ onClose, onLoad }) => {
  const { isConnected } = useServerStore();
  const { project } = useEditorStore();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  
  // Load templates on mount
  useEffect(() => {
    if (isConnected) {
      loadTemplates();
    }
  }, [isConnected]);
  
  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.getTemplates();
      
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        setError(result.error || 'Failed to load templates');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveAsTemplate = async () => {
    if (!project) return;
    
    const name = prompt('Template name:', project.name || 'Untitled Template');
    if (!name) return;
    
    const description = prompt('Template description (optional):');
    
    setSaving(true);
    
    try {
      const result = await apiClient.createTemplate({
        name,
        description: description || undefined,
        category: 'custom',
        tags: [],
        data: project,
      });
      
      if (result.success) {
        alert('✅ Template saved successfully!');
        loadTemplates(); // Reload list
      } else {
        alert(`❌ Failed to save template: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleLoadTemplate = (template: Template) => {
    if (confirm(`Load template "${template.name}"?\n\nThis will replace your current project.`)) {
      onLoad(template);
      onClose();
    }
  };
  
  const handleDeleteTemplate = async (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Delete template "${template.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      const result = await apiClient.deleteTemplate(template.id);
      
      if (result.success) {
        loadTemplates(); // Reload list
      } else {
        alert(`❌ Failed to delete: ${result.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };
  
  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  // Get unique categories
  const categories = ['all', ...new Set(templates.map((t) => t.category || 'general'))];
  
  if (!isConnected) {
    return (
      <div className="templates-library">
        <div className="library-header">
          <h2>Templates Library</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="library-content">
          <div className="empty-state">
            <p>⚠️ Not connected to server</p>
            <p>Enable server integration in settings to use templates library.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="templates-library">
      <div className="library-header">
        <h2>Templates Library</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="library-toolbar">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-select"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
        
        <button
          className="save-template-button"
          onClick={handleSaveAsTemplate}
          disabled={saving || !project}
        >
          {saving ? 'Saving...' : '💾 Save Current as Template'}
        </button>
      </div>
      
      <div className="library-content">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading templates...</p>
          </div>
        )}
        
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={loadTemplates}>Retry</button>
          </div>
        )}
        
        {!loading && !error && filteredTemplates.length === 0 && (
          <div className="empty-state">
            <p>📋 No templates found</p>
            {searchQuery && <p>Try a different search term</p>}
            {!searchQuery && <p>Save your current project as a template to get started!</p>}
          </div>
        )}
        
        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="templates-grid">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="template-card"
                onClick={() => handleLoadTemplate(template)}
              >
                <div className="template-thumbnail">
                  {template.thumbnail ? (
                    <img src={template.thumbnail} alt={template.name} />
                  ) : (
                    <div className="placeholder-thumbnail">📋</div>
                  )}
                </div>
                
                <div className="template-info">
                  <h3>{template.name}</h3>
                  {template.description && <p>{template.description}</p>}
                  
                  <div className="template-meta">
                    {template.category && (
                      <span className="category-badge">{template.category}</span>
                    )}
                    {template.tags && template.tags.length > 0 && (
                      <div className="tags">
                        {template.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="template-actions">
                    <button
                      className="delete-button"
                      onClick={(e) => handleDeleteTemplate(template, e)}
                      title="Delete template"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="library-footer">
        <p>{filteredTemplates.length} template(s) found</p>
      </div>
    </div>
  );
};
