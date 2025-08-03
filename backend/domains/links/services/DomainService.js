// backend/domains/links/services/DomainService.js
const crypto = require('crypto');
const dns = require('dns').promises;
const { Domain } = require('../../../models');

class DomainService {
  
  /**
   * Add new custom domain
   */
  async addDomain(userId, domainData) {
    const { domain, displayName } = domainData;
    
    // Validate domain format
    if (!this.isValidDomain(domain)) {
      throw new Error('Invalid domain format. Please use format: example.com');
    }
    
    // Normalize domain
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Check if domain already exists
    const existing = await Domain.findOne({
      where: { domain: normalizedDomain }
    });
    
    if (existing) {
      throw new Error('Domain already registered in the system');
    }
    
    // Generate verification token
    const verificationToken = this.generateVerificationToken();
    
    // Create domain record
    const domainRecord = await Domain.create({
      userId,
      domain: normalizedDomain,
      displayName: displayName || normalizedDomain,
      isActive: false,
      isVerified: false,
      verificationToken,
      dnsRecords: this.generateDnsInstructions(normalizedDomain, verificationToken)
    });
    
    return {
      domain: domainRecord,
      verificationInstructions: this.getVerificationInstructions(normalizedDomain, verificationToken)
    };
  }
  
  /**
   * Verify domain ownership via DNS
   */
  async verifyDomain(domainId, userId) {
    const domain = await Domain.findOne({
      where: { 
        id: domainId,
        userId 
      }
    });
    
    if (!domain) {
      throw new Error('Domain not found or unauthorized');
    }
    
    if (domain.isVerified) {
      return { 
        verified: true, 
        domain,
        message: 'Domain already verified'
      };
    }
    
    // Check DNS verification
    const verificationResult = await this.checkDnsVerification(
      domain.domain, 
      domain.verificationToken
    );
    
    if (verificationResult.verified) {
      await domain.update({
        isVerified: true,
        verifiedAt: new Date(),
        isActive: true
      });
      
      return { 
        verified: true, 
        domain,
        message: 'Domain verified successfully'
      };
    }
    
    return { 
      verified: false, 
      domain,
      error: verificationResult.error,
      instructions: this.getVerificationInstructions(domain.domain, domain.verificationToken)
    };
  }
  
