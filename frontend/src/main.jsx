import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted Inter (no external font CDN calls — privacy-friendly for KYC)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './index.css';
// Side effect: restores demo-mode mock actors after a page refresh
import './demo/demoMode';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
