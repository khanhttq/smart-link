// domains/auth/services/AuthService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userRepository = require('../../users/repositories/UserRepository');
const cacheService = require('../../../core/cache/CacheService');
const jwtConfig = require('../config/jwt');

class AuthService {
  // Register new user
  async register(userData) {
    const { email, password, name } = userData;

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Validate password strength
    if (!this.validatePassword(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
    }

    // Create user (password will be hashed in User model hook)
    const user = await userRepository.create({
      email,
      password,
      name,
      role: 'user',
      isActive: true,
      isEmailVerified: false
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Create session
    const sessionId = await this.createSession(user, tokens);

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId
    };
  }

  // Login user
  async login(email, password) {
    // Find user
    const user = await userRepository.findByEmail(email);
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

    // Update last seen
    await userRepository.updateLastSeen(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Create session
    const sessionId = await this.createSession(user, tokens);

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId
    };
  }

  // Google OAuth login
  async googleLogin(googleUserData) {
    const { id: googleId, email, name, picture } = googleUserData;

    // Check if user exists
    let user = await userRepository.findByGoogleId(googleId);
    
    if (!user) {
      // Check if user exists with same email
      user = await userRepository.findByEmail(email);
      
      if (user) {
        // Link Google account to existing user
        user = await userRepository.update(user.id, {
          googleId,
          avatar: picture
        });
      } else {
        // Create new user
        user = await userRepository.create({
          email,
          name,
          googleId,
          avatar: picture,
          role: 'user',
          isActive: true,
          isEmailVerified: true, // Google accounts are pre-verified
          password: null // No password for OAuth users
        });
      }
    } else {
      // Update existing Google user
      await userRepository.updateLastSeen(user.id);
      
      // Update avatar if changed
      if (user.avatar !== picture) {
        user = await userRepository.update(user.id, { avatar: picture });
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Create session
    const sessionId = await this.createSession(user, tokens);

    return {
      user: this.sanitizeUser(user),
      tokens,
      sessionId
    };
  }

  // Generate JWT tokens
  async generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: jwtConfig.tokenTypes.ACCESS
    };

    const accessToken = jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expirationTimes.access,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });

    const refreshPayload = {
      userId: user.id,
      type: jwtConfig.tokenTypes.REFRESH
    };

    const refreshToken = jwt.sign(refreshPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expirationTimes.refresh,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.expirationTimes.access
    };
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
      });

      // Check if token is blacklisted
      const isBlacklisted = await cacheService.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Get user
      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return { user, decoded };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // Refresh tokens
  async refreshTokens(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.secret);
      
      if (decoded.type !== jwtConfig.tokenTypes.REFRESH) {
        throw new Error('Invalid refresh token');
      }

      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Create session
  async createSession(user, tokens) {
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    
    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    // Store session in Redis (7 days)
    await cacheService.setUserSession(sessionId, sessionData, 7 * 24 * 60 * 60);

    return sessionId;
  }

  // Get session
  async getSession(sessionId) {
    return await cacheService.getUserSession(sessionId);
  }

  // Logout
  async logout(token, sessionId) {
    // Blacklist access token
    await this.blacklistToken(token);

    // Remove session
    if (sessionId) {
      await cacheService.deleteUserSession(sessionId);
    }

    return true;
  }

  // Logout all sessions
  async logoutAll(userId) {
    // Get all user sessions
    const sessions = await cacheService.redis.keys(`session:*`);
    
    for (const sessionKey of sessions) {
      const sessionData = await cacheService.get(sessionKey);
      if (sessionData && sessionData.userId === userId) {
        // Blacklist access token
        await this.blacklistToken(sessionData.accessToken);
        // Remove session
        await cacheService.redis.del(sessionKey);
      }
    }

    return true;
  }

  // Blacklist token
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await cacheService.set(`blacklist:${token}`, true, ttl);
        }
      }
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  // Validate password strength
  validatePassword(password) {
    if (!password || password.length < 8) return false;
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    return hasUpper && hasLower && hasNumber;
  }

  // Sanitize user data for response
  sanitizeUser(user) {
    const sanitized = user.toJSON ? user.toJSON() : user;
    delete sanitized.password;
    return sanitized;
  }
}

module.exports = new AuthService();