// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const ExpressBrute = require('express-brute');

// ===== BASIC RATE LIMITERS =====

// General API rate limiter - cho tất cả requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 1000, // tối đa 1000 requests mỗi 15 phút
  message: {
    success: false,
    message: 'Quá nhiều requests từ IP này. Vui lòng thử lại sau 15 phút.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Quá nhiều requests từ IP này. Vui lòng thử lại sau 15 phút.',
      retryAfter: '15 minutes'
    });
  }
});

// Auth endpoints rate limiter - VERY RELAXED for testing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: process.env.NODE_ENV === 'development' ? 1000 : 10, // 1000 in dev!!
  message: {
    success: false,
    message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => {
    // Skip rate limiting for development completely
    return process.env.NODE_ENV === 'development';
  },
  handler: (req, res) => {
    console.log(`🔒 Auth rate limit exceeded from IP: ${req.ip} for ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.',
      retryAfter: '15 minutes'
    });
  }
});

// Password reset rate limiter - rất nghiêm ngặt
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // chỉ 3 lần reset password mỗi giờ
  message: {
    success: false,
    message: 'Quá nhiều lần reset mật khẩu. Vui lòng thử lại sau 1 giờ.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🔑 Password reset rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Quá nhiều lần reset mật khẩu. Vui lòng thử lại sau 1 giờ.',
      retryAfter: '1 hour'
    });
  }
});

// Create link rate limiter
const createLinkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 20, // 20 links mỗi phút
  message: {
    success: false,
    message: 'Tạo link quá nhanh. Vui lòng chờ 1 phút.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ===== SLOW DOWN MIDDLEWARE =====

// Progressive delay cho auth endpoints - Fixed for v2
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 phút
  delayAfter: 3, // sau 3 requests bắt đầu delay
  delayMs: () => 500, // Fixed: function return delay
  maxDelayMs: 20000, // delay tối đa 20 giây
  validate: { delayMs: false }, // Disable warning
  // onLimitReached deprecated - removed
});

// ===== BRUTE FORCE PROTECTION =====

// Memory store cho brute force (production nên dùng Redis)
const store = new ExpressBrute.MemoryStore();

// Brute force protection cho login
const loginBruteForce = new ExpressBrute(store, {
  freeRetries: 3, // 3 lần thử miễn phí
  minWait: 5 * 60 * 1000, // 5 phút chờ tối thiểu
  maxWait: 60 * 60 * 1000, // 1 giờ chờ tối đa
  failCallback: function (req, res, next, nextValidRequestDate) {
    console.log(`🛡️ Brute force protection triggered for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: `Tài khoản bị khóa tạm thời do quá nhiều lần đăng nhập sai. Thử lại sau: ${new Date(nextValidRequestDate).toLocaleTimeString('vi-VN')}`,
      nextValidRequestDate: nextValidRequestDate
    });
  },
  handleStoreError: function (error) {
    console.error('❌ Brute force store error:', error);
    throw {
      message: error.message,
      parent: error.parent
    };
  }
});

// Brute force protection cho password reset
const passwordResetBruteForce = new ExpressBrute(store, {
  freeRetries: 2,
  minWait: 30 * 60 * 1000, // 30 phút
  maxWait: 4 * 60 * 60 * 1000, // 4 giờ
  failCallback: function (req, res, next, nextValidRequestDate) {
    console.log(`🔐 Password reset brute force protection for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: `Quá nhiều lần reset mật khẩu. Thử lại sau: ${new Date(nextValidRequestDate).toLocaleTimeString('vi-VN')}`,
      nextValidRequestDate: nextValidRequestDate
    });
  }
});

// ===== UTILS =====

// Custom key generator cho rate limiter (kết hợp IP + User ID nếu có)
const generateKey = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.user?.id;
  return userId ? `${ip}:${userId}` : ip;
};

// Skip rate limiting cho trusted IPs (whitelist)
const skipTrustedIPs = (req) => {
  const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
  const clientIP = req.ip || req.connection.remoteAddress;
  return trustedIPs.includes(clientIP);
};

module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  createLinkLimiter,
  
  // Slow down
  authSlowDown,
  
  // Brute force protection
  loginBruteForce,
  passwordResetBruteForce,
  
  // Utils
  generateKey,
  skipTrustedIPs
};