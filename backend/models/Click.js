// backend/models/Click.js - IMPROVED VERSION (Single Timestamp)
module.exports = (sequelize, DataTypes) => {
  const Click = sequelize.define(
    'Click',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      linkId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'link_id',
        references: {
          model: 'links',
          key: 'id',
        },
      },
      ipAddress: {
        type: DataTypes.INET,
        field: 'ip_address',
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        field: 'user_agent',
        allowNull: true,
      },
      referrer: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(2),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      deviceType: {
        type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'bot'),
        field: 'device_type',
        allowNull: true,
      },
      browser: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      os: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      isBot: {
        type: DataTypes.BOOLEAN,
        field: 'is_bot',
        defaultValue: false,
      },
      // ✅ REMOVED: No separate timestamp field
      // ✅ We'll use createdAt for everything
    },
    {
      tableName: 'clicks',
      timestamps: true, // ✅ This creates createdAt and updatedAt
      underscored: true, // ✅ Database columns: created_at, updated_at
      paranoid: false, // No soft deletes for clicks

      indexes: [
        // Basic indexes
        {
          name: 'idx_clicks_link_id',
          fields: ['link_id'],
        },
        {
          name: 'idx_clicks_created_at',
          fields: ['created_at'],
        },

        // Composite indexes for common queries
        {
          name: 'idx_clicks_link_date',
          fields: ['link_id', 'created_at'], // For link analytics by date
        },
        {
          name: 'idx_clicks_country_date',
          fields: ['country', 'created_at'], // For geo analytics
        },
        {
          name: 'idx_clicks_device_date',
          fields: ['device_type', 'created_at'], // For device analytics
        },
      ],
    }
  );

  // Associations
  Click.associate = function (models) {
    Click.belongsTo(models.Link, {
      foreignKey: 'linkId',
      as: 'link',
    });
  };

  return Click;
};
