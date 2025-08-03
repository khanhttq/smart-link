// frontend/src/utils/urlUtils.js
/**
 * URL Generation utilities for shortlinks
 */

// Get API base URL from environment or default
const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:4000';
};

/**
 * Generate full shortlink URL based on domain and shortCode
 * @param {string} shortCode - The short code
 * @param {Object} domain - Domain object with domain field
 * @returns {string} Full shortlink URL
 */
export const generateShortUrl = (shortCode, domain = null) => {
  if (!shortCode) return '';
  
  // For custom verified domain
  if (domain && domain.domain && domain.domain !== 'shortlink.com') {
    return `https://${domain.domain}/${shortCode}`;
  }
  
  // For default domain - use API base URL  
  const apiUrl = getApiBaseUrl();
  return `${apiUrl}/${shortCode}`;
};

/**
 * Generate preview URL for domain selection
 * @param {Object} domain - Domain object
 * @param {string} placeholder - Placeholder for shortcode
 * @returns {string} Preview URL
 */
export const generatePreviewUrl = (domain, placeholder = 'your-code') => {
  if (!domain) return '';
  
  if (domain.domain === 'shortlink.com' || domain.isDefault) {
    const apiUrl = getApiBaseUrl();
    return `${apiUrl}/${placeholder}`;
  }
  
  return `https://${domain.domain}/${placeholder}`;
};

/**
 * Extract domain info from a link object
 * @param {Object} link - Link object from API
 * @returns {Object} Domain info
 */
export const extractDomainInfo = (link) => {
  return {
    domain: link.domain?.domain || 'shortlink.com',
    displayName: link.domain?.displayName || 'Default',
    isDefault: !link.domain || link.domain.domain === 'shortlink.com',
    isVerified: link.domain?.isVerified ?? true
  };
};

/**
 * Check if URL is a valid shortlink domain
 * @param {string} url - URL to check
 * @returns {boolean} Is valid shortlink
 */
export const isValidShortlinkUrl = (url) => {
  if (!url) return false;
  
  const apiUrl = getApiBaseUrl();
  return url.startsWith(apiUrl) || url.match(/^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9_-]+$/);
};

/**
 * Parse shortlink URL to get domain and shortCode
 * @param {string} url - Shortlink URL
 * @returns {Object} Parsed info
 */
export const parseShortlinkUrl = (url) => {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const shortCode = urlObj.pathname.substring(1); // Remove leading slash
    
    return {
      domain: urlObj.hostname,
      shortCode,
      fullUrl: url
    };
  } catch (error) {
    console.error('Failed to parse shortlink URL:', error);
    return null;
  }
};

export default {
  generateShortUrl,
  generatePreviewUrl,
  extractDomainInfo,
  isValidShortlinkUrl,
  parseShortlinkUrl
};