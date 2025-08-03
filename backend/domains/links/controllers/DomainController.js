// backend/domains/links/controllers/DomainController.js
const domainService = require('../services/DomainService');

// ✅ Unified error codes
const ERROR_CODES = {
  DOMAIN_NOT_FOUND: 'DOMAIN_NOT_FOUND',
  DOMAIN_EXISTS: 'DOMAIN_EXISTS',
  DOMAIN_INVALID: 'DOMAIN_INVALID',
  DOMAIN_NOT_VERIFIED: 'DOMAIN_NOT_VERIFIED',
  DOMAIN_UNAUTHORIZED: 'DOMAIN_UNAUTHORIZED',
  DOMAIN_HAS_LINKS: 'DOMAIN_HAS_LINKS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// ✅ Standardized response helpers
const sendErrorResponse = (res, statusCode, errorCode, message, details = null) => {
  const response = {
    success: false,
    code: errorCode,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }
  
  console.error(`❌ Domain Error [${statusCode}]:`, { code: errorCode, message });
  return res.status(statusCode).json(response);
};

const sendSuccessResponse = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    response.data = data;
  }
  
  console.log(`✅ Domain Success [${statusCode}]:`, message);
  return res.status(statusCode).json(response);
};

class DomainController {

  /**
   * POST /api/domains - Add new domain
   */
  async addDomain(req, res) {
    try {
      const userId = req.user.id;
      const { domain, displayName } = req.body;

      // Validation
      if (!domain) {
        return sendErrorResponse(
          res, 
          400, 
          ERROR_CODES.VALIDATION_ERROR, 
          'Domain is required'
        );
      }

      const result = await domainService.addDomain(userId, {
        domain: domain.trim(),
        displayName: displayName?.trim()
      });

      return sendSuccessResponse(
        res,
        'Domain added successfully. Please configure DNS records to verify ownership.',
        result,
        201
      );

    } catch (error) {
      console.error('❌ Add domain error:', error);
      
      if (error.message.includes('Invalid domain format')) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.DOMAIN_INVALID,
          'Invalid domain format. Please use format: example.com'
        );
      }
      
