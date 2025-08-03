// frontend/src/hooks/useDomains.js
import { useState, useEffect } from 'react';
import { message } from 'antd';
import apiClient from '../utils/apiClient';

export const useDomains = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all user domains
  const fetchDomains = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get('/api/domains');
      
      if (response.data.success) {
        // Add default domain to the list
        const allDomains = [
          {
            id: null,
            domain: 'shortlink.com',
            displayName: 'Default (shortlink.com)',
            isVerified: true,
            isActive: true,
            isDefault: true,
            monthlyUsage: 0,
            monthlyLinkLimit: null,
            sslEnabled: true
          },
          ...response.data.data
        ];
        
        setDomains(allDomains);
        return allDomains;
      } else {
        throw new Error(response.data.message || 'Failed to fetch domains');
      }
    } catch (err) {
      console.error('Failed to fetch domains:', err);
      setError(err.message);
      
      // Fallback to default domain only
      const defaultDomain = [{
        id: null,
        domain: 'shortlink.com',
        displayName: 'Default (shortlink.com)',
        isVerified: true,
        isActive: true,
        isDefault: true,
        monthlyUsage: 0,
        monthlyLinkLimit: null,
        sslEnabled: true
      }];
      
      setDomains(defaultDomain);
      return defaultDomain;
    } finally {
      setLoading(false);
    }
  };

  // Add new domain
  const addDomain = async (domainData) => {
    try {
      const response = await apiClient.post('/api/domains', domainData);
      
      if (response.data.success) {
        message.success('Domain đã được thêm thành công');
        await fetchDomains(); // Refresh list
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to add domain');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      message.error(`Lỗi khi thêm domain: ${errorMessage}`);
      throw err;
    }
  };

  // Verify domain ownership
  const verifyDomain = async (domainId) => {
    try {
      const response = await apiClient.post(`/api/domains/${domainId}/verify`);
      
      if (response.data.success) {
        message.success('Domain đã được xác thực thành công!');
        await fetchDomains(); // Refresh list
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Verification failed');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      message.error(`Xác thực thất bại: ${errorMessage}`);
      throw err;
    }
  };

  // Get verification instructions
  const getVerificationInstructions = async (domainId) => {
    try {
      const response = await apiClient.get(`/api/domains/${domainId}/verification`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to get verification instructions');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      message.error(`Không thể lấy thông tin xác thực: ${errorMessage}`);
      throw err;
    }
  };

  // Update domain settings
  const updateDomain = async (domainId, updateData) => {
    try {
      const response = await apiClient.put(`/api/domains/${domainId}`, updateData);
      
      if (response.data.success) {
        message.success('Cài đặt domain đã được cập nhật');
        await fetchDomains(); // Refresh list
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to update domain');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      message.error(`Lỗi khi cập nhật: ${errorMessage}`);
      throw err;
    }
  };

  // Delete domain
  const deleteDomain = async (domainId) => {
    try {
      const response = await apiClient.delete(`/api/domains/${domainId}`);
      
      if (response.data.success) {
        message.success('Domain đã được xóa');
        await fetchDomains(); // Refresh list
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to delete domain');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      message.error(`Lỗi khi xóa domain: ${errorMessage}`);
      throw err;
    }
  };

  // Get available/verified domains for link creation
  const getAvailableDomains = () => {
    return domains.filter(domain => 
      domain.isVerified && domain.isActive
    );
  };

  // Get domain by ID
  const getDomainById = (domainId) => {
    return domains.find(domain => domain.id === domainId);
  };

  // Check if domain has usage limit warnings
  const getDomainWarnings = (domain) => {
    if (!domain.monthlyLinkLimit) return null;
    
    const usagePercent = (domain.monthlyUsage / domain.monthlyLinkLimit) * 100;
    
    if (usagePercent >= 90) {
      return {
        type: 'error',
        message: `Gần đạt giới hạn: ${domain.monthlyUsage}/${domain.monthlyLinkLimit} links`
      };
    } else if (usagePercent >= 75) {
      return {
        type: 'warning',
        message: `Sử dụng cao: ${domain.monthlyUsage}/${domain.monthlyLinkLimit} links`
      };
    }
    
    return null;
  };

  // Auto-fetch domains on hook initialization
  useEffect(() => {
    fetchDomains();
  }, []);

  return {
    domains,
    loading,
    error,
    fetchDomains,
    addDomain,
    verifyDomain,
    getVerificationInstructions,
    updateDomain,
    deleteDomain,
    getAvailableDomains,
    getDomainById,
    getDomainWarnings
  };
};

export default useDomains;