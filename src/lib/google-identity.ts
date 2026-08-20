// Loads Google Identity Services (GIS) lazily and renders the official
// "Sign in with Google" button into a container element, resolving the
// signed ID token via callback. The backend independently re-verifies
// that token against Google's public keys — this file only gets the
// token out of the widget, it never trusts it itself.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const googleClientId = import.meta.env.VITE_GOOGLE_STAFF_CLIENT_ID as string | undefined;

export async function renderGoogleButton(container: HTMLElement, onToken: (idToken: string) => void) {
  if (!googleClientId) return; // Google sign-in disabled — no client ID configured
  await loadScript();
  if (!window.google) return;
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (resp) => onToken(resp.credential),
  });
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    width: 320,
    text: "signin_with",
  });
}
