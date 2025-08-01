// models/Click.js
module.exports = (sequelize, DataTypes) => {
  const Click = sequelize.define('Click', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    linkId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'link_id'
    },
    ipAddress: {
      type: DataTypes.INET,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      field: 'user_agent'
    },
    referrer: {
      type: DataTypes.STRING
    },
    country: {
      type: DataTypes.STRING(2)
    },
    city: {
      type: DataTypes.STRING
    },
    deviceType: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'bot'),
      field: 'device_type'
    },
    browser: {
      type: DataTypes.STRING
    },
    os: {
      type: DataTypes.STRING
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'clicks',
    timestamps: false,
    indexes: [
      {
        fields: ['link_id']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['country']
      },
      {
        fields: ['device_type']
      }
    ]
  });

  // Associations
  Click.associate = function(models) {
    Click.belongsTo(models.Link, {
      foreignKey: 'linkId',
      as: 'link'
    });
  };

  return Click;
};