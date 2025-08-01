// config/elasticsearch.js
const { Client } = require('@elastic/elasticsearch');

class ElasticSearchConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Docker Desktop ES usually runs without auth
      this.client = new Client({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        // Remove auth for Docker Desktop default setup
        requestTimeout: 60000,
        pingTimeout: 30000,
        maxRetries: 3,
        resurrectStrategy: 'ping'
      });

      // Test connection
      const health = await this.client.cluster.health();
      console.log('🔍 ElasticSearch connected:', health.status);
      this.isConnected = true;

      // Setup indexes
      await this.setupIndexes();

      return this.client;
    } catch (error) {
      console.error('❌ ElasticSearch connection failed:', error.message);
      
      // For development, create mock client if ES not available
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Using mock ElasticSearch client for development');
        this.client = this.createMockClient();
        this.isConnected = true;
        return this.client;
      }
      
      throw error;
    }
  }

  async setupIndexes() {
    const indexes = [
      {
        index: 'clicks',
        mapping: {
          properties: {
            linkId: { type: 'keyword' },
            userId: { type: 'keyword' },
            shortCode: { type: 'keyword' },
            originalUrl: { type: 'text' },
            campaign: { type: 'keyword' },
            timestamp: { type: 'date' },
            '@timestamp': { type: 'date' },
            date: { type: 'date' },
            hour: { type: 'date' },
            ipAddress: { type: 'ip' },
            country: { type: 'keyword' },
            city: { type: 'keyword' },
            deviceType: { type: 'keyword' },
            browser: { type: 'keyword' },
            os: { type: 'keyword' },
            referrer: { type: 'text' },
            userAgent: { type: 'text' }
          }
        }
      },
      {
        index: 'analytics-daily',
        mapping: {
          properties: {
            date: { type: 'date' },
            userId: { type: 'keyword' },
            linkId: { type: 'keyword' },
            totalClicks: { type: 'integer' },
            uniqueClicks: { type: 'integer' },
            countries: { type: 'nested' },
            devices: { type: 'nested' },
            browsers: { type: 'nested' }
          }
        }
      }
    ];

    for (const { index, mapping } of indexes) {
      try {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          await this.client.indices.create({
            index,
            body: { mappings: mapping }
          });
          console.log(`✅ Created index: ${index}`);
        } else {
          console.log(`ℹ️ Index already exists: ${index}`);
        }
      } catch (error) {
        console.error(`❌ Error setting up index ${index}:`, error.message);
      }
    }
  }

  // Mock client for development when ES is not available
  createMockClient() {
    return {
      index: async (params) => {
        console.log('🚧 Mock ES Index:', params.index, 'Document:', JSON.stringify(params.body, null, 2));
        return { body: { _id: 'mock_' + Date.now() } };
      },
      
      bulk: async (params) => {
        console.log('🚧 Mock ES Bulk:', params.body.length / 2, 'documents');
        return { body: { items: new Array(params.body.length / 2).fill({ index: { _id: 'mock_' + Date.now() } }) } };
      },
      
      search: async (params) => {
        console.log('🚧 Mock ES Search:', params.index, 'Query:', JSON.stringify(params.body?.query, null, 2));
        return {
          body: {
            hits: {
              total: { value: 0 },
              hits: []
            },
            aggregations: {
              total_clicks: { value: 0 },
              unique_clicks: { value: 0 },
              daily_clicks: { buckets: [] },
              top_countries: { buckets: [] },
              top_devices: { buckets: [] },
              top_browsers: { buckets: [] }
            }
          }
        };
      },
      
      cluster: {
        health: async () => ({ status: 'mock' })
      },
      
      indices: {
        exists: async () => false,
        create: async (params) => {
          console.log('🚧 Mock ES Create Index:', params.index);
          return { acknowledged: true };
        }
      }
    };
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected;
  }
}

module.exports = new ElasticSearchConnection();