import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Only register service worker if not on admin pages
// Django admin should not be intercepted by the SPA service worker
const isAdminPage = window.location.pathname.startsWith('/admin');
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (!isAdminPage) {
  // Register Service Worker for PWA
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('New content available. Reload?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App is ready to work offline');
    },
  });
} else {
  // Unregister any existing service worker on admin pages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().then(() => {
          console.log('Service worker unregistered for admin page');
        });
      });
    });
  }
  
  // If on localhost and admin page, redirect to localhost:8004
  if (isLocalhost && window.location.port !== '8004') {
    window.location.href = `http://localhost:8004${window.location.pathname}${window.location.search}`;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
