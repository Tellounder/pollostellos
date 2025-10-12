# Deploy Frontend

## Variables (.env)

- `VITE_API_URL` → https://pollos-tellos-api.onrender.com
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAIL` (opcional, fallback documentado en `src/config/admin.ts`)

## Checklist previo

1. `npm ci`
2. `npm run build`
3. Verificar que `dist/` registre el nuevo `index-*.css`/`js`.
4. Purgar caché del service worker (`firebase hosting:channel:deploy` o recarga forzada) tras publicar.

## Firebase Auth

- En `Authentication → Sign-in method → Google` agregar `https://pollostellos.com.ar` y `https://www.pollostellos.com.ar` en **Authorized domains**.
- Tras el deploy abrir en modo incógnito para forzar el bundle nuevo.

## QA rápido

1. Home → CTA invitado/admin.
2. Menú → combos + extras (diseño responsivo y estados `is-active`).
3. Checkout desde iPhone: botón de WhatsApp abre app y deja pedido en “Pendientes”.
