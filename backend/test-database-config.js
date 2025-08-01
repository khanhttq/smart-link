// test-database-config.js
const config = require('./config');

console.log('🧪 Testing database configuration...\n');

console.log('📊 Database Config:');
console.log(`Host: ${config.database.host}:${config.database.port}`);
console.log(`Database: ${config.database.name}`);
console.log(`User: ${config.database.user}`);
console.log(`Password: ${'*'.repeat(config.database.password.length)}`);

console.log('\n📊 Redis Config:');
console.log(`Host: ${config.redis.host}:${config.redis.port}`);
console.log(`Password: ${config.redis.password ? 'Set' : 'None'}`);

console.log('\n📊 JWT Config:');
console.log(`Secret: ${'*'.repeat(config.jwt.secret.length)}`);
console.log(`Expires: ${config.jwt.expiresIn}`);

console.log('\n✅ Configuration loaded successfully!');