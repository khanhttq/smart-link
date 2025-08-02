const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userRepository = require('../../users/repositories/UserRepository');
const cacheService = require('../../../core/cache/CacheService');
const jwtConfig = require('../config/jwt');
const bcrypt = require('bcryptjs');

class AuthService {
  async verifyToken(token) {
    try {
      const isBlacklisted = await cacheService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, jwtConfig.secret);
      
      if (decoded.type !== jwtConfig.tokenTypes.ACCESS) {
        throw new Error('Invalid token type');
      }

      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      const userTokenVersion = user.tokenVersion || 0;
      const decodedTokenVersion = decoded.tokenVersion || 0;
      
      if (userTokenVersion !== decodedTokenVersion) {
        console.log(`🔄 Token version mismatch: User=${userTokenVersion}, Token=${decodedTokenVersion}`);
        throw new Error('Token version mismatch - invalidated');
      }

      return this.sanitizeUser(user);
    } catch (error) {
      console.error('❌ Token verification error:', error.message);
      throw error;
    }
  }

  async createSession(user, tokens, req = {}) {
    try {
      const sessionId = crypto.randomBytes(32).toString('hex');
      
      const sessionData = {
        userId: user.id,
        email: user.email,
        tokens,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get?.('User-Agent') || 'unknown'
      };

      const sessionTTL = jwtConfig.expirationTimes.session || (7 * 24 * 60 * 60);
      await cacheService.set(`session:${sessionId}`, JSON.stringify(sessionData), sessionTTL);
      
      console.log(`📦 Created secure session: ${sessionId.substring(0, 8)}...`);
      return sessionId;
    } catch (error) {
      console.error('❌ Session creation error:', error);
      throw new Error('Failed to create session');
    }
  }
