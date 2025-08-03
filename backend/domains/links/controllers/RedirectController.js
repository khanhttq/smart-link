// backend/domains/links/controllers/RedirectController.js - FIXED METHOD BINDING
const linkService = require('../services/LinkService');
const domainService = require('../services/DomainService');

class RedirectController {
  
  /**
   * GET /:shortCode - Universal redirect handler
   * Handles both system domain and custom domain redirects
   */
  handleRedirect = async (req, res) => {  // ✅ Arrow function để bind this
    try {
      const { shortCode } = req.params;
      const hostDomain = req.get('Host');
      const userAgent = req.get('User-Agent') || '';
      
      console.log(`🔗 Redirect request: ${hostDomain}/${shortCode}`);
      
      // ✅ FIX 1: Handle favicon.ico and other static files
      if (shortCode === 'favicon.ico' || shortCode.includes('.')) {
        return res.status(404).json({
          success: false,
          message: 'Not found',
          shortCode: shortCode
        });
      }
      
      // ✅ FIX 2: Validate shortCode format early
      if (!this.isValidShortCode(shortCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid short code format',
          shortCode: shortCode
        });
      }
      
      // Extract domain name (remove port if present)
      const domainName = hostDomain ? 
        hostDomain.split(':')[0].toLowerCase() : null;
      
      // Determine if this is a custom domain or system domain
      let targetDomain = null;
      const systemDomain = (process.env.SYSTEM_DOMAIN || 'localhost').split(':')[0].toLowerCase();
      
      if (domainName && domainName !== systemDomain) {
        // This is potentially a custom domain request
        targetDomain = await domainService.getDomainByName(domainName);
        
        if (!targetDomain) {
          return this.handleDomainNotFound(res, domainName, shortCode);
        }
      }
      
      // Collect click data
      const clickData = {
        ipAddress: this.getClientIP(req),
        userAgent: userAgent,
        referrer: req.get('Referer') || null,
        timestamp: new Date()
      };
      
      // ✅ FIX 3: Ensure method binding with proper context
      const userLocation = await this.getUserLocation(clickData.ipAddress);
      
      // Process click and get redirect info
      const result = await linkService.processClick(
        shortCode, 
        targetDomain?.domain || null, 
        clickData, 
        userLocation
      );

      if (!result) {
        return this.handleLinkNotFound(res, shortCode, domainName);
      }
      
      // Handle special cases
      if (result.blocked) {
        return this.handleBlockedLink(res, result, shortCode);
      }
      
      if (result.passwordRequired) {
        return this.handlePasswordProtected(res, result, shortCode);
      }

      // Log successful click
      console.log(`✅ Click processed: ${domainName || systemDomain}/${shortCode} -> ${result.originalUrl}`);

      // Handle bot traffic differently
      if (this.isBot(userAgent)) {
        return this.handleBotTraffic(res, result, shortCode);
      }

      // Perform redirect
      res.redirect(302, result.originalUrl);

    } catch (error) {
      console.error('❌ Redirect error:', error);
      return this.handleInternalError(res, error);
    }
  }

  /**
   * GET /preview/:shortCode - Preview link without redirect
   */
  preview = async (req, res) => {  // ✅ Arrow function
    try {
      const { shortCode } = req.params;
      const hostDomain = req.get('Host');
      const domainName = hostDomain ? 
        hostDomain.split(':')[0].toLowerCase() : null;
      
      // ✅ FIX 4: Add validation for preview as well
      if (!this.isValidShortCode(shortCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid short code format',
          shortCode: shortCode
        });
      }
      
      // Determine target domain
      let targetDomain = null;
      const systemDomain = (process.env.SYSTEM_DOMAIN || 'localhost').split(':')[0].toLowerCase();
      
      if (domainName && domainName !== systemDomain) {
        targetDomain = await domainService.getDomainByName(domainName);
      }
      
      const link = await linkService.getLinkByShortCode(
        shortCode, 
        targetDomain?.domain || null
      );

      if (!link) {
        return res.status(404).json({
          success: false,
          message: 'Link not found',
          shortCode: shortCode,
          domain: domainName
        });
      }

      // Build preview data
      const previewData = {
        shortCode: shortCode,
        shortUrl: link.fullShortUrl,
        originalUrl: link.originalUrl,
        title: link.title || 'Untitled Link',
        description: link.description || null,
        domain: {
          name: link.domain?.domain || 'system',
          displayName: link.domain?.displayName || 'System Domain'
        },
        stats: {
          clicks: link.clickCount,
          uniqueClicks: link.uniqueClicks,
          createdAt: link.createdAt
        },
        metadata: link.urlMetadata || {},
        isActive: link.isActive,
        isExpired: link.isExpired(),
        requiresPassword: !!link.password,
        hasGeoRestrictions: !!(link.geoRestrictions && Object.keys(link.geoRestrictions).length > 0)
      };

      res.json({
        success: true,
        data: previewData
      });

    } catch (error) {
      console.error('❌ Preview error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to preview link'
      });
    }
  }

  /**
   * POST /:shortCode/password - Handle password-protected links
   */
  handlePasswordSubmission = async (req, res) => {  // ✅ Arrow function
    try {
      const { shortCode } = req.params;
      const { password } = req.body;
      const hostDomain = req.get('Host');
      const domainName = hostDomain ? 
        hostDomain.split(':')[0].toLowerCase() : null;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required'
        });
      }
      
      // ✅ FIX 5: Add validation here too
      if (!this.isValidShortCode(shortCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid short code format',
          shortCode: shortCode
        });
      }
      
      // Determine target domain
      let targetDomain = null;
      const systemDomain = (process.env.SYSTEM_DOMAIN || 'localhost').split(':')[0].toLowerCase();
      
      if (domainName && domainName !== systemDomain) {
        targetDomain = await domainService.getDomainByName(domainName);
      }
      
      // Collect click data with password
      const clickData = {
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent') || '',
        referrer: req.get('Referer') || null,
        timestamp: new Date(),
        password: password,
        passwordProvided: true
      };
      
      const userLocation = await this.getUserLocation(clickData.ipAddress);
      
      const result = await linkService.processClick(
        shortCode, 
        targetDomain?.domain || null, 
        clickData, 
        userLocation
      );
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Link not found'
        });
      }
      
      if (result.passwordRequired) {
        return res.status(401).json({
          success: false,
          message: result.error || 'Invalid password',
          passwordRequired: true
        });
      }
      
      if (result.blocked) {
        return res.status(403).json({
          success: false,
          message: result.reason === 'expired' ? 
            'Link has expired' : 'Access blocked',
          blocked: true,
          reason: result.reason
        });
      }
      
      // Success - return redirect URL
      res.json({
        success: true,
        redirectUrl: result.originalUrl,
        message: 'Password verified successfully'
      });

    } catch (error) {
      console.error('❌ Password submission error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to process password'
      });
    }
  }

  // ===== ERROR HANDLERS =====

  /**
   * Handle domain not found
   */
  handleDomainNotFound = (res, domainName, shortCode) => {  // ✅ Arrow function
    console.log(`❌ Domain not found: ${domainName}`);
    
    return res.status(404).json({
      success: false,
      message: 'Domain not found or not configured',
      domain: domainName,
      shortCode: shortCode,
      suggestion: 'Please check domain configuration'
    });
  }

  /**
   * Handle link not found
   */
  handleLinkNotFound = (res, shortCode, domainName) => {  // ✅ Arrow function
    console.log(`❌ Link not found: ${domainName || 'system'}/${shortCode}`);
    
    return res.status(404).json({
      success: false,
      message: 'Link not found or inactive',
      shortCode: shortCode,
      domain: domainName || 'system'
    });
  }

  /**
   * Handle blocked links
   */
  handleBlockedLink = (res, result, shortCode) => {  // ✅ Arrow function
    const statusCode = result.reason === 'expired' ? 410 : 403;
    const message = result.reason === 'expired' 
      ? 'This link has expired' 
      : 'Access to this link is restricted';
    
    console.log(`🚫 Link blocked: ${shortCode} - ${result.reason}`);
    
    return res.status(statusCode).json({
      success: false,
      message: message,
      blocked: true,
      reason: result.reason,
      shortCode: shortCode
    });
  }

  /**
   * Handle password-protected links
   */
  handlePasswordProtected = (res, result, shortCode) => {  // ✅ Arrow function
    console.log(`🔒 Password required: ${shortCode}`);
    
    return res.status(401).json({
      success: false,
      message: 'This link is password protected',
      passwordRequired: true,
      shortCode: shortCode,
      link: result.link,
      error: result.error || null
    });
  }

  /**
   * Handle bot traffic
   */
  handleBotTraffic = (res, result, shortCode) => {  // ✅ Arrow function
    console.log(`🤖 Bot detected: ${shortCode}`);
    
    // For bots, return link info instead of redirecting
    return res.json({
      success: true,
      message: 'Link information for bot',
      shortCode: shortCode,
      originalUrl: result.originalUrl,
      title: result.link.title,
      isBot: true
    });
  }

  /**
   * Handle internal errors
   */
  handleInternalError = (res, error) => {  // ✅ Arrow function
    console.log('❌ Internal error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Redirect service temporarily unavailable'
    });
  }

  // ===== HELPER METHODS =====

  /**
   * Get client IP address
   */
  getClientIP = (req) => {  // ✅ Arrow function
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? 
             req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  /**
   * Get user location from IP (basic implementation)
   */
  getUserLocation = async (ipAddress) => {  // ✅ Arrow function
    try {
      // In production, you'd use a GeoIP service like MaxMind or ipapi
      // For now, return null (no location data)
      return null;
      
      /* Example with ipapi:
      const axios = require('axios');
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}`);
      if (response.data.status === 'success') {
        return {
          country: response.data.countryCode,
          city: response.data.city,
          region: response.data.regionName
        };
      }
      */
    } catch (error) {
      console.log('Failed to get user location:', error.message);
      return null;
    }
  }

  /**
   * Detect if user agent is a bot
   */
  isBot = (userAgent) => {  // ✅ Arrow function
    if (!userAgent) return false;
    
    const botPatterns = [
      'bot', 'crawler', 'spider', 'scraper',
      'googlebot', 'bingbot', 'yahoobot',
      'facebookexternalhit', 'twitterbot',
      'linkedinbot', 'whatsapp', 'telegram'
    ];
    
    const ua = userAgent.toLowerCase();
    return botPatterns.some(pattern => ua.includes(pattern));
  }

  /**
   * Validate shortCode format
   */
  isValidShortCode = (shortCode) => {  // ✅ Arrow function
    return /^[a-zA-Z0-9_-]+$/.test(shortCode) && shortCode.length >= 1 && shortCode.length <= 50;
  }
}

// ✅ FIX 6: Export the class correctly to maintain method binding
module.exports = new RedirectController();