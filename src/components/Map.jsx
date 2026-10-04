import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import '../styles/Map.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function Map({ cities }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainer.current || !cities) return;

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([27.7, 85.3], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map.current);

      // Add navigation controls
      L.control.zoom({ position: 'topleft' }).addTo(map.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for cities with artworks
    cities.forEach((city) => {
      if (city.artworks && city.artworks.length > 0) {
        const marker = L.circleMarker([city.lat, city.lng], {
          radius: 15,
          fillColor: '#ff6b6b',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.85
        });

        // Create popup with photo thumbnails
        const photoGrid = city.artworks
          .slice(0, 12)
          .map(art => `
            <div style="width: 80px; height: 80px; margin: 5px; display: inline-block; overflow: hidden; border-radius: 4px;">
              <img src="${art.thumbnail || `https://lh3.googleusercontent.com/d/${art.id}=w100`}"
                   style="width: 100%; height: 100%; object-fit: cover;"
                   alt="${art.fileName}" />
            </div>
          `).join('');

        const popupContent = `
          <div class="city-popup">
            <h3>📍 ${city.city}</h3>
            <p><strong>${city.country}</strong></p>
            <p><strong>${city.artworks.length}</strong> street art photos</p>
            <div style="max-height: 400px; overflow-y: auto; text-align: center;">
              ${photoGrid}
              ${city.artworks.length > 12 ? `<p style="font-size: 12px; color: #666;">+${city.artworks.length - 12} more photos</p>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 400, maxHeight: 500 })
          .addTo(map.current);

        markersRef.current.push(marker);
      }
    });

    // Fit bounds if there are markers
    if (markersRef.current.length > 0) {
      try {
        const group = new L.featureGroup(markersRef.current);
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        }
      } catch (err) {
        console.warn('Error fitting bounds:', err);
      }
    }

  }, [cities]);

  return <div ref={mapContainer} className="map" />;
}

export default Map;
