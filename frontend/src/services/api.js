import axios from "axios"

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 300000
})

export const uploadFile = (data) =>
  API.post("/upload", data)

export const downloadWordFile = (data) =>
  API.post("/download-word", data, { responseType: "blob" })
