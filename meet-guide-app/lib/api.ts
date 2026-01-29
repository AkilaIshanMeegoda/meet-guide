import axios, { AxiosInstance, AxiosError } from 'axios';
import { auth } from './auth';

// Create axios instance with base configuration
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Request interceptor to add auth token
  client.interceptors.request.use(
    async (config) => {
      try {
        const session = await auth.getSession();
        if (session.success && session.idToken) {
          config.headers.Authorization = `Bearer ${session.idToken}`;
        }
      } catch (error) {
        console.error('Failed to get auth token:', error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Unauthorized - redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// API client instance
const apiClient = createApiClient();

// API methods
export const api = {
  // Meeting endpoints
  meetings: {
    // Get all meetings for current user
    getAll: async (params?: { status?: string; limit?: number; offset?: number }) => {
      try {
        const response = await apiClient.get('/meetings', { params });
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error fetching meetings:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to fetch meetings' 
        };
      }
    },

    // Get single meeting by ID
    getById: async (meetingId: string) => {
      try {
        const response = await apiClient.get(`/meetings/${meetingId}`);
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error fetching meeting:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to fetch meeting' 
        };
      }
    },

    // Create new meeting
    create: async (meetingData: { title: string; scheduledTime: string; participants?: string[] }) => {
      try {
        const response = await apiClient.post('/meetings', meetingData);
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error creating meeting:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to create meeting' 
        };
      }
    },

    // Get meeting results/analysis
    getResults: async (meetingId: string) => {
      try {
        const response = await apiClient.get(`/meetings/${meetingId}/results`);
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error fetching meeting results:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to fetch meeting results' 
        };
      }
    },

    // Update meeting status
    updateStatus: async (meetingId: string, status: string) => {
      try {
        const response = await apiClient.patch(`/meetings/${meetingId}`, { status });
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error updating meeting:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to update meeting' 
        };
      }
    }
  },

  // User endpoints (if needed)
  user: {
    // Get current user profile
    getProfile: async () => {
      try {
        const response = await apiClient.get('/user/profile');
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to fetch profile' 
        };
      }
    },

    // Update user profile
    updateProfile: async (profileData: any) => {
      try {
        const response = await apiClient.put('/user/profile', profileData);
        return { success: true, data: response.data };
      } catch (error: any) {
        console.error('Error updating profile:', error);
        return { 
          success: false, 
          error: error.response?.data?.message || error.message || 'Failed to update profile' 
        };
      }
    }
  }
};

// Export both the api object and raw client for custom requests
export default api;
export { apiClient };
