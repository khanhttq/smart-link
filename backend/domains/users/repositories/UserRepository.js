// domains/users/repositories/UserRepository.js
const { User, Link, ApiKey, sequelize } = require('../../../models');
const cacheService = require('../../../core/cache/CacheService');

class UserRepository {
  // Create new user
  async create(userData) {
    const user = await User.create(userData);
    return user;
  }


async findByEmail(email) {
  // ✅ FIX: TẮT CACHE CHO LOGIN (để debug)
  return await User.findOne({
    where: { email },
    include: [{
      model: ApiKey,
      as: 'apiKeys',
      where: { isActive: true },
      required: false
    }]
  });
}

  // Find user by ID (with cache)
  async findById(id) {
    const cacheKey = `user:id:${id}`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      return await User.findByPk(id, {
        include: [{
          model: ApiKey,
          as: 'apiKeys',
          where: { isActive: true },
          required: false
        }]
      });
    }, 1800);
  }

  // Find user by Google ID
  async findByGoogleId(googleId) {
    return await User.findOne({
      where: { googleId }
    });
  }

  // Update user
  async update(id, updateData) {
    const [updatedRowsCount, [updatedUser]] = await User.update(updateData, {
      where: { id },
      returning: true
    });

    if (updatedUser) {
      // Clear cache
      await cacheService.del(`user:id:${id}`);
      await cacheService.del(`user:email:${updatedUser.email}`);
    }

    return updatedUser;
  }

  // Update last seen
  async updateLastSeen(id) {
    return await User.update(
      { lastSeenAt: new Date() },
      { where: { id } }
    );
  }

  // Get user with stats
  async findWithStats(id) {
    const cacheKey = `user:${id}:with_stats`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      // Get user
      const user = await User.findByPk(id, {
        include: [
          {
            model: ApiKey,
            as: 'apiKeys',
            where: { isActive: true },
            required: false
          }
        ]
      });

      if (!user) return null;

      // Get stats separately
      const linkStats = await Link.findAll({
        where: { userId: id },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalLinks'],
          [sequelize.fn('SUM', sequelize.col('click_count')), 'totalClicks']
        ],
        raw: true
      });

      // Attach stats to user
      user.dataValues.stats = linkStats[0] || {
        totalLinks: 0,
        totalClicks: 0
      };

      return user;
    }, 600); // Cache for 10 minutes
  }
}

module.exports = new UserRepository();