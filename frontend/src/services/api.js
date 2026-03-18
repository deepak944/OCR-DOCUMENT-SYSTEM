import axios from "axios"

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 300000
})

// Add auth token to requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const uploadFile = (data) =>
  API.post("/upload", data)

export const downloadWordFile = (data) =>
  API.post("/download-word", data, { responseType: "blob" })

export const getActivities = () =>
  API.get("/api/activities")

export const deleteActivity = (id) =>
  API.delete(`/api/activities/${id}`)

// ── Local OCR result cache (keyed by activity id) ──────────────
const RESULT_CACHE_KEY = "ocr_result_cache"
const MAX_CACHED = 20

export const saveResultToCache = (fileName, resultData) => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : []
    // Each entry keyed by fileName — keep latest per file
    const filtered = cache.filter((e) => e.fileName !== fileName)
    filtered.unshift({ fileName, data: resultData, savedAt: Date.now() })
    localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(filtered.slice(0, MAX_CACHED)))
  } catch (_) {}
}

export const getResultFromCache = (fileName) => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    return cache.find((e) => e.fileName === fileName) || null
  } catch (_) { return null }
}
