import React, { useState } from 'react';
import './ReviewPanel.css';

function ReviewPanel({ photos, onApprove, totalApproved }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  const current = photos[currentIndex];

  const handleApprove = () => {
    if (!city.trim()) {
      setError('Please enter city name');
      return;
    }

    onApprove(current, year, city);
    setCity('');
    setError('');
  };

  const handleSkip = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCity('');
      setError('');
    }
  };

  if (!current) return null;

  const progress = ((currentIndex + totalApproved) / (photos.length + totalApproved)) * 100;

  return (
    <div className="review-panel">
      <div className="review-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <span className="progress-text">
          {currentIndex + 1 + totalApproved} / {photos.length + totalApproved}
        </span>
      </div>

      <div className="review-content">
        <div className="review-image">
          <img src={current.thumbnail} alt={current.name} />
          {!current.coordinates?.hasCoordinates && (
            <div className="no-coords-warning">⚠️ No GPS coordinates</div>
          )}
        </div>

        <div className="review-form">
          <h3>Is this street art you photographed?</h3>

          <div className="form-group">
            <label>📍 City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setError('');
              }}
              placeholder="e.g., Kathmandu, Berlin"
              autoFocus
            />
            {error && <span className="error">{error}</span>}
          </div>

          <div className="form-group">
            <label>📅 Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              min="2015"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="form-group">
            <label>📸 Photo</label>
            <p className="photo-name">{current.name}</p>
            {current.coordinates?.hasCoordinates && (
              <p className="photo-coords">
                📍 {current.coordinates.lat.toFixed(4)}, {current.coordinates.lng.toFixed(4)}
              </p>
            )}
          </div>

          <div className="form-actions">
            <button onClick={handleApprove} className="btn-approve">
              ✅ Approve
            </button>
            <button onClick={handleSkip} className="btn-skip">
              ⏭️ Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewPanel;