      if (error.message.includes('already registered')) {
        return sendErrorResponse(
          res,
          409,
          ERROR_CODES.DOMAIN_EXISTS,
          'Domain already registered in the system'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to add domain',
        error.stack
      );
    }
  }

  /**
   * GET /api/domains - Get user domains
   */
  async getUserDomains(req, res) {
    try {
      const userId = req.user.id;
      const {
        limit = 20,
        offset = 0,
        includeInactive = 'true'
      } = req.query;

      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        includeInactive: includeInactive === 'true'
      };

      const result = await domainService.getUserDomains(userId, options);

      return sendSuccessResponse(
        res,
        'Domains retrieved successfully',
        result
      );

    } catch (error) {
      console.error('❌ Get domains error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve domains',
        error.stack
      );
    }
  }

  /**
   * GET /api/domains/:id - Get domain details
   */
  async getDomain(req, res) {
    try {
      const userId = req.user.id;
      const domainId = req.params.id;

      const result = await domainService.getDomainStats(domainId, userId);

      return sendSuccessResponse(
        res,
        'Domain details retrieved successfully',
        result
      );

    } catch (error) {
      console.error('❌ Get domain error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.DOMAIN_NOT_FOUND,
          'Domain not found or unauthorized'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve domain details',
        error.stack
      );
    }
  }

  /**
   * POST /api/domains/:id/verify - Verify domain ownership
   */
  async verifyDomain(req, res) {
    try {
      const userId = req.user.id;
      const domainId = req.params.id;

      const result = await domainService.verifyDomain(domainId, userId);

      if (result.verified) {
        return sendSuccessResponse(
          res,
          result.message,
          {
            domain: result.domain,
            verifiedAt: result.domain.verifiedAt
          }
        );
      } else {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.DOMAIN_NOT_VERIFIED,
          result.error || 'Domain verification failed',
          result.instructions
        );
      }

    } catch (error) {
      console.error('❌ Verify domain error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.DOMAIN_NOT_FOUND,
          'Domain not found or unauthorized'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to verify domain',
        error.stack
      );
    }
  }

  /**
   * PUT /api/domains/:id - Update domain settings
   */
  async updateDomain(req, res) {
    try {
      const userId = req.user.id;
      const domainId = req.params.id;
      const updateData = req.body;

      // Validate input
      const allowedFields = [
        'displayName',
        'isActive',
        'monthlyLinkLimit',
        'customFavicon',
        'customLandingPage',
        'analyticsCode'
      ];

      const filteredData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'No valid fields to update'
        );
      }

      const updatedDomain = await domainService.updateDomain(domainId, userId, filteredData);

      return sendSuccessResponse(
        res,
        'Domain updated successfully',
        { domain: updatedDomain }
      );

    } catch (error) {
      console.error('❌ Update domain error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.DOMAIN_NOT_FOUND,
          'Domain not found or unauthorized'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to update domain',
        error.stack
      );
    }
  }

  /**
   * DELETE /api/domains/:id - Delete domain
   */
  async deleteDomain(req, res) {
    try {
      const userId = req.user.id;
      const domainId = req.params.id;

      await domainService.deleteDomain(domainId, userId);

      return sendSuccessResponse(
        res,
        'Domain deleted successfully'
      );

    } catch (error) {
      console.error('❌ Delete domain error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.DOMAIN_NOT_FOUND,
          'Domain not found or unauthorized'
        );
      }
      
      if (error.message.includes('active links')) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.DOMAIN_HAS_LINKS,
          error.message
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to delete domain',
        error.stack
      );
    }
  }

  /**
   * GET /api/domains/:id/verification - Get verification instructions
   */
  async getVerificationInstructions(req, res) {
    try {
      const userId = req.user.id;
      const domainId = req.params.id;

      // Get domain to ensure ownership
      const result = await domainService.getDomainStats(domainId, userId);
      const domain = result.domain;

      if (domain.isVerified) {
        return sendSuccessResponse(
          res,
          'Domain already verified',
          {
            domain: domain,
            status: 'verified',
            verifiedAt: domain.verifiedAt
          }
        );
      }

      // Generate fresh verification instructions
      const instructions = {
        domain: domain.domain,
        verificationToken: domain.verificationToken,
        dnsRecords: domain.dnsRecords,
        steps: [
          {
            step: 1,
            title: 'Add DNS TXT Record',
            description: 'Add this TXT record to verify domain ownership',
            record: {
              type: 'TXT',
              name: `_shortlink-verify.${domain.domain}`,
              value: domain.verificationToken,
              ttl: 300
            }
          },
          {
            step: 2,
            title: 'Point Domain to Our Servers',
            description: 'Choose one of these options',
            options: [
              {
                method: 'CNAME (Recommended)',
                record: {
                  type: 'CNAME',
                  name: domain.domain,
                  value: process.env.SYSTEM_DOMAIN || 'shortlink.com',
                  ttl: 300
                }
              },
              {
                method: 'A Record (Alternative)',
                record: {
                  type: 'A',
                  name: domain.domain,
                  value: process.env.SERVER_IP || '1.2.3.4',
                  ttl: 300
                }
              }
            ]
          },
          {
            step: 3,
            title: 'Verify Domain',
            description: 'Click verify button after DNS configuration'
          }
        ],
        notes: [
          'DNS changes can take up to 24 hours to propagate',
          'You can verify immediately once TXT record is visible',
          'Domain activation requires both verification and DNS pointing'
        ]
      };

      return sendSuccessResponse(
        res,
        'Verification instructions retrieved',
        instructions
      );

    } catch (error) {
      console.error('❌ Get verification instructions error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.DOMAIN_NOT_FOUND,
          'Domain not found or unauthorized'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to get verification instructions',
        error.stack
      );
    }
  }

  /**
   * GET /api/domains/available - Check domain availability
   */
  async checkAvailability(req, res) {
    try {
      const { domain } = req.query;

      if (!domain) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Domain parameter is required'
        );
      }

      // Check if domain is valid format
      if (!domainService.isValidDomain(domain)) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.DOMAIN_INVALID,
          'Invalid domain format'
        );
      }

      // Check if domain exists
      const existingDomain = await domainService.getDomainByName(domain);
      
      return sendSuccessResponse(
        res,
        'Domain availability checked',
        {
          domain: domain.toLowerCase().trim(),
          available: !existingDomain,
          reason: existingDomain ? 'Domain already registered' : null
        }
      );

    } catch (error) {
      console.error('❌ Check availability error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to check domain availability',
        error.stack
      );
    }
  }

  /**
   * POST /api/domains/reset-usage - Reset monthly usage (admin/cron)
   */
  async resetMonthlyUsage(req, res) {
    try {
      // This would typically be called by admin or cron job
      const resetCount = await domainService.resetMonthlyUsage();

      return sendSuccessResponse(
        res,
        `Monthly usage reset for ${resetCount} domains`
      );

    } catch (error) {
      console.error('❌ Reset usage error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to reset monthly usage',
        error.stack
      );
    }
  }
}

module.exports = new DomainController();