import axios from "axios"

export const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 300000,
})

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export const uploadFile = (data) => API.post("/upload", data)

export const downloadWordFile = (data) =>
  API.post("/download-word", data, { responseType: "blob" })

export const getActivities = () => API.get("/api/activities")

export const getActivityDetails = (id) => API.get(`/api/activities/${id}`)

export const deleteActivity = (id) => API.delete(`/api/activities/${id}`)

export const downloadWordFromHistory = (id) =>
  API.post(`/api/activities/${id}/download-word`, null, { responseType: "blob" })

export const forgotPassword = (email) =>
  API.post("/api/auth/forgot-password", { email })

export const resetPassword = (token, password) =>
  API.post("/api/auth/reset-password", { token, password })

const MAX_EXCEL_INLINE_IMAGE_BYTES = 8 * 1024 * 1024

function compactDocumentPayload(documentData, options = {}) {
  if (!documentData || typeof documentData !== "object") {
    return {}
  }

  const includeImageData = Boolean(options.includeImageData)
  const pages = Array.isArray(documentData.pages) ? documentData.pages : []
  const tables = Array.isArray(documentData.tables) ? documentData.tables : []
  const images = Array.isArray(documentData.images) ? documentData.images : []
  let usedInlineImageBytes = 0

  return {
    pages: pages.map((page) => ({
      page_number: page?.page_number,
      text: typeof page?.text === "string" ? page.text : "",
      blocks: Array.isArray(page?.blocks)
        ? page.blocks
            .map((block) => ({
              text: typeof block?.text === "string" ? block.text : "",
            }))
            .filter((block) => block.text)
        : [],
      tables: Array.isArray(page?.tables) ? page.tables : [],
      metadata: page?.metadata && typeof page.metadata === "object" ? page.metadata : {},
    })),
    tables,
    images: images.map((image) => {
      const estimatedInlineBytes =
        typeof image?.data_url === "string" ? Math.ceil((image.data_url.length * 3) / 4) : 0
      const inlineBytes = Number(image?.size_bytes || estimatedInlineBytes || 0)
      const canIncludeImageData =
        includeImageData &&
        typeof image?.data_url === "string" &&
        image.data_url &&
        usedInlineImageBytes + inlineBytes <= MAX_EXCEL_INLINE_IMAGE_BYTES

      if (canIncludeImageData) {
        usedInlineImageBytes += inlineBytes
      }

      return {
        page_number: image?.page_number,
        image_index: image?.image_index,
        width: image?.width,
        height: image?.height,
        extension: image?.extension,
        mime_type: image?.mime_type,
        size_bytes: image?.size_bytes,
        inline_preview_available: Boolean(image?.inline_preview_available),
        xref: image?.xref,
        data_url: canIncludeImageData ? image.data_url : undefined,
      }
    }),
    metadata: documentData.metadata && typeof documentData.metadata === "object" ? documentData.metadata : {},
  }
}

export const chatWithDocument = (message, documentData, history = [], documentName) =>
  API.post("/api/ai/chat", {
    message,
    documentData: compactDocumentPayload(documentData),
    history: Array.isArray(history) ? history.slice(-8) : [],
    documentName,
  })

export const downloadExcelExport = (documentData, documentName) =>
  API.post(
    "/api/ai/export-excel",
    { documentData: compactDocumentPayload(documentData, { includeImageData: true }), documentName },
    { responseType: "blob" }
  )

export const downloadWordExport = (documentData, documentName) =>
  API.post(
    "/api/ai/export-word",
    { documentData: compactDocumentPayload(documentData, { includeImageData: true }), documentName },
    { responseType: "blob" }
  )

const RESULT_CACHE_KEY = "ocr_result_cache"
const MAX_CACHED = 20
const ACTIVE_DOCUMENT_KEY = "texttrack_ai_active_document"

export const saveResultToCache = (fileName, resultData) => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : []
    const filtered = cache.filter((entry) => entry.fileName !== fileName)
    filtered.unshift({ fileName, data: resultData, savedAt: Date.now() })
    localStorage.setItem(
      RESULT_CACHE_KEY,
      JSON.stringify(filtered.slice(0, MAX_CACHED))
    )
  } catch {
    return undefined
  }
}

export const getResultFromCache = (fileName) => {
  try {
    const raw = localStorage.getItem(RESULT_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    return cache.find((entry) => entry.fileName === fileName) || null
  } catch {
    return null
  }
}

export const saveActiveDocument = (documentName, documentData) => {
  try {
    localStorage.setItem(
      ACTIVE_DOCUMENT_KEY,
      JSON.stringify({
        documentName: documentName || "OCR Document",
        documentData: compactDocumentPayload(documentData),
        savedAt: Date.now(),
      })
    )
  } catch {
    return undefined
  }
}

export const getActiveDocument = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_DOCUMENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
