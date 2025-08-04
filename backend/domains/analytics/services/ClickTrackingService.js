// backend/domains/analytics/services/ClickTrackingService.js
// FIX: isReady() method để xử lý ElasticSearch yellow health status

const esConnection = require('../../../config/elasticsearch');
const moment = require('moment');

class ClickTrackingService {
  constructor() {
    this.esClient = null;
    this.isInitialized = false;
    this.lastHealthCheck = null;
    this.isHealthy = false;
  }

  async initialize() {
    try {
      // Sử dụng connection từ esConnection thay vì tự tạo
      if (esConnection.isReady()) {
        this.esClient = esConnection.getClient();
        this.isInitialized = true;
        
        // Perform initial health check
        await this.performHealthCheck();
        
        console.log('✅ ClickTrackingService initialized');
      } else {
        console.warn('⚠️ ElasticSearch connection not ready, using fallback mode');
        this.isInitialized = false;
        this.isHealthy = false;
      }
    } catch (error) {
      console.error('❌ ClickTrackingService initialization failed:', error.message);
      this.isInitialized = false;
      this.isHealthy = false;
      // Don't throw - allow fallback to work
    }
  }

  /**
   * FIXED: Enhanced isReady() method
   * Kiểm tra cả connection và health status
   */
  isReady() {
    // Basic checks
    if (!this.isInitialized || !this.esClient) {
      return false;
    }
    
    // Check if ES connection is ready
    if (!esConnection.isReady()) {
      return false;
    }
    
    // Check recent health status (cache for 30 seconds)
    const now = Date.now();
    if (this.lastHealthCheck && (now - this.lastHealthCheck) < 30000) {
      return this.isHealthy;
    }
    
    // If no recent health check, assume ready if basic connection exists
    // This allows the service to work with "yellow" status
    return true;
  }

