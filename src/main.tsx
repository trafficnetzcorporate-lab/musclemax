import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { isNative } from './lib/platform'

// Google AdSense: web-only. It must never load inside the native iOS shell
// (App Store policy + it cannot render in the WKWebView context anyway).
if (!isNative()) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3392547772966441';
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

createRoot(document.getElementById("root")!).render(<App />);
