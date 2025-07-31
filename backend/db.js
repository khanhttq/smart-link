// backend/db.js - Complete Database connection and queries
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://shortlink_user:shortlink_pass@localhost:5432/shortlink_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('🗄️ Database connected successfully:', result.rows[0].current_time);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
};

// Initialize database tables
const initDatabase = async () => {
  try {
    const client = await pool.connect();

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        api_key VARCHAR(255),
        api_limit INTEGER DEFAULT 1000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create links table
    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(50) UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        custom_alias VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tags TEXT[],
        click_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create click_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id SERIAL PRIMARY KEY,
        link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
        ip_address INET,
        user_agent TEXT,
        referrer TEXT,
        country VARCHAR(10),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_click_logs_link_id ON click_logs(link_id)');

    // NOTE: Don't create demo users - let setup process handle first admin
    // Demo users will be created via setup route instead

    console.log('✅ Database tables initialized successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    return false;
  }
};

// Database query functions
const db = {
  // Test connection
  testConnection,

  // Initialize database
  initDatabase,

  // =================== LINK FUNCTIONS ===================

  // Create a new link
  createLink: async (shortCode, originalUrl, userId = null, customAlias = null) => {
    try {
      const result = await pool.query(
        'INSERT INTO links (short_code, original_url, user_id, custom_alias) VALUES ($1, $2, $3, $4) RETURNING *',
        [shortCode, originalUrl, userId, customAlias],
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create link: ${err.message}`);
    }
  },

  // Get link by short code
  getLinkByShortCode: async shortCode => {
    try {
      const result = await pool.query(
        'SELECT * FROM links WHERE short_code = $1 AND is_active = true',
        [shortCode],
      );
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to get link: ${err.message}`);
    }
  },

  // Update click count
  incrementClickCount: async linkId => {
    try {
      const result = await pool.query(
        'UPDATE links SET click_count = click_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING click_count',
        [linkId],
      );
      return result.rows[0]?.click_count || 0;
    } catch (err) {
      throw new Error(`Failed to increment click count: ${err.message}`);
    }
  },

  // Log click for analytics
  logClick: async (linkId, ipAddress, userAgent, referrer = null) => {
    try {
      const result = await pool.query(
        `
        INSERT INTO click_logs (link_id, ip_address, user_agent, referrer) 
        VALUES ($1, $2, $3, $4) RETURNING *`,
        [linkId, ipAddress, userAgent, referrer],
      );
      return result.rows[0];
    } catch (err) {
      console.error('Failed to log click:', err.message);
      // Don't throw error - analytics logging shouldn't break redirect
      return null;
    }
  },

  // Get all links (for debug)
  getAllLinks: async () => {
    try {
      const result = await pool.query('SELECT * FROM links ORDER BY created_at DESC');
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get all links: ${err.message}`);
    }
  },

  // Get link analytics
  getLinkAnalytics: async linkId => {
    try {
      const linkResult = await pool.query('SELECT * FROM links WHERE id = $1', [linkId]);

      const clicksResult = await pool.query(
        `
        SELECT 
          DATE_TRUNC('day', clicked_at) as date,
          COUNT(*) as clicks
        FROM click_logs 
        WHERE link_id = $1 
        GROUP BY DATE_TRUNC('day', clicked_at)
        ORDER BY date DESC
        LIMIT 30`,
        [linkId],
      );

      return {
        link: linkResult.rows[0],
        dailyClicks: clicksResult.rows,
      };
    } catch (err) {
      throw new Error(`Failed to get analytics: ${err.message}`);
    }
  },

  // =================== USER FUNCTIONS ===================

  // Create a new user
  createUser: async (email, passwordHash, role = 'user') => {
    try {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
        [email, passwordHash, role],
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create user: ${err.message}`);
    }
  },

  // Get user by email
  getUserByEmail: async email => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to get user by email: ${err.message}`);
    }
  },

  // Get user by ID
  getUserById: async userId => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to get user by ID: ${err.message}`);
    }
  },

  // Update last login timestamp
  updateLastLogin: async userId => {
    try {
      await pool.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    } catch (err) {
      console.error('Failed to update last login:', err.message);
    }
  },

  // Update user password
  updateUserPassword: async (userId, passwordHash) => {
    try {
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, userId],
      );
    } catch (err) {
      throw new Error(`Failed to update password: ${err.message}`);
    }
  },

  // Get user's links
  getUserLinks: async userId => {
    try {
      const result = await pool.query(
        'SELECT * FROM links WHERE user_id = $1 ORDER BY created_at DESC',
        [userId],
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get user links: ${err.message}`);
    }
  },

  // Check if system needs setup (admin exists)
  checkSetupStatus: async () => {
    try {
      const result = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      const adminCount = parseInt(result.rows[0].count);
      return {
        needsSetup: adminCount === 0,
        adminCount,
      };
    } catch (err) {
      console.error('Setup status check error:', err);
      // If error checking, assume needs setup
      return {
        needsSetup: true,
        adminCount: 0,
      };
    }
  },

  // Check if email exists
  checkEmailExists: async email => {
    try {
      const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      return result.rows.length > 0;
    } catch (err) {
      console.error('Email check error:', err);
      return false;
    }
  },

  // Close connection pool
  close: () => {
    return pool.end();
  },
};

module.exports = db;
