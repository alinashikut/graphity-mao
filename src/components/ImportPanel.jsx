import React from 'react';

function ImportPanel({ onImport, loading, artworkCount }) {
  return (
    <div className="import-panel">
      <div className="import-content">
        <h3>📸 Street Art Collection</h3>
        {artworkCount > 0 && (
          <p className="artwork-count">Loaded: {artworkCount} artworks</p>
        )}
        <button
          onClick={onImport}
          disabled={loading}
          className="btn-import"
        >
          {loading ? '⏳ Importing...' : '🔄 Import from Google Drive'}
        </button>
        <p className="import-info">
          This will scan your "Street Art Map" folder and extract GPS coordinates from each photo.
        </p>
      </div>
    </div>
  );
}

export default ImportPanel;
