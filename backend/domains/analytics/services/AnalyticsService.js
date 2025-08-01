// domains/analytics/services/AnalyticsService.js
const clickTrackingService = require('./ClickTrackingService');
const cacheService = require('../../../core/cache/CacheService');
const moment = require('moment');

class AnalyticsService {
  async initialize() {
    await clickTrackingService.initialize();
  }

  // Get dashboard analytics
  async getDashboardData(userId, timeRange = '7d') {
    const cacheKey = `analytics:dashboard:${userId}:${timeRange}`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      // Get click statistics
      const clickStats = await clickTrackingService.getClickStats(userId, timeRange);
      
      // Get real-time data
      const realTimeData = await clickTrackingService.getRealTimeClicks(userId, 60);
      
      // Calculate growth rates
      const growthData = await this.calculateGrowthRates(userId, timeRange);
      
      return {
        overview: {
          totalClicks: clickStats.totalClicks,
          uniqueClicks: clickStats.uniqueClicks,
          clickRate: clickStats.totalClicks > 0 ? 
            (clickStats.uniqueClicks / clickStats.totalClicks * 100).toFixed(2) : 0,
          growth: growthData
        },
        charts: {
          dailyClicks: clickStats.dailyClicks,
          realTimeClicks: realTimeData.clicksPerMinute
        },
        demographics: {
          countries: clickStats.topCountries,
          devices: clickStats.topDevices,
          browsers: clickStats.topBrowsers
        },
        recentActivity: realTimeData.recentClicks.slice(0, 10)
      };
    }, 300); // Cache for 5 minutes
  }

  // Calculate growth rates
  async calculateGrowthRates(userId, timeRange) {
    try {
      const currentPeriod = await this.getClicksForPeriod(userId, timeRange);
      const previousPeriod = await this.getClicksForPeriod(userId, timeRange, true);
      
      const growthRate = previousPeriod > 0 ? 
        ((currentPeriod - previousPeriod) / previousPeriod * 100) : 0;
      
      return {
        current: currentPeriod,
        previous: previousPeriod,
        growthRate: parseFloat(growthRate.toFixed(2)),
        trend: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable'
      };
    } catch (error) {
      console.error('❌ Growth calculation error:', error.message);
      return {
        current: 0,
        previous: 0,
        growthRate: 0,
        trend: 'stable'
      };
    }
  }

  // Get clicks for specific period
  async getClicksForPeriod(userId, timeRange, isPrevious = false) {
    try {
      let startDate, endDate;
      
      if (timeRange === '7d') {
        if (isPrevious) {
          startDate = moment().subtract(14, 'days');
          endDate = moment().subtract(7, 'days');
        } else {
          startDate = moment().subtract(7, 'days');
          endDate = moment();
        }
      } else if (timeRange === '30d') {
        if (isPrevious) {
          startDate = moment().subtract(60, 'days');
          endDate = moment().subtract(30, 'days');
        } else {
          startDate = moment().subtract(30, 'days');
          endDate = moment();
        }
      }

      const response = await clickTrackingService.esClient.count({
        index: 'clicks',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId } },
                {
                  range: {
                    timestamp: {
                      gte: startDate.toISOString(),
                      lte: endDate.toISOString()
                    }
                  }
                }
              ]
            }
          }
        }
      });

      return response.body.count;
    } catch (error) {
      console.error('❌ Period clicks error:', error.message);
      return 0;
    }
  }

  // Get link performance analytics
  async getLinkAnalytics(linkId, userId, timeRange = '30d') {
    const cacheKey = `analytics:link:${linkId}:${timeRange}`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      try {
        const response = await clickTrackingService.esClient.search({
          index: 'clicks',
          body: {
            query: {
              bool: {
                must: [
                  { term: { linkId } },
                  { term: { userId } },
                  {
                    range: {
                      timestamp: {
                        gte: moment().subtract(30, 'days').toISOString()
                      }
                    }
                  }
                ]
              }
            },
            aggs: {
              total_clicks: { value_count: { field: 'timestamp' } },
              unique_ips: { cardinality: { field: 'ipAddress' } },
              hourly_distribution: {
                date_histogram: {
                  field: 'timestamp',
                  calendar_interval: 'hour'
                }
              },
              top_referrers: {
                terms: { field: 'referrer.keyword', size: 10 }
              }
            },
            size: 0
          }
        });

        const aggs = response.body.aggregations;
        
        return {
          linkId,
          totalClicks: aggs.total_clicks.value,
          uniqueClicks: aggs.unique_ips.value,
          hourlyDistribution: aggs.hourly_distribution.buckets.map(bucket => ({
            hour: bucket.key_as_string,
            clicks: bucket.doc_count
          })),
          topReferrers: aggs.top_referrers.buckets.map(bucket => ({
            referrer: bucket.key || 'Direct',
            clicks: bucket.doc_count
          }))
        };
      } catch (error) {
        console.error('❌ Link analytics error:', error.message);
        return {
          linkId,
          totalClicks: 0,
          uniqueClicks: 0,
          hourlyDistribution: [],
          topReferrers: []
        };
      }
    }, 600); // Cache for 10 minutes
  }

  // Export analytics data
  async exportAnalytics(userId, options = {}) {
    const { 
      format = 'json',
      startDate,
      endDate,
      includeRawClicks = false
    } = options;

    try {
      // Get aggregated data
      const dashboardData = await this.getDashboardData(userId, '30d');
      
      const exportData = {
        userId,
        generatedAt: new Date().toISOString(),
        timeRange: {
          startDate: startDate || moment().subtract(30, 'days').toISOString(),
          endDate: endDate || moment().toISOString()
        },
        summary: dashboardData.overview,
        charts: dashboardData.charts,
        demographics: dashboardData.demographics
      };

      // Include raw clicks if requested
      if (includeRawClicks) {
        const rawClicks = await clickTrackingService.searchClicks(userId, {
          startDate,
          endDate,
          page: 1,
          size: 10000 // Max export limit
        });
        exportData.rawClicks = rawClicks.clicks;
      }

      return exportData;
    } catch (error) {
      console.error('❌ Export analytics error:', error.message);
      throw error;
    }
  }

  // Get top performing links
  async getTopLinks(userId, timeRange = '7d', limit = 10) {
    const cacheKey = `analytics:top-links:${userId}:${timeRange}`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      try {
        const response = await clickTrackingService.esClient.search({
          index: 'clicks',
          body: {
            query: {
              bool: {
                must: [
                  { term: { userId } },
                  {
                    range: {
                      timestamp: {
                        gte: moment().subtract(7, 'days').toISOString()
                      }
                    }
                  }
                ]
              }
            },
            aggs: {
              top_links: {
                terms: { 
                  field: 'shortCode',
                  size: limit,
                  order: { _count: 'desc' }
                },
                aggs: {
                  unique_clicks: { cardinality: { field: 'ipAddress' } },
                  latest_click: { max: { field: 'timestamp' } }
                }
              }
            },
            size: 0
          }
        });

        return response.body.aggregations.top_links.buckets.map(bucket => ({
          shortCode: bucket.key,
          totalClicks: bucket.doc_count,
          uniqueClicks: bucket.unique_clicks.value,
          lastClickAt: bucket.latest_click.value_as_string
        }));
      } catch (error) {
        console.error('❌ Top links error:', error.message);
        return [];
      }
    }, 900); // Cache for 15 minutes
  }
}

module.exports = new AnalyticsService();