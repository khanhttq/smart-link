// domains/analytics/services/ClickTrackingService.js
const esConnection = require('../../../config/elasticsearch');
const moment = require('moment');

class ClickTrackingService {
  constructor() {
    this.esClient = null;
  }

  async initialize() {
    this.esClient = await esConnection.connect();
  }

  // Track single click
  async trackClick(clickData) {
    try {
      const document = {
        ...clickData,
        timestamp: new Date(),
        '@timestamp': new Date().toISOString(),
        date: moment().format('YYYY-MM-DD'),
        hour: moment().format('YYYY-MM-DD HH:00:00')
      };

      const response = await this.esClient.index({
        index: 'clicks',
        body: document
      });

      console.log(`📊 Click tracked: ${clickData.shortCode}`);
      return response.body._id;
    } catch (error) {
      console.error('❌ Click tracking error:', error.message);
      return null;
    }
  }

  // Track multiple clicks (batch)
  async trackClicksBatch(clicksArray) {
    try {
      const body = [];
      
      for (const click of clicksArray) {
        body.push({ index: { _index: 'clicks' } });
        body.push({
          ...click,
          timestamp: new Date(),
          '@timestamp': new Date().toISOString(),
          date: moment().format('YYYY-MM-DD'),
          hour: moment().format('YYYY-MM-DD HH:00:00')
        });
      }

      const response = await this.esClient.bulk({ body });
      
      console.log(`📊 Batch tracked: ${clicksArray.length} clicks`);
      return response.body.items.length;
    } catch (error) {
      console.error('❌ Batch click tracking error:', error.message);
      return 0;
    }
  }

  // Get click statistics
  async getClickStats(userId, timeRange = '7d') {
    try {
      const response = await this.esClient.search({
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
            total_clicks: { value_count: { field: 'timestamp' } },
            unique_clicks: { cardinality: { field: 'ipAddress' } },
            daily_clicks: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: 'day'
              }
            },
            top_countries: {
              terms: { field: 'country', size: 10 }
            },
            top_devices: {
              terms: { field: 'deviceType', size: 5 }
            },
            top_browsers: {
              terms: { field: 'browser', size: 10 }
            }
          },
          size: 0
        }
      });

      const aggs = response.body.aggregations;
      
      return {
        totalClicks: aggs.total_clicks.value,
        uniqueClicks: aggs.unique_clicks.value,
        dailyClicks: aggs.daily_clicks.buckets.map(bucket => ({
          date: bucket.key_as_string,
          clicks: bucket.doc_count
        })),
        topCountries: aggs.top_countries.buckets.map(bucket => ({
          country: bucket.key,
          clicks: bucket.doc_count
        })),
        topDevices: aggs.top_devices.buckets.map(bucket => ({
          device: bucket.key,
          clicks: bucket.doc_count
        })),
        topBrowsers: aggs.top_browsers.buckets.map(bucket => ({
          browser: bucket.key,
          clicks: bucket.doc_count
        }))
      };
    } catch (error) {
      console.error('❌ Click stats error:', error.message);
      return {
        totalClicks: 0,
        uniqueClicks: 0,
        dailyClicks: [],
        topCountries: [],
        topDevices: [],
        topBrowsers: []
      };
    }
  }

  // Get real-time click data
  async getRealTimeClicks(userId, minutes = 60) {
    try {
      const response = await this.esClient.search({
        index: 'clicks',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId } },
                {
                  range: {
                    timestamp: {
                      gte: moment().subtract(minutes, 'minutes').toISOString()
                    }
                  }
                }
              ]
            }
          },
          aggs: {
            clicks_per_minute: {
              date_histogram: {
                field: 'timestamp',
                fixed_interval: '1m'
              }
            }
          },
          sort: [{ timestamp: { order: 'desc' } }],
          size: 100
        }
      });

      return {
        recentClicks: response.body.hits.hits.map(hit => hit._source),
        clicksPerMinute: response.body.aggregations.clicks_per_minute.buckets.map(bucket => ({
          time: bucket.key_as_string,
          clicks: bucket.doc_count
        }))
      };
    } catch (error) {
      console.error('❌ Real-time clicks error:', error.message);
      return {
        recentClicks: [],
        clicksPerMinute: []
      };
    }
  }

  // Search clicks
  async searchClicks(userId, searchParams) {
    const { 
      startDate, 
      endDate, 
      campaign, 
      country, 
      deviceType,
      search,
      page = 1,
      size = 20 
    } = searchParams;

    try {
      const must = [{ term: { userId } }];

      // Date range
      if (startDate || endDate) {
        const dateRange = {};
        if (startDate) dateRange.gte = startDate;
        if (endDate) dateRange.lte = endDate;
        must.push({ range: { timestamp: dateRange } });
      }

      // Filters
      if (campaign) must.push({ term: { campaign } });
      if (country) must.push({ term: { country } });
      if (deviceType) must.push({ term: { deviceType } });

      // Text search
      if (search) {
        must.push({
          multi_match: {
            query: search,
            fields: ['originalUrl', 'referrer']
          }
        });
      }

      const response = await this.esClient.search({
        index: 'clicks',
        body: {
          query: { bool: { must } },
          sort: [{ timestamp: { order: 'desc' } }],
          from: (page - 1) * size,
          size: size
        }
      });

      return {
        total: response.body.hits.total.value,
        clicks: response.body.hits.hits.map(hit => hit._source),
        page,
        totalPages: Math.ceil(response.body.hits.total.value / size)
      };
    } catch (error) {
      console.error('❌ Search clicks error:', error.message);
      return {
        total: 0,
        clicks: [],
        page: 1,
        totalPages: 0
      };
    }
  }
}

module.exports = new ClickTrackingService();