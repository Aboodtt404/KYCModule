import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import VerifyFlow from '@/flow/VerifyFlow';
import Desktop from '@/pages/Desktop';
import MobileVerify from '@/pages/MobileVerify';
import Admin from '@/pages/Admin';

const isMobileDevice = () =>
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    (navigator.userAgent || '').toLowerCase()
  );

function Home() {
  // Phones go straight into the flow; desktops get the handoff hub.
  return isMobileDevice() ? <VerifyFlow /> : <Desktop />;
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/verify', element: <VerifyFlow /> },
  // Partner API sessions link here (verification_url) — same handoff screen
  { path: '/verify/:sessionId', element: <MobileVerify /> },
  { path: '/mobile-verify/:sessionId', element: <MobileVerify /> },
  { path: '/admin', element: <Admin /> }
]);

export default function App() {
  return (
    <AuthProvider>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <RouterProvider router={router} />
      </div>
    </AuthProvider>
  );
}
