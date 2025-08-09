// backend/domains/admin/services/AdminStatsService.js
const { User, Link, Click } = require('../../../models');
const { Op } = require('sequelize');
const moment = require('moment');

class AdminStatsService {
  /**
   * Get total users count
   */
  async getTotalUsers() {
    try {
      const count = await User.count({
        where: {
          isActive: true,
        },
      });
      return count;
    } catch (error) {
      console.error('❌ Error getting total users:', error);
      return 0;
    }
  }

  /**
   * Get total links count
   */
  async getTotalLinks() {
    try {
      const count = await Link.count({
        where: {
          isActive: true,
        },
      });
      return count;
    } catch (error) {
      console.error('❌ Error getting total links:', error);
      return 0;
    }
  }

  /**
   * Get today's clicks count - FIXED TIMEZONE
   */
  async getTodayClicks() {
    try {
      // ✅ FIXED: Sử dụng moment để xử lý timezone đúng
      const todayStart = moment().startOf('day').toDate(); // 00:00:00 today
      const todayEnd = moment().endOf('day').toDate(); // 23:59:59 today

      console.log(
        `📊 Getting clicks from ${todayStart.toISOString()} to ${todayEnd.toISOString()}`
      );

      const count = await Click.count({
        where: {
          createdAt: {
            [Op.gte]: todayStart,
            [Op.lte]: todayEnd,
          },
        },
      });

      console.log(`📊 Today clicks count: ${count}`);
      return count;
    } catch (error) {
      console.error('❌ Error getting today clicks:', error);
      return 0;
    }
  }

  /**
   * Get all admin statistics
   */
  async getAllStats() {
    try {
      const [totalUsers, totalLinks, todayClicks] = await Promise.all([
        this.getTotalUsers(),
        this.getTotalLinks(),
        this.getTodayClicks(),
      ]);

      return {
        totalUsers,
        totalLinks,
        todayClicks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error getting admin stats:', error);
      throw error;
    }
  }
}

module.exports = new AdminStatsService();
