// backend/domains/analytics/services/ClickTrackingService.js - FIXED Aggregations Error
const esConnection = require('../../../config/elasticsearch');
const moment = require('moment');

class ClickTrackingService {
  constructor() {
    this.esClient = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.esClient = await esConnection.connect();
      this.isInitialized = true;
      console.log('✅ ClickTrackingService initialized');
    } catch (error) {
      console.error('❌ ClickTrackingService initialization failed:', error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  // ===== HELPER METHODS =====
  
  /**
   * Safely extract response data from ElasticSearch
   */
  safeExtractResponse(response) {
    // Handle different ElasticSearch client versions
    const responseBody = response.body || response;
    return responseBody;
  }

  /**
   * Safely extract aggregations with fallback
   */
  safeExtractAggregations(response) {
    const responseBody = this.safeExtractResponse(response);
    
    // Check for aggregations in different possible locations
    const aggregations = responseBody.aggregations || responseBody.aggs || {};
    
    console.log('🔍 Aggregations structure:', JSON.stringify(aggregations, null, 2));
    return aggregations;
  }

  /**
   * Create default analytics structure
   */
  createDefaultAnalytics() {
    return {
      totalClicks: 0,
      uniqueClicks: 0,
      dailyClicks: [],
      topCountries: [],
      topDevices: [],
      topBrowsers: []
    };
  }

  // ===== TRACKING METHODS =====

  /**
   * Track single click
   */
  async trackClick(clickData) {
    try {
      if (!this.isInitialized) {
        console.warn('⚠️ ClickTrackingService not initialized, skipping tracking');
        return null;
      }

      const document = {
        ...clickData,
        timestamp: new Date(),
        '@timestamp': new Date().toISOString(),
        date: moment().format('YYYY-MM-DD'),
        hour: moment().startOf('hour').toISOString()
      };

      const response = await this.esClient.index({
        index: 'clicks',
        body: document
      });

      const responseBody = this.safeExtractResponse(response);
      console.log(`📊 Click tracked: ${clickData.shortCode} (ID: ${responseBody._id})`);
      return responseBody._id;
    } catch (error) {
      console.error('❌ Click tracking error:', error.message);
      return null;
    }
  }

  /**
   * Track multiple clicks in batch
   */
  async trackClicksBatch(clicksArray) {
    try {
      if (!this.isInitialized) {
        console.warn('⚠️ ClickTrackingService not initialized, skipping batch tracking');
        return 0;
      }

      const body = [];
      
      for (const click of clicksArray) {
        body.push({ index: { _index: 'clicks' } });
        body.push({
          ...click,
          timestamp: new Date(),
          '@timestamp': new Date().toISOString(),
          date: moment().format('YYYY-MM-DD'),
          hour: moment().startOf('hour').toISOString()
        });
      }

      const response = await this.esClient.bulk({ body });
      const responseBody = this.safeExtractResponse(response);
      
      const successCount = responseBody.items?.length || 0;
      console.log(`📊 Batch tracked: ${successCount}/${clicksArray.length} clicks`);
      return successCount;
    } catch (error) {
      console.error('❌ Batch click tracking error:', error.message);
      return 0;
    }
  }

  // ===== ANALYTICS METHODS =====

  /**
   * Get click statistics for a specific link - FIXED VERSION
   */
  /**
 * Get analytics stats for specific link
 */
  async getClickStats(linkId, startDate, endDate) {
    try {
      if (!this.isInitialized || !this.esClient) {
        console.warn('⚠️ ClickTrackingService not initialized');
        // Throw error để kích hoạt PostgreSQL fallback
        throw new Error('ElasticSearch service not initialized');
      }

      const searchBody = {
        query: {
          bool: {
            must: [
              { term: { linkId } },
              {
                range: {
                  timestamp: {
                    gte: startDate,
                    lte: endDate
                  }
                }
              }
            ]
          }
        },
        aggs: {
          total_clicks: {
            value_count: { field: 'timestamp' }
          },
          unique_clicks: {
            cardinality: { field: 'ipAddress' }
          },
          daily_clicks: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'day',
              format: 'yyyy-MM-dd'
            }
          },
          top_countries: {
            terms: { 
              field: 'country.keyword', 
              size: 10,
              missing: 'Unknown'
            }
          },
          top_devices: {
            terms: { 
              field: 'deviceType.keyword', 
              size: 5,
              missing: 'Unknown'
            }
          },
          top_browsers: {
            terms: { 
              field: 'browser.keyword', 
              size: 10,
              missing: 'Unknown'
            }
          }
        },
        size: 0
      };

      console.log('🔍 ElasticSearch query:', JSON.stringify(searchBody, null, 2));

      let response;
      try {
        response = await this.esClient.search({
          index: 'clicks',
          body: searchBody
        });
      } catch (searchError) {
        console.error('❌ ElasticSearch search error:', searchError);
        
        // ✅ PHÂN BIỆT LOẠI ERROR:
        // ConnectionError/ResponseError = ES offline → Throw để fallback PostgreSQL
        if (searchError.name === 'ConnectionError' || 
            searchError.name === 'ResponseError' ||
            searchError.message.includes('Connection') ||
            searchError.message.includes('ECONNREFUSED') ||
            searchError.meta?.statusCode === 0) {
          
          console.warn('⚠️ ElasticSearch connection failed, triggering PostgreSQL fallback');
          throw new Error(`ElasticSearch connection error: ${searchError.message}`);
        }
        
        // Other errors (invalid query, etc.) = Return empty data
        console.warn('⚠️ ElasticSearch query error, returning empty results');
        return this.createDefaultAnalytics();
      }

      console.log('📊 ElasticSearch response status:', response.statusCode);

      // ✅ SAFE AGGREGATION EXTRACTION
      const aggs = this.safeExtractAggregations(response);
      
      // Check if aggregations exist - if not, it's empty data (not error)
      if (!aggs || Object.keys(aggs).length === 0) {
        console.log('ℹ️ No aggregations found - link has no clicks yet');
        return this.createDefaultAnalytics();
      }

      // ✅ EXTRACT DATA SAFELY
      const result = {
        totalClicks: aggs.total_clicks?.value || 0,
        uniqueClicks: aggs.unique_clicks?.value || 0,
        dailyClicks: (aggs.daily_clicks?.buckets || []).map(bucket => ({
          date: bucket.key_as_string || bucket.key,
          clicks: bucket.doc_count || 0
        })),
        topCountries: (aggs.top_countries?.buckets || []).map(bucket => ({
          country: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        })),
        topDevices: (aggs.top_devices?.buckets || []).map(bucket => ({
          device: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        })),
        topBrowsers: (aggs.top_browsers?.buckets || []).map(bucket => ({
          browser: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        }))
      };

      console.log('✅ Processed analytics result:', result);
      return result;

    } catch (error) {
      console.error('❌ Click stats error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        linkId,
        startDate,
        endDate
      });
      
      // ✅ THROW ERROR INSTEAD OF RETURNING DEFAULT
      // Điều này sẽ trigger PostgreSQL fallback ở LinkService
      throw error;
    }
  }

  /**
   * Get user analytics across all links - FIXED VERSION
   */
  async getUserAnalytics(userId, timeRange = '7d') {
    try {
      if (!this.isInitialized) {
        console.warn('⚠️ ClickTrackingService not initialized, returning default stats');
        return this.createDefaultAnalytics();
      }

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
                calendar_interval: 'day',
                format: 'yyyy-MM-dd'
              }
            },
            top_countries: {
              terms: { field: 'country.keyword', size: 10, missing: 'Unknown' }
            },
            top_devices: {
              terms: { field: 'deviceType.keyword', size: 5, missing: 'Unknown' }
            },
            top_browsers: {
              terms: { field: 'browser.keyword', size: 10, missing: 'Unknown' }
            }
          },
          size: 0
        }
      });

      // ✅ FIXED: Safe aggregation extraction
      const aggs = this.safeExtractAggregations(response);
      
      if (!aggs || Object.keys(aggs).length === 0) {
        return this.createDefaultAnalytics();
      }

      return {
        totalClicks: aggs.total_clicks?.value || 0,
        uniqueClicks: aggs.unique_clicks?.value || 0,
        dailyClicks: (aggs.daily_clicks?.buckets || []).map(bucket => ({
          date: bucket.key_as_string || bucket.key,
          clicks: bucket.doc_count || 0
        })),
        topCountries: (aggs.top_countries?.buckets || []).map(bucket => ({
          country: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        })),
        topDevices: (aggs.top_devices?.buckets || []).map(bucket => ({
          device: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        })),
        topBrowsers: (aggs.top_browsers?.buckets || []).map(bucket => ({
          browser: bucket.key || 'Unknown',
          clicks: bucket.doc_count || 0
        }))
      };
    } catch (error) {
      console.error('❌ User analytics error:', error);
      return this.createDefaultAnalytics();
    }
  }

  /**
   * Get real-time click data - FIXED VERSION
   */
  async getRealTimeClicks(userId, minutes = 60) {
    try {
      if (!this.isInitialized) {
        return {
          recentClicks: [],
          clicksPerMinute: []
        };
      }

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
                fixed_interval: '1m',
                format: 'yyyy-MM-dd HH:mm'
              }
            }
          },
          sort: [{ timestamp: { order: 'desc' } }],
          size: 100
        }
      });

      // ✅ FIXED: Safe extraction
      const responseBody = this.safeExtractResponse(response);
      const aggs = this.safeExtractAggregations(response);

      return {
        recentClicks: (responseBody.hits?.hits || []).map(hit => hit._source || hit),
        clicksPerMinute: (aggs.clicks_per_minute?.buckets || []).map(bucket => ({
          time: bucket.key_as_string || bucket.key,
          clicks: bucket.doc_count || 0
        }))
      };
    } catch (error) {
      console.error('❌ Real-time clicks error:', error);
      return {
        recentClicks: [],
        clicksPerMinute: []
      };
    }
  }

  /**
   * Search clicks with filters - FIXED VERSION
   */
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
      if (!this.isInitialized) {
        return {
          total: 0,
          clicks: [],
          page: 1,
          totalPages: 0
        };
      }

      const must = [{ term: { userId } }];

      // Date range
      if (startDate || endDate) {
        const dateRange = {};
        if (startDate) dateRange.gte = startDate;
        if (endDate) dateRange.lte = endDate;
        must.push({ range: { timestamp: dateRange } });
      }

      // Filters
      if (campaign) must.push({ term: { 'campaign.keyword': campaign } });
      if (country) must.push({ term: { 'country.keyword': country } });
      if (deviceType) must.push({ term: { 'deviceType.keyword': deviceType } });

      // Text search
      if (search) {
        must.push({
          multi_match: {
            query: search,
            fields: ['originalUrl', 'referrer', 'shortCode']
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

      // ✅ FIXED: Safe extraction
      const responseBody = this.safeExtractResponse(response);
      const total = responseBody.hits?.total?.value || responseBody.hits?.total || 0;

      return {
        total,
        clicks: (responseBody.hits?.hits || []).map(hit => hit._source || hit),
        page,
        totalPages: Math.ceil(total / size)
      };
    } catch (error) {
      console.error('❌ Search clicks error:', error);
      return {
        total: 0,
        clicks: [],
        page: 1,
        totalPages: 0
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Check if service is ready
   */
  isReady() {
    // Check both initialization and actual ES connection
    if (!this.isInitialized || !this.esClient) {
      return false;
    }
    
    // Check if using real ES connection (not mock)
    if (this.esClient.ping) {
      return true;
    }
    
    // If it's a mock client, consider it not ready
    return false;
  }
// ===== THÊM METHOD PING TEST =====
/**
 * Test ES connection với timeout ngắn
 */
  async testConnection() {
    if (!this.isReady()) {
      return { connected: false, error: 'Service not initialized' };
    }
    
    try {
      await Promise.race([
        this.esClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 2000)
        )
      ]);
      
      return { connected: true };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'down', message: 'Not initialized' };
      }

      const response = await this.esClient.ping();
      return { 
        status: 'up', 
        message: 'ElasticSearch connection healthy',
        responseTime: response.meta?.request?.options?.timeout || 'unknown'
      };
    } catch (error) {
      return { 
        status: 'down', 
        message: error.message,
        error: error.name
      };
    }
  }
}

module.exports = new ClickTrackingService();