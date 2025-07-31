// backend/services/elasticsearch.js
const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('🔍 Connecting to Elasticsearch at localhost:9200...');

      this.client = new Client({
        node: 'http://localhost:9200',
      });

      // Simple ping test first
      console.log('🔍 Testing Elasticsearch ping...');
      await this.client.ping();
      console.log('🏓 Elasticsearch ping successful');

      // Get basic info
      try {
        const info = await this.client.info();
        console.log('✅ Elasticsearch connected:', info.body.cluster_name);
        console.log('📊 ES Version:', info.body.version.number);
      } catch (infoError) {
        console.log('✅ Elasticsearch connected (basic ping works)');
      }

      this.isConnected = true;

      // Initialize indices
      await this.initializeIndices();

      return true;
    } catch (error) {
      console.error('❌ Elasticsearch connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔍 Elasticsearch disconnected');
    }
  }

  // =================== INDEX MANAGEMENT ===================

  async initializeIndices() {
    try {
      // Create links index
      const shortlinksIndexExists = await this.client.indices.exists({ index: 'shortlinks' });
      if (!shortlinksIndexExists) {
        await this.createIndex('shortlinks', {
          mappings: {
            properties: {
              shortCode: { type: 'keyword' },
              originalUrl: { type: 'text', analyzer: 'standard' },
              title: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              tags: { type: 'keyword' },
              userId: { type: 'integer' },
              campaignId: { type: 'integer' },
              clickCount: { type: 'integer' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        });
      }
      // Create click logs index
      const clickLogsIndexExists = await this.client.indices.exists({ index: 'click-logs' });
      if (!clickLogsIndexExists) {
        await this.createIndex('click-logs', {
          mappings: {
            properties: {
              shortCode: { type: 'keyword' },
              linkId: { type: 'integer' },
              ipAddress: { type: 'ip' },
              userAgent: { type: 'text', analyzer: 'standard' },
              referrer: { type: 'keyword' },
              country: { type: 'keyword' },
              city: { type: 'keyword' },
              deviceType: { type: 'keyword' },
              browser: { type: 'keyword' },
              os: { type: 'keyword' },
              clickedAt: { type: 'date' },
            },
          },
        });
      }
      console.log('✅ Elasticsearch indices initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize indices:', error.message);
      return false;
    }
  }

  async createIndex(indexName, mapping) {
    if (!this.isConnected) return false;

    try {
      const exists = await this.client.indices.exists({ index: indexName });

      if (!exists.body) {
        await this.client.indices.create({
          index: indexName,
          body: mapping,
        });
        console.log(`📇 Created index: ${indexName}`);
      } else {
        console.log(`📇 Index already exists: ${indexName}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to create index ${indexName}:`, error.message);
      return false;
    }
  }

  // =================== LINK INDEXING ===================

  // Index a link for search
  async indexLink(linkData) {
    if (!this.isConnected) return false;

    try {
      const document = {
        shortCode: linkData.short_code || linkData.shortCode,
        originalUrl: linkData.original_url || linkData.originalUrl,
        title: linkData.title || '',
        description: linkData.description || '',
        tags: linkData.tags || [],
        userId: linkData.user_id || linkData.userId,
        campaignId: linkData.campaign_id || linkData.campaignId,
        clickCount: linkData.click_count || linkData.clickCount || 0,
        isActive: linkData.is_active !== undefined ? linkData.is_active : linkData.isActive,
        createdAt: linkData.created_at || linkData.createdAt || new Date(),
        updatedAt: linkData.updated_at || linkData.updatedAt || new Date(),
      };

      const response = await this.client.index({
        index: 'shortlinks',
        id: linkData.id,
        body: document,
      });

      // Handle different response formats
      const result = response.body?.result || response.statusCode === 201 ? 'created' : 'indexed';
      console.log(`🔍 Indexed link: ${document.shortCode} (${result})`);
      return true;
    } catch (error) {
      console.error('Failed to index link:', error.message);
      return false;
    }
  }

  // Update link in index
  async updateLink(linkId, updates) {
    if (!this.isConnected) return false;

    try {
      await this.client.update({
        index: 'shortlinks',
        id: linkId,
        body: {
          doc: {
            ...updates,
            updatedAt: new Date(),
          },
        },
      });

      console.log(`🔍 Updated link index: ${linkId}`);
      return true;
    } catch (error) {
      console.error('Failed to update link:', error.message);
      return false;
    }
  }

  // =================== CLICK LOGGING ===================

  // Log click event
  async logClick(clickData) {
    if (!this.isConnected) return false;

    try {
      const document = {
        shortCode: clickData.shortCode,
        linkId: clickData.linkId,
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referrer: clickData.referrer,
        country: clickData.country || 'Unknown',
        city: clickData.city || 'Unknown',
        deviceType: clickData.deviceType || 'Unknown',
        browser: clickData.browser || 'Unknown',
        os: clickData.os || 'Unknown',
        clickedAt: clickData.clickedAt || new Date(),
      };

      const response = await this.client.index({
        index: 'click-logs',
        body: document,
      });

      const result = response.body?.result || 'logged';
      console.log(`🔍 Logged click: ${document.shortCode} (${result})`);
      return true;
    } catch (error) {
      console.error('Failed to log click:', error.message);
      return false;
    }
  }

  // =================== SEARCH FUNCTIONALITY ===================

  // Search links
  async searchLinks(query, filters = {}, page = 1, limit = 10) {
    if (!this.isConnected) return { hits: [], total: 0 };

    try {
      const searchQuery = {
        index: 'shortlinks',
        body: {
          query: {
            bool: {
              must: [],
              filter: [],
            },
          },
          sort: [{ createdAt: { order: 'desc' } }],
          from: (page - 1) * limit,
          size: limit,
        },
      };

      // Add search query
      if (query && query.trim()) {
        searchQuery.body.query.bool.must.push({
          multi_match: {
            query: query,
            fields: ['originalUrl^2', 'title^3', 'description', 'tags^2'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      } else {
        searchQuery.body.query.bool.must.push({ match_all: {} });
      }

      // Add filters
      if (filters.userId) {
        searchQuery.body.query.bool.filter.push({
          term: { userId: filters.userId },
        });
      }

      if (filters.isActive !== undefined) {
        searchQuery.body.query.bool.filter.push({
          term: { isActive: filters.isActive },
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        searchQuery.body.query.bool.filter.push({
          terms: { tags: filters.tags },
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        const dateRange = {};
        if (filters.dateFrom) dateRange.gte = filters.dateFrom;
        if (filters.dateTo) dateRange.lte = filters.dateTo;

        searchQuery.body.query.bool.filter.push({
          range: { createdAt: dateRange },
        });
      }

      const response = await this.client.search(searchQuery);

      return {
        hits: response.body.hits.hits.map(hit => ({
          id: hit._id,
          score: hit._score,
          ...hit._source,
        })),
        total: response.body.hits.total.value,
        maxScore: response.body.hits.max_score,
      };
    } catch (error) {
      console.error('Search failed:', error.message);
      return { hits: [], total: 0 };
    }
  }

  // =================== ANALYTICS ===================

  // Get click analytics
  async getClickAnalytics(filters = {}) {
    if (!this.isConnected) return {};

    try {
      const searchQuery = {
        index: 'click-logs',
        body: {
          query: {
            bool: {
              filter: [],
            },
          },
          aggs: {
            clicks_over_time: {
              date_histogram: {
                field: 'clickedAt',
                calendar_interval: '1d',
                format: 'yyyy-MM-dd',
              },
            },
            top_countries: {
              terms: {
                field: 'country',
                size: 10,
              },
            },
            top_browsers: {
              terms: {
                field: 'browser',
                size: 10,
              },
            },
            device_types: {
              terms: {
                field: 'deviceType',
                size: 10,
              },
            },
            top_referrers: {
              terms: {
                field: 'referrer',
                size: 10,
              },
            },
          },
          size: 0,
        },
      };

      // Add filters
      if (filters.shortCode) {
        searchQuery.body.query.bool.filter.push({
          term: { shortCode: filters.shortCode },
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        const dateRange = {};
        if (filters.dateFrom) dateRange.gte = filters.dateFrom;
        if (filters.dateTo) dateRange.lte = filters.dateTo;

        searchQuery.body.query.bool.filter.push({
          range: { clickedAt: dateRange },
        });
      }

      const response = await this.client.search(searchQuery);
      const aggs = response.body.aggregations;

      return {
        totalClicks: response.body.hits.total.value,
        clicksOverTime: aggs.clicks_over_time.buckets.map(bucket => ({
          date: bucket.key_as_string,
          clicks: bucket.doc_count,
        })),
        topCountries: aggs.top_countries.buckets.map(bucket => ({
          country: bucket.key,
          clicks: bucket.doc_count,
        })),
        topBrowsers: aggs.top_browsers.buckets.map(bucket => ({
          browser: bucket.key,
          clicks: bucket.doc_count,
        })),
        deviceTypes: aggs.device_types.buckets.map(bucket => ({
          device: bucket.key,
          clicks: bucket.doc_count,
        })),
        topReferrers: aggs.top_referrers.buckets.map(bucket => ({
          referrer: bucket.key,
          clicks: bucket.doc_count,
        })),
      };
    } catch (error) {
      console.error('Analytics query failed:', error.message);
      return {};
    }
  }

  // =================== UTILITY METHODS ===================

  // Health check
  async ping() {
    if (!this.isConnected) return false;

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Elasticsearch ping error:', error.message);
      return false;
    }
  }

  // Get cluster info
  async getInfo() {
    if (!this.isConnected) return null;

    try {
      const health = await this.client.cluster.health();
      const stats = await this.client.cluster.stats();

      return {
        health: health.body,
        stats: stats.body,
      };
    } catch (error) {
      console.error('Get Elasticsearch info error:', error.message);
      return null;
    }
  }

  // Delete index (use with caution)
  async deleteIndex(indexName) {
    if (!this.isConnected) return false;

    try {
      await this.client.indices.delete({ index: indexName });
      console.log(`🗑️ Deleted index: ${indexName}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete index ${indexName}:`, error.message);
      return false;
    }
  }
}

// Export singleton instance
const elasticsearchService = new ElasticsearchService();
module.exports = elasticsearchService;