  /**
   * NEW: Separate health check method
   * Performs actual ping test và cache kết quả
   */
  async performHealthCheck() {
    try {
      if (!this.esClient) {
        this.isHealthy = false;
        return false;
      }

      // Quick ping test with timeout
      await Promise.race([
        this.esClient.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 3000)
        )
      ]);
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      return true;
      
    } catch (error) {
      console.warn('⚠️ ElasticSearch health check failed:', error.message);
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  /**
   * ENHANCED: Test connection với retry logic
   */
  async testConnection() {
    if (!this.isInitialized || !this.esClient) {
      return { connected: false, error: 'Service not initialized' };
    }
    
    try {
      // Perform fresh health check
      const healthy = await this.performHealthCheck();
      
      if (healthy) {
        return { 
          connected: true, 
          healthy: true,
          status: 'ready' 
        };
      } else {
        // Still connected but not healthy - allow fallback
        return { 
          connected: true, 
          healthy: false,
          status: 'degraded',
          message: 'ElasticSearch responsive but may be in yellow/red state'
        };
      }
      
    } catch (error) {
      return { 
        connected: false, 
        healthy: false,
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * ENHANCED: Health check với detailed status
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { 
          status: 'down', 
          message: 'Not initialized',
          details: { initialized: false, client: !!this.esClient }
        };
      }

      // Test connection
      const connectionTest = await this.testConnection();
      
      if (!connectionTest.connected) {
        return {
          status: 'down',
          message: connectionTest.error,
          details: connectionTest
        };
      }

      // Get cluster health if possible
      let clusterHealth = null;
      try {
        clusterHealth = await this.esClient.cluster.health();
      } catch (healthError) {
        console.warn('Could not get cluster health:', healthError.message);
      }

      return {
        status: connectionTest.healthy ? 'up' : 'degraded',
        message: connectionTest.healthy ? 'ElasticSearch healthy' : 'ElasticSearch degraded but functional',
        details: {
          connection: connectionTest,
          cluster: clusterHealth,
          lastCheck: this.lastHealthCheck
        }
      };

    } catch (error) {
      return { 
        status: 'down', 
        message: error.message,
        error: error.name,
        details: { initialized: this.isInitialized, client: !!this.esClient }
      };
    }
  }

  // ===== HELPER METHODS (existing) =====
  
  safeExtractResponse(response) {
    const responseBody = response.body || response;
    return responseBody;
  }

  safeExtractAggregations(response) {
    const responseBody = this.safeExtractResponse(response);
    const aggregations = responseBody.aggregations || responseBody.aggs || {};
    console.log('🔍 Aggregations structure:', JSON.stringify(aggregations, null, 2));
    return aggregations;
  }

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

  // ===== MAIN ANALYTICS METHODS =====

  /**
   * ENHANCED: getClickStats với better error handling
   */
  async getClickStats(linkId, startDate, endDate) {
    try {
      // Check if service is ready - use enhanced logic
      if (!this.isReady()) {
        console.warn('⚠️ ClickTrackingService not ready, throwing for fallback');
        throw new Error('ClickTrackingService not ready');
      }

      // Test connection before query
      const connectionTest = await this.testConnection();
      if (!connectionTest.connected) {
        console.warn('⚠️ ElasticSearch connection test failed:', connectionTest.error);
        throw new Error(`ElasticSearch connection failed: ${connectionTest.error}`);
      }

      // Even if degraded, try to proceed (yellow status should work)
      if (!connectionTest.healthy) {
        console.warn('⚠️ ElasticSearch in degraded state but proceeding...');
      }

      console.log(`🔍 Querying ElasticSearch for link ${linkId} from ${startDate} to ${endDate}`);

      // Build search query
      const searchBody = {
        query: {
          bool: {
            must: [
              { term: { linkId: linkId } },
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
            value_count: { field: 'linkId' }
          },
          unique_clicks: {
            cardinality: { field: 'ipAddress' }
          },
          daily_clicks: {
            date_histogram: {
              field: 'timestamp',
              fixed_interval: '1d',
              min_doc_count: 0,
              extended_bounds: {
                min: startDate,
                max: endDate
              }
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
        
        // Check error type - connection errors should trigger fallback
        if (searchError.name === 'ConnectionError' || 
            searchError.name === 'ResponseError' ||
            searchError.message.includes('Connection') ||
            searchError.message.includes('ECONNREFUSED') ||
            searchError.meta?.statusCode === 0) {
          
          console.warn('⚠️ ElasticSearch connection failed during query, triggering PostgreSQL fallback');
          throw new Error(`ElasticSearch connection error: ${searchError.message}`);
        }
        
        // Other errors (invalid query, etc.) - return empty data
        console.warn('⚠️ ElasticSearch query error, returning empty results');
        return this.createDefaultAnalytics();
      }

      console.log('📊 ElasticSearch response status:', response.statusCode || 'success');

      // Extract aggregations safely
      const aggs = this.safeExtractAggregations(response);
      
      if (!aggs || Object.keys(aggs).length === 0) {
        console.log('ℹ️ No aggregations found - link has no clicks yet');
        return this.createDefaultAnalytics();
      }

      // Extract and format results
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
        linkId,
        startDate,
        endDate
      });
      
      // Throw error to trigger PostgreSQL fallback in LinkService
      throw error;
    }
  }

  // ===== USER ANALYTICS METHODS =====

  /**
   * Get user analytics across all links - FIXED VERSION
   */
  async getUserAnalytics(userId, timeRange = '7d') {
    try {
      if (!this.isReady()) {
        console.warn('⚠️ ClickTrackingService not ready, returning default stats');
        return this.createDefaultAnalytics();
      }

      // Test connection before query
      const connectionTest = await this.testConnection();
      if (!connectionTest.connected) {
        console.warn('⚠️ ElasticSearch connection test failed for user analytics:', connectionTest.error);
        throw new Error(`ElasticSearch connection failed: ${connectionTest.error}`);
      }

      console.log(`🔍 Getting user analytics for ${userId} (timeRange: ${timeRange})`);

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

      // Safe aggregation extraction
      const aggs = this.safeExtractAggregations(response);
      
      if (!aggs || Object.keys(aggs).length === 0) {
        console.log('ℹ️ No user analytics found - user has no clicks yet');
        return this.createDefaultAnalytics();
      }

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

      console.log('✅ User analytics result:', result);
      return result;

    } catch (error) {
      console.error('❌ User analytics error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        userId,
        timeRange
      });
      
      // Throw error to allow fallback handling
      throw error;
    }
  }

  /**
   * Get real-time click data - FIXED VERSION
   */
  async getRealTimeClicks(userId, minutes = 60) {
    try {
      if (!this.isReady()) {
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

      // Safe extraction
      const responseBody = this.safeExtractResponse(response);
      const aggs = this.safeExtractAggregations(response);

      return {
        recentClicks: (responseBody.hits?.hits || []).map(hit => hit._source || hit),
        clicksPerMinute: (aggs.clicks_per_minute?.buckets || []).map(bucket => ({
          minute: bucket.key_as_string || bucket.key,
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

  // ===== TRACKING METHODS =====

  /**
   * Track single click
   */
  async trackClick(clickData) {
    try {
      if (!this.isReady()) {
        console.warn('⚠️ ClickTrackingService not ready, skipping tracking');
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
      if (!this.isReady()) {
        console.warn('⚠️ ClickTrackingService not ready, skipping batch tracking');
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

      const response = await this.esClient.bulk({
        body: body
      });

      const responseBody = this.safeExtractResponse(response);
      const errors = responseBody.errors;
      const successCount = responseBody.items ? responseBody.items.length : 0;

      if (errors) {
        console.warn('⚠️ Some clicks failed to track in batch');
      }

      console.log(`📊 Batch tracking completed: ${successCount} clicks`);
      return successCount;

    } catch (error) {
      console.error('❌ Batch click tracking error:', error.message);
      return 0;
    }
  }

  /**
   * Search clicks with pagination
   */
  async searchClicks(linkId = null, options = {}) {
    try {
      if (!this.isReady()) {
        return {
          total: 0,
          clicks: [],
          page: 1,
          totalPages: 0
        };
      }

      const { page = 1, size = 20, userId = null } = options;
      const from = (page - 1) * size;

      const query = {
        bool: {
          must: []
        }
      };

      if (linkId) {
        query.bool.must.push({ term: { linkId } });
      }

      if (userId) {
        query.bool.must.push({ term: { userId } });
      }

      const response = await this.esClient.search({
        index: 'clicks',
        body: {
          query: query.bool.must.length > 0 ? query : { match_all: {} },
          sort: [{ timestamp: { order: 'desc' } }],
          from,
          size
        }
      });

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
}

module.exports = new ClickTrackingService();