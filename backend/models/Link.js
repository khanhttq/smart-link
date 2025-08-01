// models/Link.js
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
      field: 'user_id'
    },
    originalUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'original_url',
      validate: {
        isUrl: true
      }
    },
    shortCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'short_code'
    },
    customCode: {
      type: DataTypes.STRING(100),
      field: 'custom_code'
    },
    title: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.TEXT
    },
    campaign: {
      type: DataTypes.STRING(100)
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    expiresAt: {
      type: DataTypes.DATE,
      field: 'expires_at'
    },
    // Metadata
    clickCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'click_count'
    },
    lastClickAt: {
      type: DataTypes.DATE,
      field: 'last_click_at'
    },
    // URL metadata
    urlMetadata: {
      type: DataTypes.JSONB,
      field: 'url_metadata'
    },
    // Webhook
    webhookUrl: {
      type: DataTypes.STRING,
      field: 'webhook_url'
    }
  }, {
    tableName: 'links',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['short_code'],
        unique: true
      },
      {
        fields: ['campaign']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Associations
  Link.associate = function(models) {
    Link.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Link.hasMany(models.Click, {
      foreignKey: 'linkId',
      as: 'clicks'
    });
  };

  return Link;
};