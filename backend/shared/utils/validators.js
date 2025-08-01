// shared/utils/validators.js

// Validate URL
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // Block dangerous schemes
    const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousSchemes.some(scheme => url.toLowerCase().startsWith(scheme))) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Validate email
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate short code
function validateShortCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Only alphanumeric, 3-50 chars
  return /^[a-zA-Z0-9]{3,50}$/.test(code);
}

// Validate password
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

module.exports = {
  validateUrl,
  validateEmail,
  validateShortCode,
  validatePassword
};