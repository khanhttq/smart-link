// frontend/src/stores/linkStore.js - FIXED VERSION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../utils/apiClient'; // ✅ FIXED: Import from utils
import { message } from 'antd'
import { useAuthStore } from '../stores/authStore';

// Default stats để tránh null
const DEFAULT_STATS = {
  totalLinks: 0,
  totalClicks: 0,
  avgClicks: 0,
  activeLinks: 0,
  campaignLinks: 0
};

const useLinkStore = create((set, get) => ({
  // ===== STATE =====
  links: [],
  stats: DEFAULT_STATS, // Initialize with default instead of null
  analytics: null,
  loading: false,
  error: null,
  
  // ===== ACTIONS =====

  // Fetch user links with pagination and filters
  fetchLinks: async (options = {}) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);
      if (options.campaign) params.append('campaign', options.campaign);
      if (options.search) params.append('search', options.search);

      const response = await apiClient.get(`/api/links?${params}`);
      const { links } = response.data.data;
      
      // Ensure links is always an array
      const safeLinks = Array.isArray(links) ? links : [];
      
      set({ 
        links: safeLinks, 
        loading: false, 
        error: null 
      });
      
      return { success: true, data: safeLinks };
    } catch (error) {
      console.error('Error fetching links:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi tải danh sách liên kết';
      
      set({ 
        loading: false, 
        error: errorMessage,
        links: [] // Ensure links is empty array on error
      });
      
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Fetch user statistics
  fetchStats: async () => {
    try {
      const response = await apiClient.get('/api/links/stats');
      const stats = response.data.data;
      
      // Validate and merge with defaults
      const safeStats = {
        totalLinks: parseInt(stats?.totalLinks) || 0,
        totalClicks: parseInt(stats?.totalClicks) || 0,
        avgClicks: parseFloat(stats?.avgClicks) || 0,
        activeLinks: parseInt(stats?.activeLinks) || 0,
        campaignLinks: parseInt(stats?.campaignLinks) || 0
      };
      
      set({ stats: safeStats });
      return { success: true, data: safeStats };
    } catch (error) {
      console.error('Error fetching stats:', error);
      
      // Set default stats on error instead of null
      set({ stats: DEFAULT_STATS });
      
      const errorMessage = error.response?.data?.message || 'Lỗi khi tải thống kê';
      return { success: false, error: errorMessage };
    }
  },

  // Create new link
  createLink: async (linkData) => {
    try {
      const response = await apiClient.post('/api/links', linkData);
      const newLink = response.data.data;
      
      if (!newLink) {
        throw new Error('Không nhận được dữ liệu liên kết từ server');
      }
      
      // Add to links array at the beginning
      set(state => ({
        links: [newLink, ...state.links]
      }));
      
      // Refresh stats after creating
      get().fetchStats();
      
      message.success('Liên kết đã được tạo thành công!');
      return { success: true, data: newLink };
    } catch (error) {
      console.error('Error creating link:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi tạo liên kết';
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Update existing link
  updateLink: async (linkId, updateData) => {
    try {
      const response = await apiClient.put(`/api/links/${linkId}`, updateData);
      const updatedLink = response.data.data;
      
      if (!updatedLink) {
        throw new Error('Không nhận được dữ liệu cập nhật từ server');
      }
      
      // Update in links array
      set(state => ({
        links: state.links.map(link => 
          link.id === linkId ? { ...link, ...updatedLink } : link
        )
      }));
      
      // Refresh stats if needed
      get().fetchStats();
      
      message.success('Liên kết đã được cập nhật!');
      return { success: true, data: updatedLink };
    } catch (error) {
      console.error('Error updating link:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi cập nhật liên kết';
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Delete link
  deleteLink: async (linkId) => {
    try {
      await apiClient.delete(`/api/links/${linkId}`);
      
      // Remove from links array
      set(state => ({
        links: state.links.filter(link => link.id !== linkId)
      }));
      
      // Refresh stats after deletion
      get().fetchStats();
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting link:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi xóa liên kết';
      return { success: false, error: errorMessage };
    }
  },

  // Fetch analytics for a specific link
  fetchLinkAnalytics: async (linkId, dateRange = '7d') => {
    set({ loading: true });
    try {
      const response = await apiClient.get(`/api/links/${linkId}/analytics?range=${dateRange}`);
      const analytics = response.data.data;
      
      set({ analytics, loading: false });
      return { success: true, data: analytics };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi tải analytics';
      
      set({ loading: false, analytics: null });
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  // Get link by ID
  getLinkById: (linkId) => {
    const { links } = get();
    return links.find(link => link.id === linkId) || null;
  },

  // Get links by campaign
  getLinksByCampaign: (campaign) => {
    const { links } = get();
    return links.filter(link => link.campaign === campaign);
  },

  // Get active links
  getActiveLinks: () => {
    const { links } = get();
    return links.filter(link => link.isActive);
  },

  // Search links
  searchLinks: (searchTerm) => {
    const { links } = get();
    if (!searchTerm) return links;
    
    const term = searchTerm.toLowerCase();
    return links.filter(link =>
      link.title?.toLowerCase().includes(term) ||
      link.originalUrl?.toLowerCase().includes(term) ||
      link.shortCode?.toLowerCase().includes(term) ||
      link.campaign?.toLowerCase().includes(term)
    );
  },

  // Clear store (for logout)
  clear: () => {
    set({
      links: [],
      stats: DEFAULT_STATS,
      analytics: null,
      loading: false,
      error: null
    });
  },

  // Reset error state
  clearError: () => {
    set({ error: null });
  },

  // Refresh all data
  refresh: async () => {
    try {
      const [linksResult, statsResult] = await Promise.all([
        get().fetchLinks(),
        get().fetchStats()
      ]);
      
      const success = linksResult.success && statsResult.success;
      if (success) {
        message.success('Dữ liệu đã được làm mới');
      }
      
      return { success };
    } catch (error) {
      console.error('Error refreshing data:', error);
      message.error('Có lỗi khi làm mới dữ liệu');
      return { success: false, error: error.message };
    }
  }
}));

export { useLinkStore };