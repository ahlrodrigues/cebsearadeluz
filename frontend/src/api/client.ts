import axios from 'axios'

// Default to same-origin during dev and rely on Vite proxy.
// Override with VITE_API_BASE_URL when deploying without proxy.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

export const setApiBaseUrl = (url: string) => {
  apiClient.defaults.baseURL = url
}
