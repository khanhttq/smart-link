// frontend/src/stores/linkStore.js
import { create } from 'zustand';
import axios from 'axios';
import { message } from 'antd';

// FIXED: Tạo axios instance với baseURL
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
});

const useLinkStore = create((set, get) => ({
  // State
  links: [],
  stats: null,
  analytics: null,
  loading: false,
  
  // Actions
  fetchLinks: async (options = {}) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);
      if (options.campaign) params.append('campaign', options.campaign);
      if (options.search) params.append('search', options.search);

      // FIXED: Sử dụng apiClient thay vì axios
      const response = await apiClient.get(`/api/links?${params}`);
      const { links } = response.data.data;
      
      set({ links, loading: false });
      return { success: true, data: links };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Lỗi khi tải danh sách liên kết';
      message.error(errorMessage);
      set({ loading: false });
      return { success: false, error: errorMessage };
    }
  },

  fetchStats: async () => {
    try {
      // FIXED: Sử dụng apiClient thay vì axios
      const response = await apiClient.get('/api/links/stats');
      const stats = response.data.data;
      
      set({ stats });
      return { success: true, data: stats };
    } catch (error) {
      console.error('Error fetching stats:', error);
      // FIXED: Set default stats thay vì để null
      set({ 
        stats: { 
          totalLinks: 0, 
          totalClicks: 0, 
          avgClicks: 0,
          activeLinks: 0,
          campaignLinks: 0 
        } 
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  createLink: async (linkData) => {
    try {
      // FIXED: Sử dụng apiClient thay vì axios
      const response = await apiClient.post('/api/links', linkData);
      const newLink = response.data.data;
      
      // Add to links array
      set(state => ({
        links: [newLink, ...state.links]
      }));
      
      // Refresh stats
      get().fetchStats();
      
      return { success: true, data: newLink };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Lỗi khi tạo liên kết';
      return { success: false, error: errorMessage };
    }
  },

  updateLink: async (linkId, updateData) => {
    try {
      // FIXED: Sử dụng apiClient thay vì axios
      const response = await apiClient.put(`/api/links/${linkId}`, updateData);
      const updatedLink = response.data.data;
      
      // Update in links array
      set(state => ({
        links: state.links.map(link => 
          link.id === linkId ? updatedLink : link
        )
      }));
      
      return { success: true, data: updatedLink };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Lỗi khi cập nhật liên kết';
      return { success: false, error: errorMessage };
    }
  },

  deleteLink: async (linkId) => {
    try {
      // FIXED: Sử dụng apiClient thay vì axios
      await apiClient.delete(`/api/links/${linkId}`);
      
      // Remove from links array
      set(state => ({
        links: state.links.filter(link => link.id !== linkId)
      }));
      
      // Refresh stats
      get().fetchStats();
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Lỗi khi xóa liên kết';
      return { success: false, error: errorMessage };
    }
  },

  fetchLinkAnalytics: async (linkId, dateRange = '7d') => {
    set({ loading: true });
    try {
      // FIXED: Sử dụng apiClient thay vì axios
      const response = await apiClient.get(`/api/links/${linkId}/analytics?range=${dateRange}`);
      const analytics = response.data.data;
      
      set({ analytics, loading: false });
      return { success: true, data: analytics };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Lỗi khi tải analytics';
      message.error(errorMessage);
      set({ loading: false });
      return { success: false, error: errorMessage };
    }
  },

  // Clear store
  clear: () => {
    set({
      links: [],
      stats: { totalLinks: 0, totalClicks: 0, avgClicks: 0 }, // FIXED: Default thay vì null
      analytics: null,
      loading: false
    });
  }
}));

export { useLinkStore };