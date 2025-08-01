// config/elasticsearch.js
const { Client } = require('@elastic/elasticsearch');
const config = require('./index');

class ElasticSearchConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Client({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
          password: process.env.ELASTICSEARCH_PASSWORD || 'password'
        },
        requestTimeout: 60000,
        pingTimeout: 30000,
        maxRetries: 3,
        resurrectStrategy: 'ping'
      });

      // Test connection
      const health = await this.client.cluster.health();
      console.log('🔍 ElasticSearch connected:', health.body.status);
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
        
        if (!exists.body) {
          await this.client.indices.create({
            index,
            body: { mappings: mapping }
          });
          console.log(`✅ Created ElasticSearch index: ${index}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create index ${index}:`, error.message);
      }
    }
  }

  createMockClient() {
    return {
      index: async () => ({ body: { _id: 'mock_id', result: 'created' } }),
      search: async () => ({ 
        body: { 
          hits: { 
            total: { value: 0 }, 
            hits: [] 
          },
          aggregations: {}
        } 
      }),
      cluster: {
        health: async () => ({ body: { status: 'mock' } })
      },
      indices: {
        exists: async () => ({ body: true }),
        create: async () => ({ body: { acknowledged: true } })
      }
    };
  }

  getClient() {
    if (!this.client) {
      throw new Error('ElasticSearch not connected');
    }
    return this.client;
  }

  async ping() {
    try {
      if (!this.client) return false;
      const response = await this.client.ping();
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ElasticSearchConnection();