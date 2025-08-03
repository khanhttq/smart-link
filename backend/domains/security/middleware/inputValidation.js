// backend/domains/security/middleware/inputValidation.js
const { body, param, query, header, validationResult } = require('express-validator');
const Joi = require('joi');
const validator = require('validator');
const xss = require('xss');

// ===== VALIDATION ERROR HANDLER =====
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    console.log('❌ Validation errors:', errorDetails);

    return res.status(400).json({
      success: false,
      message: 'Input validation failed',
      error: 'VALIDATION_ERROR',
      details: errorDetails
    });
  }
  
  next();
};

// ===== COMMON VALIDATION RULES =====

// Email validation with additional security checks
const emailValidation = () => [
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail({
      gmail_lowercase: true,
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_lowercase: true,
      yahoo_lowercase: true,
      icloud_lowercase: true
    })
    .isLength({ max: 320 }) // RFC 5321 email length limit
    .withMessage('Email too long')
    .custom(async (value) => {
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /script/i,
        /<[^>]*>/,
        /javascript:/i,
        /vbscript:/i,
        /on\w+=/i
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(value))) {
        throw new Error('Email contains suspicious content');
      }
      
      // Check for disposable email domains
      const disposableDomains = [
        '10minutemail.com',
        'tempmail.org',
        'guerrillamail.com',
        'mailinator.com'
      ];
      
      const domain = value.split('@')[1]?.toLowerCase();
      if (disposableDomains.includes(domain)) {
        throw new Error('Disposable email addresses are not allowed');
      }
      
      return true;
    })
];

// Password validation with strength requirements
const passwordValidation = () => [
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value) => {
      // Check for common weak passwords
      const commonPasswords = [
        'password', 'password123', '123456789', 'qwerty123',
        'admin123', 'welcome123', 'letmein123'
      ];
      
      if (commonPasswords.includes(value.toLowerCase())) {
        throw new Error('Password is too common');
      }
      
      // Check for sequential patterns
      if (/123456|abcdef|qwerty/i.test(value)) {
        throw new Error('Password contains sequential patterns');
      }
      
      return true;
    })
];

// Name validation with XSS protection
const nameValidation = () => [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .custom((value) => {
      // XSS protection
      const cleaned = xss(value, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      });
      
      if (cleaned !== value) {
        throw new Error('Name contains invalid characters');
      }
      
      return true;
    })
];

// URL validation for link creation
const urlValidation = () => [
  body('originalUrl')
    .isURL({
      protocols: ['http', 'https'],
      require_protocol: true,
      require_host: true,
      require_valid_protocol: true,
      allow_underscores: false,
      host_whitelist: false,
      host_blacklist: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        'internal',
        'admin',
        'api'
      ]
    })
    .withMessage('Invalid URL format')
    .isLength({ max: 2048 })
    .withMessage('URL too long (max 2048 characters)')
    .custom(async (value) => {
      // Check for malicious URLs
      const maliciousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /ftp:/i
      ];
      
      if (maliciousPatterns.some(pattern => pattern.test(value))) {
        throw new Error('URL protocol not allowed');
      }
      
      // Check for shortened URL loops (prevent shortening already shortened URLs)
      const shortUrlDomains = [
        'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
        'short.link', 'tiny.cc', 'is.gd', 'buff.ly'
      ];
      
      try {
        const url = new URL(value);
        if (shortUrlDomains.includes(url.hostname.toLowerCase())) {
          throw new Error('Cannot shorten an already shortened URL');
        }
      } catch (e) {
        throw new Error('Invalid URL format');
      }
      
      return true;
    })
];

// Custom short code validation
const shortCodeValidation = () => [
  body('customCode')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Custom code must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Custom code can only contain letters, numbers, hyphens, and underscores')
    .custom((value) => {
      // Reserved words check
      const reservedWords = [
        'api', 'admin', 'www', 'app', 'dashboard', 'login', 'register',
        'about', 'contact', 'help', 'support', 'terms', 'privacy',
        'null', 'undefined', 'true', 'false', 'test', 'demo'
      ];
      
      if (reservedWords.includes(value.toLowerCase())) {
        throw new Error('This short code is reserved');
      }
      
      return true;
    })
];

// ===== SPECIALIZED VALIDATION SCHEMAS =====

// Auth registration validation
const registerValidation = [
  ...emailValidation(),
  ...passwordValidation(),
  ...nameValidation(),
  
  // Confirm password
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
    
  handleValidationErrors
];

// Auth login validation
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
    
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
    
  handleValidationErrors
];

// Link creation validation
const createLinkValidation = [
  ...urlValidation(),
  ...shortCodeValidation(),
  
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title too long (max 200 characters)')
    .custom((value) => {
      if (value) {
        const cleaned = xss(value, { whiteList: {} });
        if (cleaned !== value) {
          throw new Error('Title contains invalid characters');
        }
      }
      return true;
    }),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description too long (max 500 characters)')
    .custom((value) => {
      if (value) {
        const cleaned = xss(value, { whiteList: {} });
        if (cleaned !== value) {
          throw new Error('Description contains invalid characters');
        }
      }
      return true;
    }),
    
  body('campaign')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Campaign name too long (max 50 characters)')
    .matches(/^[a-zA-Z0-9_-\s]+$/)
    .withMessage('Campaign name can only contain letters, numbers, spaces, hyphens, and underscores'),
    
  handleValidationErrors
];

// Parameter validation for routes
const paramValidation = {
  linkId: [
    param('id')
      .isUUID()
      .withMessage('Invalid link ID format'),
    handleValidationErrors
  ],
  
  shortCode: [
    param('shortCode')
      .isLength({ min: 3, max: 20 })
      .withMessage('Invalid short code length')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid short code format'),
    handleValidationErrors
  ]
};

// ===== SANITIZATION MIDDLEWARE =====
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // XSS protection
        sanitized[key] = xss(value, {
          whiteList: {},
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
        
        // Additional sanitization
        sanitized[key] = sanitized[key]
          .replace(/[<>]/g, '') // Remove angle brackets
          .trim(); // Remove leading/trailing whitespace
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? xss(item, { whiteList: {} }) : item
        );
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

module.exports = {
  // Error handling
  handleValidationErrors,
  
  // Individual validation rules
  emailValidation,
  passwordValidation,
  nameValidation,
  urlValidation,
  shortCodeValidation,
  
  // Complete validation schemas
  registerValidation,
  loginValidation,
  createLinkValidation,
  paramValidation,
  
  // Sanitization
  sanitizeInput
};