  /**
   * Get user domains with pagination
   */
  async getUserDomains(userId, options = {}) {
    const { 
      limit = 20, 
      offset = 0,
      includeInactive = true 
    } = options;
    
    const whereClause = { userId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    
    const { count, rows } = await Domain.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        association: 'links',
        attributes: ['id'],
        required: false
      }]
    });
    
    // Add link count to each domain
    const domainsWithStats = rows.map(domain => {
      const domainJson = domain.toJSON();
      domainJson.linkCount = domain.links ? domain.links.length : 0;
      delete domainJson.links; // Remove the actual links array
      return domainJson;
    });
    
    return {
      domains: domainsWithStats,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: (offset + limit) < count
      }
    };
  }
  
  /**
   * Get domain by name (for redirect handling)
   */
  async getDomainByName(domainName) {
    return await Domain.findOne({
      where: {
        domain: domainName.toLowerCase().trim(),
        isActive: true,
        isVerified: true
      }
    });
  }
  
  /**
   * Update domain settings
   */
  async updateDomain(domainId, userId, updateData) {
    const domain = await Domain.findOne({
      where: { 
        id: domainId,
        userId 
      }
    });
    
    if (!domain) {
      throw new Error('Domain not found or unauthorized');
    }
    
    // Only allow certain fields to be updated
    const allowedFields = [
      'displayName',
      'isActive',
      'monthlyLinkLimit',
      'customFavicon',
      'customLandingPage',
      'analyticsCode'
    ];
    
    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        filteredData[field] = updateData[field];
      }
    });
    
    await domain.update(filteredData);
    return domain;
  }
  
  /**
   * Delete domain (soft delete)
   */
  async deleteDomain(domainId, userId) {
    const domain = await Domain.findOne({
      where: { 
        id: domainId,
        userId 
      }
    });
    
    if (!domain) {
      throw new Error('Domain not found or unauthorized');
    }
    
    // Check if domain has active links
    const linkCount = await domain.countLinks({
      where: { isActive: true }
    });
    
    if (linkCount > 0) {
      throw new Error(`Cannot delete domain with ${linkCount} active links. Please deactivate or delete links first.`);
    }
    
    // Soft delete
    await domain.destroy();
    return true;
  }
  
  /**
   * Reset monthly usage for all domains
   */
  async resetMonthlyUsage() {
    const domainsToReset = await Domain.findAll({
      where: {
        currentMonthUsage: { [Op.gt]: 0 }
      }
    });
    
    for (const domain of domainsToReset) {
      await domain.resetMonthlyUsage();
    }
    
    return domainsToReset.length;
  }
  
  /**
   * Get domain statistics
   */
  async getDomainStats(domainId, userId) {
    const domain = await Domain.findOne({
      where: { 
        id: domainId,
        userId 
      },
      include: [{
        association: 'links',
        attributes: ['id', 'clickCount', 'createdAt', 'isActive']
      }]
    });
    
    if (!domain) {
      throw new Error('Domain not found or unauthorized');
    }
    
    const stats = {
      totalLinks: domain.links.length,
      activeLinks: domain.links.filter(link => link.isActive).length,
      totalClicks: domain.links.reduce((sum, link) => sum + (link.clickCount || 0), 0),
      monthlyUsage: domain.currentMonthUsage,
      monthlyLimit: domain.monthlyLinkLimit,
      usagePercentage: (domain.currentMonthUsage / domain.monthlyLinkLimit) * 100
    };
    
    return { domain, stats };
  }
  
  // ===== HELPER METHODS =====
  
  /**
   * Validate domain format
   */
  isValidDomain(domain) {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    return domainRegex.test(domain) && !domain.includes('localhost') && !domain.includes('127.0.0.1');
  }
  
  /**
   * Generate verification token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Generate DNS instructions
   */
  generateDnsInstructions(domain, verificationToken) {
    const systemDomain = process.env.SYSTEM_DOMAIN || 'shortlink.com';
    const serverIp = process.env.SERVER_IP || '1.2.3.4';
    
    return {
      required: [
        {
          type: 'TXT',
          name: `_shortlink-verify.${domain}`,
          value: verificationToken,
          ttl: 300,
          description: 'Verification token for domain ownership'
        }
      ],
      recommended: [
        {
          type: 'CNAME',
          name: domain,
          value: systemDomain,
          ttl: 300,
          description: 'Points your domain to our servers (preferred)'
        }
      ],
      alternative: [
        {
          type: 'A',
          name: domain,
          value: serverIp,
          ttl: 300,
          description: 'Direct IP pointing (if CNAME not possible)'
        }
      ]
    };
  }
  
  /**
   * Get verification instructions for user
   */
  getVerificationInstructions(domain, verificationToken) {
    return {
      domain,
      steps: [
        {
          step: 1,
          title: 'Add DNS TXT Record',
          description: 'Add this TXT record to verify domain ownership',
          record: {
            type: 'TXT',
            name: `_shortlink-verify.${domain}`,
            value: verificationToken,
            ttl: 300
          }
        },
        {
          step: 2,
          title: 'Point Domain to Our Servers',
          description: 'Choose one of these options to point your domain to our servers',
          options: [
            {
              method: 'CNAME (Recommended)',
              record: {
                type: 'CNAME',
                name: domain,
                value: process.env.SYSTEM_DOMAIN || 'shortlink.com',
                ttl: 300
              }
            },
            {
              method: 'A Record (Alternative)',
              record: {
                type: 'A',
                name: domain,
                value: process.env.SERVER_IP || '1.2.3.4',
                ttl: 300
              }
            }
          ]
        },
        {
          step: 3,
          title: 'Verify Domain',
          description: 'Click verify button after DNS records are configured (may take up to 24 hours to propagate)'
        }
      ],
      notes: [
        'DNS changes can take up to 24 hours to propagate worldwide',
        'You can verify domain ownership as soon as the TXT record is visible',
        'The domain will be activated after both verification and DNS pointing are complete'
      ]
    };
  }
  
  /**
   * Check DNS verification
   */
  async checkDnsVerification(domain, expectedToken) {
    try {
      // Check TXT record for verification
      const txtRecords = await dns.resolveTxt(`_shortlink-verify.${domain}`);
      const flatRecords = txtRecords.flat();
      
      const tokenFound = flatRecords.some(record => record === expectedToken);
      
      if (!tokenFound) {
        return {
          verified: false,
          error: 'Verification TXT record not found. Please ensure you have added the TXT record correctly.'
        };
      }
      
      // Optional: Check if domain points to our servers
      try {
        const systemDomain = process.env.SYSTEM_DOMAIN || 'shortlink.com';
        const cnameRecords = await dns.resolveCname(domain);
        const pointsToUs = cnameRecords.some(record => record.includes(systemDomain));
        
        if (!pointsToUs) {
          console.log(`Warning: ${domain} is verified but doesn't point to our servers yet`);
        }
      } catch (cnameError) {
        // CNAME check failed, try A record
        try {
          const aRecords = await dns.resolve4(domain);
          const serverIp = process.env.SERVER_IP;
          if (serverIp && !aRecords.includes(serverIp)) {
            console.log(`Warning: ${domain} is verified but doesn't point to our IP yet`);
          }
        } catch (aError) {
          console.log(`Warning: ${domain} is verified but DNS pointing not configured yet`);
        }
      }
      
      return { verified: true };
      
    } catch (error) {
      return {
        verified: false,
        error: `DNS verification failed: ${error.message}. Please ensure the TXT record is correctly configured.`
      };
    }
  }
}

module.exports = new DomainService();