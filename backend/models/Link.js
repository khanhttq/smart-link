// backend/models/Link.js - FIXED fullShortUrl generation
module.exports = (sequelize, DataTypes) => {
  const Link = sequelize.define('Link', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    
    // Domain Association
    domainId: {
      type: DataTypes.UUID,
      allowNull: true, // null = use system default domain
      field: 'domain_id',
      references: {
        model: 'domains',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    
    originalUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'original_url',
      validate: {
        isUrl: true,
        len: [1, 2048]
      }
    },
    
    shortCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'short_code',
      validate: {
        len: [1, 50],
        is: /^[a-zA-Z0-9_-]+$/ // Only alphanumeric, underscore, hyphen
      }
    },
    
    // Pre-computed full short URL
    fullShortUrl: {
      type: DataTypes.STRING(500),
      field: 'full_short_url',
      allowNull: true
    },
    
    customCode: {
      type: DataTypes.STRING(100),
      field: 'custom_code',
      allowNull: true,
      validate: {
        len: [3, 100],
        is: /^[a-zA-Z0-9_-]+$/
      }
    },
    
    title: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: [0, 200]
      }
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000]
      }
    },
    
    campaign: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100]
      }
    },
    
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Tags for organizing links'
    },
    
    // Analytics and tracking
    clickCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'click_count',
      validate: {
        min: 0
      }
    },
    
    uniqueClicks: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'unique_clicks',
      validate: {
        min: 0
      }
    },
    
    lastClickAt: {
      type: DataTypes.DATE,
      field: 'last_click_at',
      allowNull: true
    },
    
    // Advanced features
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hashed password for protected links'
    },
    
    expiresAt: {
      type: DataTypes.DATE,
      field: 'expires_at',
      allowNull: true
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    
    // UTM and tracking parameters
    utmParameters: {
      type: DataTypes.JSONB,
      field: 'utm_parameters',
      defaultValue: {},
      comment: 'UTM tracking parameters'
    },
    
    // URL metadata (title, description, image, etc.)
    urlMetadata: {
      type: DataTypes.JSONB,
      field: 'url_metadata',
      defaultValue: {},
      comment: 'Fetched metadata from original URL'
    },
    
    // Geographic restrictions
    geoRestrictions: {
      type: DataTypes.JSONB,
      field: 'geo_restrictions',
      defaultValue: {},
      comment: 'Country/region restrictions'
    }
  }, {
    tableName: 'links',
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft delete support
    indexes: [
      {
        fields: ['user_id']
      },
      {
        // CRITICAL: Unique constraint per domain
        fields: ['short_code', 'domain_id'],
        unique: true,
        name: 'unique_shortcode_per_domain'
      },
      {
        fields: ['domain_id']
      },
      {
        fields: ['campaign']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['click_count']
      }
    ],
    hooks: {
      // FIXED: Auto-generate fullShortUrl before save
      beforeCreate: async (link, options) => {
        await generateFullShortUrl(link, options, sequelize);
      },
      
      beforeUpdate: async (link, options) => {
        if (link.changed('shortCode') || link.changed('domainId')) {
          await generateFullShortUrl(link, options, sequelize);
        }
      },
      
      // Auto-fetch URL metadata
      afterCreate: async (link, options) => {
        // Queue URL metadata fetching (non-blocking)
        if (process.env.AUTO_FETCH_METADATA === 'true') {
          setImmediate(async () => {
            try {
              const metadata = await fetchUrlMetadata(link.originalUrl);
              await link.update({ urlMetadata: metadata });
            } catch (error) {
              console.log('Failed to fetch URL metadata:', error.message);
            }
          });
        }
      }
    }
  });

  // FIXED: Helper function to generate full short URL
  async function generateFullShortUrl(link, options, sequelize) {
    try {
      if (link.domainId) {
        // Custom domain
        const domain = await sequelize.models.Domain.findByPk(link.domainId);
        if (domain) {
          const protocol = domain.sslEnabled ? 'https' : 'http';
          link.fullShortUrl = `${protocol}://${domain.domain}/${link.shortCode}`;
        } else {
          // Fallback to system domain if domain not found
          link.fullShortUrl = generateSystemDomainUrl(link.shortCode);
        }
      } else {
        // System domain
        link.fullShortUrl = generateSystemDomainUrl(link.shortCode);
      }
    } catch (error) {
      console.error('Error generating fullShortUrl:', error);
      // Fallback to system domain
      link.fullShortUrl = generateSystemDomainUrl(link.shortCode);
    }
  }

  // FIXED: Helper function for system domain URL
  function generateSystemDomainUrl(shortCode) {
    const systemDomain = process.env.SYSTEM_DOMAIN || process.env.API_URL || 'http://localhost:4000';
    
    // If systemDomain already includes protocol, use it directly
    if (systemDomain.startsWith('http://') || systemDomain.startsWith('https://')) {
      return `${systemDomain}/${shortCode}`;
    }
    
    // Otherwise, add protocol based on environment
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${systemDomain}/${shortCode}`;
  }

  // Helper function to fetch URL metadata
  async function fetchUrlMetadata(url) {
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'ShortlinkBot/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      return {
        title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '',
        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
        image: $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '',
        siteName: $('meta[property="og:site_name"]').attr('content') || '',
        fetchedAt: new Date()
      };
    } catch (error) {
      return {
        error: error.message,
        fetchedAt: new Date()
      };
    }
  }

  // Instance Methods
  Link.prototype.isExpired = function() {
    return this.expiresAt && this.expiresAt <= new Date();
  };

  Link.prototype.canAccess = function(userLocation = null) {
    if (!this.isActive || this.isExpired()) {
      return false;
    }
    
    // Check geographic restrictions
    if (this.geoRestrictions && this.geoRestrictions.countries) {
      const { countries, type } = this.geoRestrictions;
      if (type === 'blacklist' && userLocation && countries.includes(userLocation.country)) {
        return false;
      }
      if (type === 'whitelist' && userLocation && !countries.includes(userLocation.country)) {
        return false;
      }
    }
    
    return true;
  };

  Link.prototype.incrementClicks = async function(isUnique = false) {
    const updateData = { clickCount: this.clickCount + 1 };
    if (isUnique) {
      updateData.uniqueClicks = this.uniqueClicks + 1;
    }
    updateData.lastClickAt = new Date();
    
    await this.update(updateData);
  };

  Link.prototype.buildFinalUrl = function() {
    let finalUrl = this.originalUrl;
    
    // Add UTM parameters if configured
    if (this.utmParameters && Object.keys(this.utmParameters).length > 0) {
      const url = new URL(finalUrl);
      Object.entries(this.utmParameters).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
      finalUrl = url.toString();
    }
    
    return finalUrl;
  };

  // Static Methods
  Link.findByShortCodeAndDomain = async function(shortCode, domainName = null) {
    const whereClause = { shortCode, isActive: true };
    const includeClause = [];
    
    if (domainName) {
      includeClause.push({
        model: sequelize.models.Domain,
        as: 'domain',
        where: { domain: domainName.toLowerCase(), isActive: true, isVerified: true },
        required: true
      });
    } else {
      whereClause.domainId = null;
      includeClause.push({
        model: sequelize.models.Domain,
        as: 'domain',
        required: false
      });
    }
    
    return await this.findOne({
      where: whereClause,
      include: includeClause
    });
  };

  Link.generateUniqueShortCode = async function(domainId = null, length = 6) {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const shortCode = generateRandomString(length);
      
      const existing = await this.findOne({
        where: {
          shortCode,
          domainId: domainId || null
        }
      });
      
      if (!existing) {
        return shortCode;
      }
      
      attempts++;
      if (attempts === 5) length++; // Increase length after 5 attempts
    }
    
    throw new Error('Unable to generate unique short code');
  };

  // Helper function for random string generation
  function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Associations
  Link.associate = function(models) {
    Link.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    
    // Domain association
    Link.belongsTo(models.Domain, {
      foreignKey: 'domainId',
      as: 'domain',
      onDelete: 'SET NULL'
    });
    
    Link.hasMany(models.Click, {
      foreignKey: 'linkId',
      as: 'clicks',
      onDelete: 'CASCADE'
    });
  };

  return Link;
};