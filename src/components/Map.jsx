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
          radius: 12,
          fillColor: '#ff6b6b',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        })
          .bindPopup(`
            <div class="city-popup">
              <h3>📍 ${city.city}</h3>
              <p><strong>${city.country}</strong></p>
              <p><strong>${city.artworks.length}</strong> street art photos</p>
              <ul style="max-height: 200px; overflow-y: auto;">
                ${city.artworks.map(art => `<li>${art.fileName}</li>`).join('')}
              </ul>
            </div>
          `)
          .addTo(map.current);

        markersRef.current.push(marker);
      }
    });

    // Fit bounds if there are markers
    if (markersRef.current.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      map.current.fitBounds(group.getBounds(), { padding: [50, 50] });
    }

  }, [cities]);

  return <div ref={mapContainer} className="map" />;
}

export default Map;
