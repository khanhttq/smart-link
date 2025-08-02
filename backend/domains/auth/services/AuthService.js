// backend/domains/auth/services/AuthService.js - COMPLETE FILE
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userRepository = require('../../users/repositories/UserRepository');
const cacheService = require('../../../core/cache/CacheService');
const jwtConfig = require('../config/jwt');

class AuthService {
  // Find user by email - NEW METHOD FOR SMART AUTH
  async findUserByEmail(email) {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await userRepository.findByEmail(normalizedEmail);
      return user;
    } catch (error) {
      console.error('❌ Find user by email error:', error);
      return null;
    }
  }

  // Enhanced register method
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

  // Enhanced login method with specific error codes
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

      // Enhanced logging for login attempt
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
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Find user
      const user = await userRepository.findByEmail(normalizedEmail);
      
      console.log('🔍 USER LOOKUP RESULT:', {
        found: !!user,
        userEmail: user?.email,
        userActive: user?.isActive,
        hasPassword: !!user?.password,
        passwordLength: user?.password?.length
      });

      if (!user) {
        console.log('❌ USER NOT FOUND in database');
        // Tăng rate limit counter cho attempt thất bại
        await cacheService.set(rateLimitKey, attempts + 1, 900); // 15 minutes
        throw new Error('USER_NOT_FOUND'); // Specific error code for smart auth
      }

      if (!user.isActive) {
        console.log('❌ USER ACCOUNT DEACTIVATED');
        throw new Error('ACCOUNT_DEACTIVATED');
      }

      // Check if user has a password (for OAuth users)
      if (!user.password) {
        console.log('❌ USER HAS NO PASSWORD (OAuth user?)');
        throw new Error('OAUTH_USER_NO_PASSWORD');
      }

      // Validate password complexity before comparison
      if (!this.validatePassword(password)) {
        console.log('❌ PASSWORD COMPLEXITY VALIDATION FAILED');
        await cacheService.set(rateLimitKey, attempts + 1, 900);
        throw new Error('INVALID_PASSWORD');
      }

      // Password comparison
      console.log('🔐 COMPARING PASSWORDS...');
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      console.log('🔐 PASSWORD COMPARISON RESULT:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ PASSWORD MISMATCH');
        await cacheService.set(rateLimitKey, attempts + 1, 900);
        throw new Error('INVALID_PASSWORD');
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
      throw error; // Preserve original error for frontend handling
    }
  }

  // Google login method
  async googleLogin(googleUser) {
    try {
      console.log('🌐 Google login attempt:', googleUser.email);

      let user = await userRepository.findByEmail(googleUser.email);

      if (!user) {
        // Create new user from Google data
        user = await userRepository.create({
          email: googleUser.email.toLowerCase(),
          name: googleUser.name,
          avatar: googleUser.picture,
          role: 'user',
          isActive: true,
          isEmailVerified: true, // Google accounts are pre-verified
          googleId: googleUser.id,
          // No password for OAuth users
        });

        console.log('✅ New Google user created:', user.email);
      } else {
        // Update existing user with Google data if needed
        if (!user.googleId && googleUser.id) {
          await userRepository.update(user.id, {
            googleId: googleUser.id,
            avatar: googleUser.picture || user.avatar,
            isEmailVerified: true
          });
        }

        if (!user.isActive) {
          throw new Error('Account is deactivated');
        }

        console.log('✅ Existing Google user login:', user.email);
      }

      // Update last seen
      await userRepository.updateLastSeen(user.id);

      // Generate tokens and create session
      const tokens = await this.generateTokens(user);
      const sessionId = await this.createSession(user, tokens);

      return {
        user: this.sanitizeUser(user),
        tokens,
        sessionId,
      };
    } catch (error) {
      console.error('❌ Google login error:', error);
      throw error;
    }
  }

  // Token verification
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

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      console.log('🔄 Refreshing token...');

      const isBlacklisted = await cacheService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new Error('Refresh token has been revoked');
      }

      const decoded = jwt.verify(refreshToken, jwtConfig.secret);

      if (decoded.type !== jwtConfig.tokenTypes.REFRESH) {
        throw new Error('Invalid token type');
      }

      const user = await userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const userTokenVersion = user.tokenVersion || 0;
      const decodedTokenVersion = decoded.tokenVersion || 0;
      
      if (userTokenVersion !== decodedTokenVersion) {
        console.log(`🔄 Refresh token version mismatch: User=${userTokenVersion}, Token=${decodedTokenVersion}`);
        throw new Error('Token version mismatch - invalidated');
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - currentTime;

      if (timeUntilExpiry < 0) {
        throw new Error('Refresh token has expired');
      }

      if (timeUntilExpiry > 0) {
        await cacheService.set(`blacklist:${refreshToken}`, 'true', timeUntilExpiry);
      }

      const tokens = await this.generateTokens(user);
      await userRepository.updateLastSeen(user.id);

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

  // Generate tokens
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

  // Enhanced logout
  async logout(token, sessionId = null) {
    try {
      console.log('🚪 Enhanced logout process starting...');

      let userId, userEmail;

      // Process access token
      if (token) {
        try {
          const decoded = jwt.decode(token);
          userId = decoded?.userId;
          userEmail = decoded?.email;

          if (decoded?.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
              await cacheService.set(`blacklist:${token}`, 'true', ttl);
              console.log('🚫 Access token blacklisted');
            }
          }
        } catch (error) {
          console.log('⚠️ Token decode error during logout:', error.message);
        }
      }

      // Clear session
      if (sessionId) {
        try {
          const sessionData = await cacheService.get(`session:${sessionId}`);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            userId = userId || session.userId;
            userEmail = userEmail || session.email;

            // Blacklist refresh token from session
            if (session.tokens?.refreshToken) {
              const refreshDecoded = jwt.decode(session.tokens.refreshToken);
              if (refreshDecoded?.exp) {
                const ttl = refreshDecoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                  await cacheService.set(`blacklist:${session.tokens.refreshToken}`, 'true', ttl);
                  console.log('🚫 Refresh token blacklisted');
                }
              }
            }
          }

          await cacheService.del(`session:${sessionId}`);
          console.log('🗑️ Session deleted');
        } catch (error) {
          console.log('⚠️ Error cleaning up session:', error);
        }
      }

      // Clear user cache
      if (userId && userEmail) {
        await cacheService.del(`user:id:${userId}`);
        await cacheService.del(`user:email:${userEmail}`);
        console.log('🧹 Cleared user cache');
      }

      // Update user last logout timestamp
      if (userId) {
        try {
          await userRepository.update(userId, {
            lastLogoutAt: new Date()
          });
        } catch (error) {
          console.log('⚠️ Error updating logout timestamp:', error);
        }
      }

      console.log('✅ Enhanced logout completed');
      return true;
    } catch (error) {
      console.error('❌ Enhanced logout error:', error);
      throw error;
    }
  }

  // Logout from all devices
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

      // Clean up all user sessions
      const sessionKeys = await cacheService.keys(`session:*`);
      let cleanedSessions = 0;
      
      for (const sessionKey of sessionKeys) {
        try {
          const sessionDataRaw = await cacheService.get(sessionKey);
          if (!sessionDataRaw) continue;
          
          const sessionData = JSON.parse(sessionDataRaw);
          
          if (sessionData.userId === userId) {
            // Blacklist tokens from this session
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
          console.log('⚠️ Error processing session:', sessionKey, error.message);
        }
      }

      // Clear user cache
      await cacheService.del(`user:id:${userId}`);
      await cacheService.del(`user:email:${user.email}`);

      console.log(`✅ Logout all completed: ${cleanedSessions} sessions cleaned`);
      return { sessionsCleaned: cleanedSessions };
    } catch (error) {
      console.error('❌ Logout all error:', error);
      throw error;
    }
  }

  // Password validation
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

  // Sanitize user data
  sanitizeUser(user) {
    const { password, tokenVersion, ...sanitized } = user.toJSON ? user.toJSON() : user;
    return sanitized;
  }
}

module.exports = new AuthService();