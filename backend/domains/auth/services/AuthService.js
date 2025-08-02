// backend/domains/auth/services/AuthService.js - FIXED VERSION
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const userRepository = require('../../users/repositories/UserRepository');
const cacheService = require('../../../core/cache/CacheService');
const jwtConfig = require('../config/jwt');

class AuthService {
  // Register new user
  async register(userData) {
    const { email, password, name } = userData;

    try {
      // Validate input data
      if (!email || !password || !name) {
        throw new Error('Email, password, and name are required');
      }

      // Sanitize and validate email
      const sanitizedEmail = validator.normalizeEmail(email.toLowerCase().trim());
      if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }

      // Sanitize name
      const sanitizedName = name.trim().replace(/[^a-zA-Z0-9\s-]/g, '');
      if (sanitizedName.length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }

      // Validate password strength
      if (!this.validatePassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
      }

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(sanitizedEmail);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Create user (password will be hashed in User model hook)
      const user = await userRepository.create({
        email: sanitizedEmail,
        password,
        name: sanitizedName,
        role: 'user',
        isActive: true,
        isEmailVerified: false,
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Create session
      const sessionId = await this.createSession(user, tokens);

      console.log(`✅ User registered successfully: ${user.email}`);
      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId,
      };
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Rate limiting check
      const rateLimitKey = `login:attempt:${email.toLowerCase()}`;
      const attempts = (await cacheService.get(rateLimitKey)) || 0;
      if (attempts >= 5) {
        throw new Error('Too many login attempts, please try again later');
      }

      // Increment attempt counter (expires in 15 minutes)
      await cacheService.set(rateLimitKey, parseInt(attempts) + 1, 15 * 60);

      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user
      const user = await userRepository.findByEmail(email.toLowerCase());
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Clear rate limit on successful login
      await cacheService.del(rateLimitKey);
      console.log(`🗑️ Cleared rate limit key: ${rateLimitKey}`);

      // Update last seen
      await userRepository.updateLastSeen(user.id);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Create session
      const sessionId = await this.createSession(user, tokens);

      console.log(`✅ User logged in successfully: ${user.email}`);
      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId,
      };
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // ===== FIX: Enhanced logout with proper cleanup =====
  async logout(token, sessionId) {
    try {
      console.log('🚪 Logging out user...');
      let userId = null;
      let userEmail = null;

      // Get user ID from token before blacklisting
      if (token) {
        try {
          const decoded = jwt.decode(token);
          userId = decoded?.userId;
          userEmail = decoded?.email;

          // Blacklist the token
          if (decoded && decoded.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
              await cacheService.set(`blacklist:${token}`, 'true', ttl);
              console.log('🚫 Token blacklisted');
            }
          }
        } catch (error) {
          console.error('Error processing token:', error);
        }
      }

      // Remove session
      if (sessionId) {
        try {
          await cacheService.del(`session:${sessionId}`);
          console.log('🗑️ Session removed:', `session:${sessionId}`);
        } catch (error) {
          console.error('Error removing session:', error);
        }
      }

      console.log('✅ Logout completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }

  // ===== FIX: Better refresh token handling =====
  async refreshTokens(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Check if refresh token is blacklisted first
      const isBlacklisted = await cacheService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        console.log('❌ Refresh token is blacklisted');
        throw new Error('Token has been invalidated');
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, jwtConfig.secret);
      if (decoded.type !== jwtConfig.tokenTypes.REFRESH) {
        throw new Error('Invalid token type');
      }

      // Find user
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // ===== FIX: Check token version if exists =====
      if (user.tokenVersion !== undefined && decoded.tokenVersion !== undefined) {
        if (decoded.tokenVersion !== user.tokenVersion) {
          console.log('❌ Token version mismatch');
          throw new Error('Token has been invalidated');
        }
      }

      // ===== FIX: Blacklist old refresh token immediately =====
      const oldTokenTtl = decoded.exp - Math.floor(Date.now() / 1000);
      if (oldTokenTtl > 0) {
        await cacheService.set(`blacklist:${refreshToken}`, 'true', oldTokenTtl);
        console.log('🚫 Old refresh token blacklisted');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      console.log(`✅ Tokens refreshed for user: ${user.email}`);
      return tokens;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      
      // ===== FIX: Blacklist invalid refresh token =====
      if (refreshToken) {
        try {
          const decoded = jwt.decode(refreshToken);
          if (decoded && decoded.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
              await cacheService.set(`blacklist:${refreshToken}`, 'true', ttl);
              console.log('🚫 Invalid refresh token blacklisted');
            }
          }
        } catch (decodeError) {
          // Token is completely invalid, can't decode
        }
      }
      
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Generate JWT tokens with better payload
  async generateTokens(user) {
    const now = Math.floor(Date.now() / 1000);
    const tokenVersion = user.tokenVersion || 0;

    const accessPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion,
      type: jwtConfig.tokenTypes.ACCESS,
      iat: now
    };

    const refreshPayload = {
      userId: user.id,
      tokenVersion,
      type: jwtConfig.tokenTypes.REFRESH,
      iat: now
    };

    const accessToken = jwt.sign(accessPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expirationTimes.access,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    const refreshToken = jwt.sign(refreshPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expirationTimes.refresh,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.expirationTimes.access,
    };
  }

  // Create session
  async createSession(user, tokens) {
    const sessionId = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sessionData = {
      userId: user.id,
      email: user.email,
      tokens,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Store session with configurable TTL
    await cacheService.set(`session:${sessionId}`, JSON.stringify(sessionData), jwtConfig.expirationTimes.session);
    console.log(`📦 Created session: session:${sessionId}`);

    return sessionId;
  }

  // ===== FIX: Enhanced token verification =====
  async verifyToken(token) {
    try {
      // Check if token is blacklisted first
      const isBlacklisted = await cacheService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Verify token
      const decoded = jwt.verify(token, jwtConfig.secret);
      if (decoded.type !== jwtConfig.tokenTypes.ACCESS) {
        throw new Error('Invalid token type');
      }

      // Find user
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Check token version if exists
      if (user.tokenVersion !== undefined && decoded.tokenVersion !== undefined) {
        if (decoded.tokenVersion !== user.tokenVersion) {
          throw new Error('Token has been invalidated');
        }
      }

      return this.sanitizeUser(user);
    } catch (error) {
      console.error('❌ Token verification error:', error);
      throw error;
    }
  }

  // Logout from all devices
  async logoutAll(userId) {
    try {
      console.log(`🚪 Logging out user ${userId} from all devices...`);

      // Update token version to invalidate all tokens
      const user = await userRepository.findById(userId);
      if (user) {
        await userRepository.update(userId, {
          tokenVersion: (user.tokenVersion || 0) + 1,
          lastSeenAt: new Date(),
        });
        console.log('🔄 Token version updated');
      }

      // Get all sessions for this user and blacklist their tokens
      const sessionKeys = await cacheService.keys(`session:*`);
      console.log(`🔍 Found ${sessionKeys.length} session keys`);
      
      for (const sessionKey of sessionKeys) {
        try {
          const sessionDataRaw = await cacheService.get(sessionKey);
          const sessionData = sessionDataRaw ? JSON.parse(sessionDataRaw) : null;
          
          if (sessionData && sessionData.userId === userId) {
            // Blacklist tokens if they exist
            if (sessionData.tokens?.accessToken) {
              const decoded = jwt.decode(sessionData.tokens.accessToken);
              if (decoded && decoded.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${sessionData.tokens.accessToken}`, 'true', ttl);
                }
              }
            }
            
            if (sessionData.tokens?.refreshToken) {
              const decoded = jwt.decode(sessionData.tokens.refreshToken);
              if (decoded && decoded.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${sessionData.tokens.refreshToken}`, 'true', ttl);
                }
              }
            }
            
            // Remove session
            await cacheService.del(sessionKey);
            console.log(`🗑️ Cleared session: ${sessionKey}`);
          }
        } catch (error) {
          console.error(`Error processing session ${sessionKey}:`, error);
        }
      }

      console.log(`✅ Logout all completed for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Logout all error:', error);
      throw error;
    }
  }

  // Validate password strength
  validatePassword(password) {
    if (!password || password.length < 8) {
      return false;
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return false;
    }

    return true;
  }

  // Sanitize user data (remove sensitive fields)
  sanitizeUser(user) {
    const { password, tokenVersion, ...sanitized } = user.toJSON ? user.toJSON() : user;
    return sanitized;
  }
}

module.exports = new AuthService();