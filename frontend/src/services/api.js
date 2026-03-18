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
