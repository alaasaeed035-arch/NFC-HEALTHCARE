import axios from 'axios';

const chatbotClient = axios.create({
    baseURL: process.env.CHATBOT_SERVICE_URL || 'http://localhost:8001',
    timeout: 45000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const callChatbotService = async (endpoint, method = 'POST', data = null) => {
    try {
        const response = method === 'GET'
            ? await chatbotClient.get(endpoint)
            : await chatbotClient.post(endpoint, data);
        return { success: true, data: response.data };
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return { success: false, error: 'Chatbot service is not running on port 8001.' };
        }
        return {
            success: false,
            error: error.response?.data?.detail || error.message,
            statusCode: error.response?.status,
        };
    }
};

export const checkChatbotHealth = async () => {
    try {
        const response = await chatbotClient.get('/health');
        return { available: true, data: response.data };
    } catch {
        return { available: false };
    }
};
