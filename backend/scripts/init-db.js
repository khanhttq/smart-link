// backend/scripts/init-db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://shortlink_user:shortlink_pass@localhost:5432/shortlink_db',
});

const initDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        google_id VARCHAR(255),
        role VARCHAR(50) DEFAULT 'viewer',
        api_key VARCHAR(255),
        api_limit INTEGER DEFAULT 1000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create links table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        id SERIAL PRIMARY KEY,
        short_code VARCHAR(50) UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        custom_alias VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        campaign_id INTEGER REFERENCES campaigns(id),
        user_id INTEGER REFERENCES users(id),
        tags TEXT[],
        click_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create click_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS click_logs (
        id SERIAL PRIMARY KEY,
        link_id INTEGER REFERENCES links(id),
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

    // Create indexes for performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_click_logs_link_id ON click_logs(link_id)');
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_click_logs_clicked_at ON click_logs(clicked_at)',
    );

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
