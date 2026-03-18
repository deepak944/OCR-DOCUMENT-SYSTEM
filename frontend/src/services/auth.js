import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const register = async (name, email, password) => {
  const response = await axios.post(`${API_URL}/api/auth/register`, {
    name,
    email,
    password,
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/api/auth/login`, {
    email,
    password,
  });
  return response.data;
};

export const logout = async (token) => {
  const response = await axios.post(
    `${API_URL}/api/auth/logout`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const verifyToken = async (token) => {
  const response = await axios.get(`${API_URL}/api/auth/verify`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const getProfile = async (token) => {
  const response = await axios.get(`${API_URL}/api/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
