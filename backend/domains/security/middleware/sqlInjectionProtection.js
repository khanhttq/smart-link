// backend/domains/security/middleware/sqlInjectionProtection.js
const sqlInjection = require('sql-injection');

// ===== SQL INJECTION DETECTION PATTERNS =====
const SQL_INJECTION_PATTERNS = [
  // Basic SQL injection patterns (more specific)
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b).*(\b(FROM|WHERE|INTO|VALUES|SET)\b)/i,
  /(\'|\")(\s)*(OR|AND)(\s)*(\w)*(\s)*(=|LIKE)(\s)*(\'|\")/i,
  /(\'|\")(\s)*(OR|AND)(\s)*(\'|\")/i,
  
  // SQL injection with quotes and operators
  /(\s|^|\()(\w)*(\s)*(=|LIKE)(\s)*(\'|\").*(\')(\s)*(OR|AND)/i,
  /(\/\*|\*\/|--|#).*(\w)/i, // Comments with content
  /(UNION(\s)+SELECT)/i,
  /(\'\s*OR\s*\'\s*1\s*\'\s*=\s*\'\s*1|\'\s*OR\s*1\s*=\s*1)/i, // Classic OR 1=1
  
  // More specific patterns to avoid false positives
  /(\w+\s*=\s*\w+\s*--)/i, // Variable equals variable with comment
  /(\'\s*;\s*(DROP|DELETE|UPDATE|INSERT))/i, // Semicolon followed by dangerous commands
  
  // Hex and Unicode evasion (more specific)
  /(0x[0-9a-f]+).*(\b(SELECT|UNION|DROP)\b)/i,
  
  // Command injection (more specific)
  /(\||&|;|\$\(|\`).*(\b(rm|del|format|shutdown|wget|curl|nc|netcat)\b)/i
];

// ===== RELAXED PATTERNS FOR COMMON FALSE POSITIVES =====
const SAFE_PATTERNS = [
  /^[0-9]+$/, // Pure numbers
  /^page=[0-9]+$/i, // Pagination
  /^limit=[0-9]+$/i, // Limits
  /^offset=[0-9]+$/i, // Offsets
  /^sort=[a-zA-Z_]+$/i, // Simple sorting
  /^order=(asc|desc)$/i, // Order direction
  /^id=[0-9a-f-]+$/i, // UUIDs or simple IDs
];

// ===== IMPROVED SQL INJECTION CHECKER =====
const checkSQLInjection = (input) => {
  if (typeof input !== 'string') return false;
  
  // Skip very short inputs
  if (input.length < 3) return false;
  
  // Check if input matches safe patterns
  if (SAFE_PATTERNS.some(pattern => pattern.test(input))) {
    return false;
  }
  
  // Decode URL encoding and HTML entities
  let decodedInput = input;
  try {
    decodedInput = decodeURIComponent(input);
    decodedInput = decodedInput.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  } catch (e) {
    // Invalid URL encoding might be an attack
    return true;
  }
  
  // Check against SQL injection patterns
  const isSqlInjection = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(decodedInput));
  
  if (isSqlInjection) {
    console.log(`🔍 SQL Injection detected in: "${input}" (decoded: "${decodedInput}")`);
  }
  
  return isSqlInjection;
};

// ===== SAFE USER AGENTS WHITELIST =====
const SAFE_USER_AGENT_PATTERNS = [
  /Mozilla\/[0-9.]+/i, // Standard browser user agents
  /Chrome\/[0-9.]+/i,
  /Safari\/[0-9.]+/i,
  /Firefox\/[0-9.]+/i,
  /Edge\/[0-9.]+/i,
  /WindowsPowerShell\/[0-9.]+/i, // PowerShell is legitimate
  /curl\/[0-9.]+/i, // curl is legitimate
  /PostmanRuntime\/[0-9.]+/i, // Postman is legitimate
  /insomnia\/[0-9.]+/i, // Insomnia is legitimate
];

// ===== COMPREHENSIVE INPUT SCANNER =====
const scanInput = (input, path = '') => {
  const issues = [];
  
  if (typeof input === 'string') {
    // Skip scanning for known safe user agents
    if (path === 'headers.user-agent' && 
        SAFE_USER_AGENT_PATTERNS.some(pattern => pattern.test(input))) {
      return issues; // Skip scanning user agents that match safe patterns
    }
    // SQL injection check
    if (checkSQLInjection(input)) {
      issues.push({
        type: 'SQL_INJECTION',
        path,
        value: input.substring(0, 100), // Truncate for logging
        severity: 'CRITICAL' // Changed from HIGH to CRITICAL
      });
    }
    
    // XSS check (basic patterns)
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi
    ];
    
    if (xssPatterns.some(pattern => pattern.test(input))) {
      issues.push({
        type: 'XSS_ATTEMPT',
        path,
        value: input.substring(0, 100),
        severity: 'CRITICAL' // XSS should also be CRITICAL
      });
    }
    
    // Command injection patterns (more specific)
    const commandPatterns = [
      // Only flag if command + dangerous operations together
      /(\||&|;|\$\(|\`).*(\b(rm|del|format|shutdown|wget|curl|nc|netcat|cat|ls|dir)\b)/i,
      /(\b(rm|del|format|shutdown)\b).*(\s+.*\/|\\)/i, // Commands with paths
      /(\$\(.*\)|`.*`)/i, // Command substitution
      // Remove single | & ; as they're common in user agents
    ];
    
    if (commandPatterns.some(pattern => pattern.test(input))) {
      issues.push({
        type: 'COMMAND_INJECTION',
        path,
        value: input.substring(0, 100),
        severity: 'CRITICAL'
      });
    }
    
    // Path traversal
    if (/\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/i.test(input)) {
      issues.push({
        type: 'PATH_TRAVERSAL',
        path,
        value: input.substring(0, 100),
        severity: 'HIGH'
      });
    }
    
  } else if (Array.isArray(input)) {
    input.forEach((item, index) => {
      issues.push(...scanInput(item, `${path}[${index}]`));
    });
  } else if (typeof input === 'object' && input !== null) {
    Object.keys(input).forEach(key => {
      issues.push(...scanInput(input[key], path ? `${path}.${key}` : key));
    });
  }
  
  return issues;
};

// ===== SQL INJECTION PROTECTION MIDDLEWARE =====
const sqlInjectionProtection = (req, res, next) => {
  const startTime = Date.now();
  let allIssues = [];
  
  // Scan request body
  if (req.body) {
    const bodyIssues = scanInput(req.body, 'body');
    allIssues.push(...bodyIssues);
  }
  
  // Scan query parameters
  if (req.query) {
    const queryIssues = scanInput(req.query, 'query');
    allIssues.push(...queryIssues);
  }
  
  // Scan URL parameters
  if (req.params) {
    const paramIssues = scanInput(req.params, 'params');
    allIssues.push(...paramIssues);
  }
  
  // Scan headers (selective)
  const headersToScan = ['user-agent', 'referer', 'x-forwarded-for'];
  headersToScan.forEach(header => {
    if (req.headers[header]) {
      const headerIssues = scanInput(req.headers[header], `headers.${header}`);
      allIssues.push(...headerIssues);
    }
  });
  
  const scanTime = Date.now() - startTime;
  
  // Log security issues
  if (allIssues.length > 0) {
    const criticalIssues = allIssues.filter(issue => issue.severity === 'CRITICAL');
    const highIssues = allIssues.filter(issue => issue.severity === 'HIGH');
    
    console.error('🚨 SECURITY THREAT DETECTED:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl,
      method: req.method,
      issues: allIssues,
      scanTime: `${scanTime}ms`
    });
    
    // Block critical threats immediately
    if (criticalIssues.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'SECURITY_VIOLATION',
        message: 'Request blocked due to security policy violation',
        code: 'CRITICAL_THREAT_DETECTED'
      });
    }
    
    // Log high severity issues but allow request (with monitoring)
    if (highIssues.length > 0) {
      // TODO: Send alert to security team
      // TODO: Increment threat score for IP
      console.warn('⚠️ High severity security issue detected but allowing request');
    }
  }
  
  // Add scan results to request for logging
  req.securityScan = {
    issues: allIssues,
    scanTime,
    clean: allIssues.length === 0
  };
  
  next();
};

// ===== SEQUELIZE QUERY PROTECTION =====
const protectSequelizeQuery = (queryString) => {
  // Additional protection for raw Sequelize queries
  if (typeof queryString !== 'string') return queryString;
  
  // Block dangerous SQL keywords in raw queries
  const dangerousKeywords = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER', 
    'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'TRUNCATE'
  ];
  
  const upperQuery = queryString.toUpperCase();
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      throw new Error(`Dangerous SQL keyword '${keyword}' detected in query`);
    }
  }
  
  return queryString;
};

// ===== MONGODB QUERY PROTECTION =====
const protectMongoQuery = (query) => {
  if (typeof query !== 'object' || query === null) return query;
  
  // Check for NoSQL injection patterns
  const dangerousOperators = ['$where', '$regex', '$text', '$expr'];
  
  const checkObject = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (dangerousOperators.includes(key)) {
        throw new Error(`Dangerous MongoDB operator '${key}' detected at ${path}${key}`);
      }
      
      if (typeof value === 'object' && value !== null) {
        checkObject(value, `${path}${key}.`);
      }
    }
  };
  
  checkObject(query);
  return query;
};

// ===== SECURITY AUDIT LOGGER =====
const logSecurityEvent = (req, eventType, details = {}) => {
  const securityEvent = {
    timestamp: new Date().toISOString(),
    eventType,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id || null,
    sessionId: req.sessionId || null,
    details
  };
  
  console.log('🔒 Security Event:', securityEvent);
  
  // TODO: Send to security monitoring service
  // securityMonitor.logEvent(securityEvent);
};

module.exports = {
  sqlInjectionProtection,
  checkSQLInjection,
  scanInput,
  protectSequelizeQuery,
  protectMongoQuery,
  logSecurityEvent
};