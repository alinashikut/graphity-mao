import React from 'react';

function GoogleAuth({ setIsAuthenticated }) {
  const handleLogin = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/google-url');
      const data = await response.json();

      if (data.authUrl) {
        // Open Google auth in new window or redirect
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

  return (
    <div className="auth-panel">
      <div className="auth-content">
        <h2>🔐 Connect to Google Drive</h2>
        <p>Authorize access to your Google Drive to import photos with location data</p>
        <button onClick={handleLogin} className="btn-google">
          <img src="https://www.gstatic.com/images/branding/product/1x/googleg_120.png" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default GoogleAuth;
