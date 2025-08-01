// models/ApiKey.js
const crypto = require('crypto');

module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hashedKey: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'hashed_key'
    },
    tier: {
      type: DataTypes.ENUM('free', 'pro', 'enterprise'),
      defaultValue: 'free'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      field: 'last_used_at'
    },
    expiresAt: {
      type: DataTypes.DATE,
      field: 'expires_at'
    },
    requestCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'request_count'
    },
    requestLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
      field: 'request_limit'
    }
  }, {
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate: (apiKey) => {
        // Generate API key if not provided
        if (!apiKey.hashedKey) {
          const plainKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
          apiKey.hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');
          // Store plain key temporarily (only time it's visible)
          apiKey.plainKey = plainKey;
          console.log(`🔑 Generated API key: ${plainKey}`);
        }
      }
    }
  });

  // Instance method to generate new key
  ApiKey.prototype.generateNewKey = function() {
    const plainKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    this.hashedKey = crypto.createHash('sha256').update(plainKey).digest('hex');
    return plainKey; // Return for one-time display
  };

  // Static method to verify key
  ApiKey.verifyKey = function(plainKey, hashedKey) {
    const hash = crypto.createHash('sha256').update(plainKey).digest('hex');
    return hash === hashedKey;
  };

  // Associations
  ApiKey.associate = function(models) {
    ApiKey.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return ApiKey;
};