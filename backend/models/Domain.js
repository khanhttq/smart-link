// backend/models/Domain.js
module.exports = (sequelize, DataTypes) => {
  const Domain = sequelize.define('Domain', {
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
    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isDomain(value) {
          const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
          if (!domainRegex.test(value)) {
            throw new Error('Invalid domain format');
          }
        }
      }
    },
    displayName: {
      type: DataTypes.STRING(100),
      field: 'display_name',
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_active'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified'
    },
    verificationToken: {
      type: DataTypes.STRING(64),
      field: 'verification_token',
      allowNull: true
    },
    verifiedAt: {
      type: DataTypes.DATE,
      field: 'verified_at',
      allowNull: true
    },
    
    // DNS Configuration
    dnsRecords: {
      type: DataTypes.JSONB,
      field: 'dns_records',
      defaultValue: {},
      comment: 'Required DNS records for verification'
    },
    
    // SSL Configuration
    sslEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'ssl_enabled'
    },
    sslExpiry: {
      type: DataTypes.DATE,
      field: 'ssl_expiry',
      allowNull: true
    },
    sslProvider: {
      type: DataTypes.STRING(50),
      field: 'ssl_provider',
      allowNull: true,
      comment: 'e.g., lets_encrypt, cloudflare'
    },
    
    // Usage Limits
    monthlyLinkLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
      field: 'monthly_link_limit',
      validate: {
        min: 0,
        max: 100000
      }
    },
    currentMonthUsage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'current_month_usage',
      validate: {
        min: 0
      }
    },
    lastUsageReset: {
      type: DataTypes.DATE,
      field: 'last_usage_reset',
      defaultValue: DataTypes.NOW
    },
    
    // Additional Settings
    customFavicon: {
      type: DataTypes.STRING(500),
      field: 'custom_favicon',
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    customLandingPage: {
      type: DataTypes.TEXT,
      field: 'custom_landing_page',
      allowNull: true,
      comment: 'Custom HTML for 404/preview pages'
    },
    analyticsCode: {
      type: DataTypes.TEXT,
      field: 'analytics_code',
      allowNull: true,
      comment: 'Google Analytics or other tracking code'
    }
  }, {
    tableName: 'domains',
    timestamps: true,
    underscored: true,
    paranoid: true, // Soft delete support
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['domain'],
        unique: true
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      beforeCreate: (domain, options) => {
        // Normalize domain to lowercase
        domain.domain = domain.domain.toLowerCase().trim();
        
        // Set display name if not provided
        if (!domain.displayName) {
          domain.displayName = domain.domain;
        }
        
        // Generate verification token
        if (!domain.verificationToken) {
          domain.verificationToken = require('crypto').randomBytes(32).toString('hex');
        }
        
        // Set DNS records
        domain.dnsRecords = {
          required: [
            {
              type: 'CNAME',
              name: domain.domain,
              value: process.env.SYSTEM_DOMAIN || 'shortlink.com',
              ttl: 300,
              description: 'Points your domain to our servers'
            },
            {
              type: 'TXT',
              name: `_shortlink-verify.${domain.domain}`,
              value: domain.verificationToken,
              ttl: 300,
              description: 'Verification token for domain ownership'
            }
          ],
          optional: [
            {
              type: 'A',
              name: domain.domain,
              value: process.env.SERVER_IP || '1.2.3.4',
              ttl: 300,
              description: 'Alternative to CNAME (if needed)'
            }
          ]
        };
      },
      
      beforeUpdate: (domain, options) => {
        if (domain.changed('domain')) {
          domain.domain = domain.domain.toLowerCase().trim();
        }
      }
    }
  });

  // Class Methods
  Domain.prototype.isUsageLimitExceeded = function() {
    return this.currentMonthUsage >= this.monthlyLinkLimit;
  };

  Domain.prototype.getRemainingUsage = function() {
    return Math.max(0, this.monthlyLinkLimit - this.currentMonthUsage);
  };

  Domain.prototype.resetMonthlyUsage = async function() {
    await this.update({
      currentMonthUsage: 0,
      lastUsageReset: new Date()
    });
  };

  Domain.prototype.incrementUsage = async function(count = 1) {
    await this.increment('currentMonthUsage', { by: count });
  };

  // Static Methods
  Domain.findByDomainName = async function(domainName) {
    return await this.findOne({
      where: {
        domain: domainName.toLowerCase().trim(),
        isActive: true,
        isVerified: true
      }
    });
  };

  Domain.getSystemDomain = function() {
    return {
      id: null,
      domain: process.env.SYSTEM_DOMAIN || 'shortlink.com',
      displayName: 'System Default',
      isActive: true,
      isVerified: true,
      monthlyLinkLimit: Infinity,
      currentMonthUsage: 0
    };
  };

  // Associations
  Domain.associate = function(models) {
    Domain.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });
    
    Domain.hasMany(models.Link, {
      foreignKey: 'domainId',
      as: 'links',
      onDelete: 'CASCADE'
    });
  };

  return Domain;
};