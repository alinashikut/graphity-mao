import React, { useState, useEffect } from 'react';
import './App.css';
import Map from './components/Map';
import artworksData from './data/artworks.json';

function App() {
  const [cities, setCities] = useState([]);

  useEffect(() => {
    setCities(artworksData.cities);
  }, []);

  return (
    <div className="app">
      <div className="map-container">
        <Map cities={cities} />
      </div>
    </div>
  );
}

export default App;
