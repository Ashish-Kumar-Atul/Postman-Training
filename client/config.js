// Where the backend API lives.
// - Opened from localhost (npm start)  -> uses the local server on port 5050
// - Opened from anywhere else (Vercel) -> uses the deployed API
const LOCAL_API = 'http://localhost:5050';
const DEPLOYED_API = 'https://postman-training-zkkv.vercel.app';

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
window.API_BASE = isLocal ? LOCAL_API : DEPLOYED_API;
