# Frontend Documentation: TextTrack AI

TextTrack AI's frontend is a high-performance Single Page Application (SPA) designed for document intelligence. 

## 🛠 Technology Stack Deep Dive

### 1. React 18 & Vite
- **Why React?**: We use React for its component-based architecture, allowing us to build a dynamic, state-driven UI where extraction results update instantly without page reloads.
- **Why Vite?**: Vite provides an extremely fast development environment and an optimized production build compared to older tools like Create React App.

### 2. State Management (AuthContext)
- Located in `src/context/AuthContext.jsx`.
- Uses the **React Context API** to provide authentication state (user info, token) to every component in the app.
- **Persistence**: The JWT token is stored in `localStorage`, allowing the user to stay logged in even after a refresh.
- **Auto-Verification**: On mount, the context calls the `/api/auth/verify` endpoint to ensure the local token is still valid.

### 3. Routing & Security
- **React Router DOM v6**: Handles all navigation.
- **ProtectedRoute.jsx**: A wrapper component that checks the `AuthContext`. If the user isn't logged in, it redirects them to `/login`, protecting the Dashboard and History pages.

### 4. API Communication (Axios)
- Centralized in `src/services/api.js`.
- Uses **Axios Interceptors** to automatically attach the `Authorization: Bearer <token>` header to every outgoing request, ensuring the backend can always identify the user.

## 📂 Component Breakdown

- **UploadBox.jsx**: Purely handles file selection, drag-and-drop, and the initial `POST /upload` request. It manages its own `loading` and `error` states.
- **ResultBox.jsx**: Receives the JSON data from `UploadBox` and renders the side-by-side view. It also handles the "Download Word" action.
- **History.jsx**: Fetches the activity list from `GET /api/activities`. It includes a `restoreResult` function that uses the local cache to jump back to the dashboard view.

## 🎨 Styling Architecture
- **main.css**: Contains the "Global Design System" (CSS Variables, Typography, Layout).
- **auth.css**: Scoped styles for the Login and Register cards, focusing on a clean, centralized form layout.
- **Theme**: We use a custom HSL-based color palette for the "Sky Blue" identity, ensuring consistent contrast across both background and interactive elements.
