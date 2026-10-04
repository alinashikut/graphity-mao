import React from 'react';

const CONTACTS = [
  { label: 'Telegram', handle: '@ashikut', href: 'https://t.me/ashikut', color: '#229ED9' },
];

function Contacts() {
  return (
    <div className="contacts-card">
      <div className="contacts-title">Shikut Street Art Map</div>
      <div className="contacts-subtitle">Contact me</div>
      {CONTACTS.map(c => (
        <a key={c.label} className="contacts-link" href={c.href} target="_blank" rel="noopener noreferrer">
          <span className="contacts-dot" style={{ background: c.color }} />
          <span className="contacts-label">{c.label}</span>
          <span className="contacts-handle">{c.handle}</span>
        </a>
      ))}
    </div>
  );
}

export default Contacts;
