import axios from 'axios';

const API = axios.create({
    baseURL: 'http://192.168.234.236:8082/api', //işyerindeki ip adresi

    // baseURL: 'http://192.168.1.92:8082/api', //evdeki ip adresi

    timeout: 10000,
});



API.interceptors.request.use(async (config) => {
    console.log('İSTEK:', config.method?.toUpperCase(), config.baseURL + config.url);
    const token = global.authToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;