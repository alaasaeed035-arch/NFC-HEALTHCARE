import axios from 'axios';

/**
 * AI Service Configuration
 * Handles communication with the FastAPI AI drug conflict checker service
 */

const AI_SERVICE_CONFIG = {
  baseURL: process.env.DDI_SERVICE_URL || 'http://localhost:8000',
  timeout: 120000, // 120 seconds for AI processing
  retries: 3,
  retryDelay: 1000, // 1 second between retries
};

/**
 * Create axios instance for AI service
 */
const aiServiceClient = axios.create({
  baseURL: AI_SERVICE_CONFIG.baseURL,
  timeout: AI_SERVICE_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Retry helper function
 */
const retryRequest = async (fn, retries = AI_SERVICE_CONFIG.retries) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.code === 'ECONNREFUSED') {
      console.log(`AI service connection failed, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, AI_SERVICE_CONFIG.retryDelay));
      return retryRequest(fn, retries - 1);
    }
    throw error;
  }
};

/**
 * Check if AI service is available
 */
export const checkAIServiceHealth = async () => {
  try {
    const response = await retryRequest(() => aiServiceClient.get('/'));
    return {
      available: true,
      status: response.data,
    };
  } catch (error) {
    console.error('AI Service health check failed:', error.message);
    return {
      available: false,
      error: error.message,
    };
  }
};

/**
 * Call AI service endpoint with error handling
 */
export const callAIService = async (endpoint, method = 'GET', data = null) => {
  try {
    const response = await retryRequest(async () => {
      if (method === 'GET') {
        return await aiServiceClient.get(endpoint);
      } else if (method === 'POST') {
        return await aiServiceClient.post(endpoint, data);
      }
    });
    
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(`AI Service error (${endpoint}):`, error.message);
    
    // Handle specific error cases
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'AI service is not available. Please ensure the AI service is running on port 8000.',
        fallback: true,
      };
    }
    
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.detail || error.response.statusText,
        statusCode: error.response.status,
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get AI service configuration
 */
export const getAIServiceConfig = () => AI_SERVICE_CONFIG;

export default {
  checkAIServiceHealth,
  callAIService,
  getAIServiceConfig,
};