// Thêm function này vào AuthService class:
async register(userData) {
  const { email, password, name } = userData;

  try {
    console.log('👤 REGISTER SERVICE:', { email, name });

    // Validate input data
    if (!email || !password || !name) {
      throw new Error('Email, password, and name are required');
    }

    // Sanitize email
    const sanitizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Sanitize name
    const sanitizedName = name.trim();
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

    console.log('✅ USER CREATED:', user.email);

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

async login(email, password, req = {}) {
  try {
    // Normalize and validate email
    if (!email || typeof email !== 'string') {
      console.log('❌ VALIDATION: Invalid or missing email');
        throw new Error('Valid email is required');
      }
      const normalizedEmail = email.toLowerCase().trim();
      
      // Validate password presence
      if (!password || typeof password !== 'string') {
        console.log('❌ VALIDATION: Missing or invalid password');
        throw new Error('Password is required');
      }

      // ✅ Enhanced logging for login attempt
      console.log('🔑 LOGIN ATTEMPT:', { 
        email: normalizedEmail, 
        passwordProvided: !!password,
        passwordLength: password.length,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get?.('User-Agent') || 'unknown'
      });

      // Enhanced rate limiting with IP consideration
      const rateLimitKey = `login:attempt:${normalizedEmail}:${req.ip || 'unknown'}`;
      const attempts = parseInt(await cacheService.get(rateLimitKey) || 0);
      
      if (attempts >= 5) {
        console.log('❌ RATE LIMIT: Too many login attempts', { email: normalizedEmail, attempts });
        throw new Error('Too many login attempts. Please try again in 15 minutes');
      }

      // Increment rate limit counter
      await cacheService.set(rateLimitKey, attempts + 1, 15 * 60);

      // Find user by email
      console.log('🔍 SEARCHING for user:', normalizedEmail);
      const user = await userRepository.findByEmail(normalizedEmail);
      
      // ✅ Detailed user logging
      console.log('👤 USER RESULT:', { 
        userFound: !!user,
        userEmail: user?.email,
        userActive: user?.isActive,
        hasPassword: !!user?.password,
        passwordLength: user?.password?.length
      });

      if (!user) {
        console.log('❌ USER NOT FOUND in database');
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        console.log('❌ USER ACCOUNT DEACTIVATED');
        throw new Error('Account is deactivated');
      }

      // Check if user has a password (for OAuth users)
      if (!user.password) {
        console.log('❌ USER HAS NO PASSWORD (OAuth user?)');
        throw new Error('Invalid credentials');
      }

      // Validate password complexity before comparison
      if (!this.validatePassword(password)) {
        console.log('❌ PASSWORD COMPLEXITY VALIDATION FAILED');
        throw new Error('Invalid credentials');
      }

      // Password comparison
      console.log('🔐 COMPARING PASSWORDS...');
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      console.log('🔐 PASSWORD COMPARISON RESULT:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ PASSWORD MISMATCH');
        throw new Error('Invalid credentials');
      }

      // Clear rate limit on successful login
      console.log('✅ LOGIN SUCCESS - Clearing rate limit');
      await cacheService.del(rateLimitKey);
      
      // Update last seen timestamp
      await userRepository.updateLastSeen(user.id);

      // Generate tokens and create session
      console.log('🎫 GENERATING TOKENS...');
      const tokens = await this.generateTokens(user);
      
      console.log('📦 CREATING SESSION...');
      const sessionId = await this.createSession(user, tokens, req);

      console.log(`✅ LOGIN COMPLETED for user: ${user.email}`);
      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId,
      };
    } catch (error) {
      console.error('❌ LOGIN ERROR:', error.message);
      console.error('❌ LOGIN ERROR STACK:', error.stack);
      
      // Ensure rate limit isn't cleared for specific errors
      if (error.message !== 'Invalid credentials' && 
          error.message !== 'Account is deactivated' && 
          error.message !== 'Too many login attempts. Please try again in 15 minutes') {
        const rateLimitKey = `login:attempt:${email?.toLowerCase()?.trim()}:${req.ip || 'unknown'}`;
        await cacheService.del(rateLimitKey);
      }
      
      throw error;
    }
  }

  async logout(token, sessionId) {
    try {
      console.log('🚪 Enhanced logout process starting...');
      let userId = null;

      if (token) {
        try {
          const decoded = jwt.decode(token);
          userId = decoded?.userId;

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

      if (sessionId) {
        try {
          const sessionData = await cacheService.get(`session:${sessionId}`);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            
            if (session.tokens?.accessToken) {
              const decoded = jwt.decode(session.tokens.accessToken);
              if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${session.tokens.accessToken}`, 'true', ttl);
                }
              }
            }
            
            if (session.tokens?.refreshToken) {
              const decoded = jwt.decode(session.tokens.refreshToken);
              if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${session.tokens.refreshToken}`, 'true', ttl);
                }
              }
            }
            
            await cacheService.del(`session:${sessionId}`);
            console.log('🗑️ Session cleaned up');
          }
        } catch (error) {
          console.error('Error cleaning up session:', error);
        }
      }

      console.log('✅ Enhanced logout completed');
      return true;
    } catch (error) {
      console.error('❌ Enhanced logout error:', error);
      throw error;
    }
    if (userId && userEmail) {
  // ✅ CLEAR USER CACHE
      await cacheService.del(`user:id:${userId}`);
      await cacheService.del(`user:email:${userEmail}`);
      console.log('🧹 Cleared user cache');
    }
  }

  async logoutAll(userId) {
    try {
      console.log(`🚪 Enhanced logout all devices for user: ${userId}`);

      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newTokenVersion = (user.tokenVersion || 0) + 1;
      
      await userRepository.update(userId, {
        tokenVersion: newTokenVersion,
        lastSeenAt: new Date(),
        lastLogoutAt: new Date()
      });
      
      console.log(`🔄 Token version updated: ${user.tokenVersion || 0} → ${newTokenVersion}`);

      const sessionKeys = await cacheService.keys(`session:*`);
      let cleanedSessions = 0;
      
      for (const sessionKey of sessionKeys) {
        try {
          const sessionDataRaw = await cacheService.get(sessionKey);
          if (!sessionDataRaw) continue;
          
          const sessionData = JSON.parse(sessionDataRaw);
          
          if (sessionData.userId === userId) {
            if (sessionData.tokens?.accessToken) {
              const decoded = jwt.decode(sessionData.tokens.accessToken);
              if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${sessionData.tokens.accessToken}`, 'true', ttl);
                }
              }
            }
            
            if (sessionData.tokens?.refreshToken) {
              const decoded = jwt.decode(sessionData.tokens.refreshToken);
              if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${sessionData.tokens.refreshToken}`, 'true', ttl);
                }
              }
            }
            
            await cacheService.del(sessionKey);
            cleanedSessions++;
          }
        } catch (error) {
          console.error(`Error processing session ${sessionKey}:`, error);
        }
      }

      console.log(`✅ Logout all completed: ${cleanedSessions} sessions cleaned`);
      return { 
        success: true, 
        sessionsInvalidated: cleanedSessions,
        newTokenVersion 
      };
    } catch (error) {
      console.error('❌ Logout all error:', error);
      throw error;
    }
  }

  async refreshTokens(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      const isBlacklisted = await cacheService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        console.log('❌ Refresh token is blacklisted');
        throw new Error('Token has been invalidated');
      }

      const decoded = jwt.verify(refreshToken, jwtConfig.secret);
      if (decoded.type !== jwtConfig.tokenTypes.REFRESH) {
        throw new Error('Invalid token type');
      }

      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      const userTokenVersion = user.tokenVersion || 0;
      const decodedTokenVersion = decoded.tokenVersion || 0;
      
      if (userTokenVersion !== decodedTokenVersion) {
        console.log('❌ Token version mismatch');
        throw new Error('Token has been invalidated');
      }

      const oldTokenTtl = decoded.exp - Math.floor(Date.now() / 1000);
      if (oldTokenTtl > 0) {
        await cacheService.set(`blacklist:${refreshToken}`, 'true', oldTokenTtl);
        console.log('🚫 Old refresh token blacklisted');
      }

      const tokens = await this.generateTokens(user);

      console.log(`✅ Tokens refreshed for user: ${user.email}`);
      return tokens;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      
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
          // Token is invalid
        }
      }
      
      throw new Error('Invalid or expired refresh token');
    }
  }

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

  validatePassword(password) {
    if (!password || password.length < 8) {
      return false;
    }
    if (!/[a-z]/.test(password)) {
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      return false;
    }
    if (!/\d/.test(password)) {
      return false;
    }
    return true;
  }

  sanitizeUser(user) {
    const { password, tokenVersion, ...sanitized } = user.toJSON ? user.toJSON() : user;
    return sanitized;
  }
}

module.exports = new AuthService();