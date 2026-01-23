# Progressive Web App (PWA) Setup Guide

## What is a PWA?
A Progressive Web App allows users to install your web application directly to their device's home screen. It provides:
- ✅ Offline functionality
- ✅ Fast loading times
- ✅ Push notifications
- ✅ Home screen icon
- ✅ App-like experience
- ✅ Works on ALL devices (iPhone, Android, Desktop)

## Installation Steps

### Step 1: Install Dependencies
```bash
npm install vite-plugin-pwa -D
npm install workbox-window
```

### Step 2: Configure Vite

Add to `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'VTC Management System',
        short_name: 'VTC Hub',
        description: 'Complete training centre management solution',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
```

### Step 3: Create PWA Icons

Create these icon files in the `public/` directory:
- `pwa-192x192.png` (192x192 pixels)
- `pwa-512x512.png` (512x512 pixels)
- `apple-touch-icon.png` (180x180 pixels)
- `favicon.ico` (32x32 pixels)

You can use an online tool like [PWA Asset Generator](https://www.pwabuilder.com/) to create all required icons from a single logo.

### Step 4: Update index.html

Add these meta tags in the `<head>` section:
```html
<!-- PWA Meta Tags -->
<meta name="theme-color" content="#ffffff">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="VTC Hub">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```

### Step 5: Add Install Prompt Component

Create `src/components/InstallPWA.tsx`:
```typescript
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { Card } from "@/components/ui/card";

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstall(false);
    }
    setDeferredPrompt(null);
  };

  if (!showInstall) return null;

  return (
    <Card className="fixed bottom-4 right-4 p-4 max-w-sm z-50 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Install VTC Hub</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Install the app for quick access and offline functionality
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstallClick}>
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowInstall(false)}
            >
              Later
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setShowInstall(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};
```

### Step 6: Add to App.tsx

```typescript
import { InstallPWA } from "@/components/InstallPWA";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPWA />  {/* Add this line */}
      <BrowserRouter>
        {/* ... rest of your app */}
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

## User Installation Instructions

### For iPhone/iPad Users:
1. Open the VTC Hub website in Safari
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right corner
5. The app icon will appear on your home screen

### For Android Users:
1. Open the VTC Hub website in Chrome
2. Tap the menu button (three dots) in the top right
3. Tap "Install app" or "Add to Home Screen"
4. Tap "Install" in the popup
5. The app icon will appear on your home screen

### For Desktop Users (Chrome/Edge):
1. Open the VTC Hub website
2. Look for the install icon (⊕) in the address bar
3. Click it and select "Install"
4. The app will open in its own window

## Offline Functionality

### What Works Offline:
- ✅ Previously viewed pages
- ✅ Cached data (trainee lists, fee records, etc.)
- ✅ Static assets (images, styles, scripts)
- ✅ Navigation between cached pages

### What Requires Internet:
- ❌ Real-time data updates
- ❌ New searches
- ❌ Submitting forms
- ❌ File uploads/downloads

### Implementing Offline-First Features:

For critical features that should work offline, use the `useOnlineStatus` hook:

```typescript
// src/hooks/useOnlineStatus.tsx
import { useState, useEffect } from "react";

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
```

Then use in components:
```typescript
const { isOnline } = useOnlineStatus();

if (!isOnline) {
  return <div>You're offline. Some features may be unavailable.</div>;
}
```

## Push Notifications

### Step 1: Request Permission

```typescript
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      // Subscribe to push notifications
    }
  }
};
```

### Step 2: Show Notifications

```typescript
const showNotification = (title: string, body: string) => {
  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        tag: 'vtc-notification',
      });
    });
  }
};
```

### Step 3: Integrate with Backend

Connect notifications to your Supabase notifications table:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        showNotification(
          payload.new.title,
          payload.new.message
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

## Testing Your PWA

### Lighthouse Audit:
1. Open your app in Chrome
2. Open DevTools (F12)
3. Go to "Lighthouse" tab
4. Select "Progressive Web App"
5. Click "Generate report"
6. Aim for a score of 90+

### PWA Checklist:
- ✅ HTTPS enabled (automatic with Vercel/Netlify)
- ✅ Service worker registered
- ✅ Web app manifest present
- ✅ Icons provided (192px, 512px)
- ✅ Viewport meta tag set
- ✅ Theme color defined
- ✅ Offline functionality working

## Deployment

### Vercel:
```bash
# Build will automatically include PWA assets
npm run build
vercel --prod
```

### Netlify:
```bash
# Build will automatically include PWA assets
npm run build
netlify deploy --prod
```

The PWA will be automatically installable once deployed!

## Troubleshooting

### "Add to Home Screen" not appearing:
- Ensure you're using HTTPS (required for PWA)
- Check that manifest.json is accessible
- Verify service worker is registered
- Test in an incognito window

### Offline functionality not working:
- Check service worker is active in DevTools → Application → Service Workers
- Verify Workbox configuration in vite.config.ts
- Clear browser cache and re-register service worker

### Icons not displaying:
- Verify icon files exist in public/ directory
- Check file sizes match manifest specifications
- Clear browser cache

## Next Steps

1. **Test on actual devices**: Install on iPhone and Android to test
2. **Add offline indicators**: Show when user is offline
3. **Optimize caching**: Fine-tune what gets cached
4. **Push notification integration**: Connect to Supabase realtime
5. **Update prompts**: Show users when new version is available

## Resources

- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA Tutorial](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
