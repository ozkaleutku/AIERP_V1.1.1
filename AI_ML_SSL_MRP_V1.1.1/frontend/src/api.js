import axios from 'axios';

const api = axios.create({
    // Dynamically targeting the server IP (host) instead of hardcoded 'localhost'
    // This allows access from other devices on the LAN (e.g. 192.168.1.X)
    baseURL: `http://${window.location.hostname}:8000/api`,
});

export default api;
