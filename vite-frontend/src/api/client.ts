import axios from 'axios'

const client = axios.create({ baseURL: '/', timeout: 30000 })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('nfc_token')
  if (token) config.headers['token'] = token
  return config
})

client.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nfc_token')
      localStorage.removeItem('nfc_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
