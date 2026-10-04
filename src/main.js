import L from 'leaflet';

// Fix default icon issue in Leaflet with modules
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

// Initialize map centered on world
const map = L.map('map').setView([20, 0], 2);

// Add tile layer (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Sample data - will be replaced with Google Photos data
const artworksByCity = {
    'kathmandu': {
        city: 'Kathmandu',
        country: 'Nepal',
        lat: 27.7172,
        lng: 85.3240,
        artworks: []
    }
};

// Function to add markers to map
function addMarkersToMap(data) {
    Object.values(data).forEach(city => {
        if (city.artworks && city.artworks.length > 0) {
            const marker = L.marker([city.lat, city.lng])
                .bindPopup(`
                    <div class="city-popup">
                        <h3>${city.city}, ${city.country}</h3>
                        <p>${city.artworks.length} artworks</p>
                    </div>
                `)
                .addTo(map);

            marker.on('click', () => {
                showGallery(city);
            });
        }
    });
}

// Function to show gallery (placeholder)
function showGallery(city) {
    console.log(`Showing gallery for ${city.city}`);
    // TODO: Implement gallery view
}

// Initialize map with data
addMarkersToMap(artworksByCity);

console.log('Shikut Street Art Map loaded. Waiting for Google Photos data...');
