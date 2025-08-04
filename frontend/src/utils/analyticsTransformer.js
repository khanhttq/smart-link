// frontend/src/utils/analyticsTransformer.js - ES6 Data Transformation Utility
import dayjs from 'dayjs';

// ===== ES6 CONSTANTS =====
const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', 
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
];

const DEFAULT_ANALYTICS_STRUCTURE = {
  totalClicks: 0,
  uniqueClicks: 0,
  dailyClicks: [],
  topCountries: [],
  topDevices: [],
  topBrowsers: []
};

// ===== ES6 DATA VALIDATORS =====
const isValidAnalyticsData = (data) => {
  return data && typeof data === 'object' && !Array.isArray(data);
};

const isValidArrayData = (arr) => {
  return Array.isArray(arr) && arr.length > 0;
};

const sanitizeNumber = (value, defaultValue = 0) => {
  const num = parseInt(value) || defaultValue;
  return Math.max(0, num);
};

const sanitizeString = (value, defaultValue = 'Unknown') => {
  return (value && typeof value === 'string') ? value.trim() : defaultValue;
};

// ===== ES6 ANALYTICS DATA TRANSFORMER CLASS =====
export class AnalyticsTransformer {
  
  /**
   * Transform backend analytics response to frontend-ready format
   */
  static transformAnalyticsResponse(rawData) {
    if (!isValidAnalyticsData(rawData)) {
      console.warn('⚠️ Invalid analytics data received:', rawData);
      return this.createDefaultAnalytics();
    }

    try {
      // Handle different response structures
      const analyticsData = rawData.data || rawData;
      
      // Extract data from different possible structures
      const extractedData = {
        totalClicks: this.extractTotalClicks(analyticsData),
        uniqueClicks: this.extractUniqueClicks(analyticsData),
        dailyClicks: this.extractDailyClicks(analyticsData),
        topCountries: this.extractTopCountries(analyticsData),
        topDevices: this.extractTopDevices(analyticsData),
        topBrowsers: this.extractTopBrowsers(analyticsData),
        link: this.extractLinkInfo(analyticsData),
        period: this.extractPeriodInfo(analyticsData),
        meta: this.extractMetaInfo(analyticsData)
      };

      console.log('✅ Analytics data transformed:', extractedData);
      return extractedData;

    } catch (error) {
      console.error('❌ Analytics transformation error:', error);
      return this.createDefaultAnalytics();
    }
  }

  /**
   * Extract total clicks from various data structures
   */
  static extractTotalClicks(data) {
    return sanitizeNumber(
      data.totalClicks || 
      data.totals?.clicks || 
      data.breakdown?.totalClicks ||
      data.clickCount ||
      0
    );
  }

  /**
   * Extract unique clicks from various data structures
   */
  static extractUniqueClicks(data) {
    return sanitizeNumber(
      data.uniqueClicks || 
      data.totals?.uniqueClicks || 
      data.breakdown?.uniqueClicks ||
      data.uniqueClickCount ||
      0
    );
  }

  /**
   * Extract and normalize daily clicks data
   */
  static extractDailyClicks(data) {
    const sources = [
      data.dailyClicks,
      data.breakdown?.daily,
      data.breakdown?.dailyClicks,
      data.clicksOverTime
    ];

    for (const source of sources) {
      if (isValidArrayData(source)) {
        return source.map(item => ({
          date: this.normalizeDate(item.date || item.day || item.timestamp),
          clicks: sanitizeNumber(item.clicks || item.count || item.value),
          dateValue: item.date || item.day || item.timestamp
        })).filter(item => item.date); // Filter out invalid dates
      }
    }

    return [];
  }

  /**
   * Extract and normalize top countries data
   */
  static extractTopCountries(data) {
    const sources = [
      data.topCountries,
      data.breakdown?.countries,
      data.breakdown?.topCountries,
      data.countries
    ];

    for (const source of sources) {
      if (isValidArrayData(source)) {
        return source.map(item => ({
          country: sanitizeString(item.country || item.name || item.key),
          clicks: sanitizeNumber(item.clicks || item.count || item.value)
        })).filter(item => item.country !== 'Unknown' || item.clicks > 0);
      }
    }

    return [];
  }

  /**
   * Extract and normalize top devices data
   */
  static extractTopDevices(data) {
    const sources = [
      data.topDevices,
      data.breakdown?.devices,
      data.breakdown?.topDevices,
      data.devices
    ];

    for (const source of sources) {
      if (isValidArrayData(source)) {
        return source.map((item, index) => ({
          device: sanitizeString(item.device || item.deviceType || item.name || item.key),
          clicks: sanitizeNumber(item.clicks || item.count || item.value),
          color: CHART_COLORS[index] || '#d9d9d9',
          percentage: this.calculatePercentage(
            item.clicks || item.count || item.value, 
            this.extractTotalClicks(data)
          )
        })).filter(item => item.device !== 'Unknown' || item.clicks > 0);
      }
    }

    return [];
  }

  /**
   * Extract and normalize top browsers data
   */
  static extractTopBrowsers(data) {
    const sources = [
      data.topBrowsers,
      data.breakdown?.browsers,
      data.breakdown?.topBrowsers,
      data.browsers
    ];

    for (const source of sources) {
      if (isValidArrayData(source)) {
        return source.map(item => ({
          browser: sanitizeString(item.browser || item.name || item.key),
          clicks: sanitizeNumber(item.clicks || item.count || item.value)
        })).filter(item => item.browser !== 'Unknown' || item.clicks > 0);
      }
    }

    return [];
  }

  /**
   * Extract link information
   */
  static extractLinkInfo(data) {
    const linkInfo = data.link || data.linkInfo || null;
    
    if (!linkInfo) return null;

    return {
      id: linkInfo.id,
      title: sanitizeString(linkInfo.title || linkInfo.name, ''),
      shortCode: sanitizeString(linkInfo.shortCode || linkInfo.code, ''),
      originalUrl: sanitizeString(linkInfo.originalUrl || linkInfo.url, ''),
      domain: sanitizeString(linkInfo.domain, 'system'),
      createdAt: linkInfo.createdAt,
      isActive: linkInfo.isActive !== false
    };
  }

  /**
   * Extract period information
   */
  static extractPeriodInfo(data) {
    const periodInfo = data.period || data.dateRange || {};

    return {
      range: periodInfo.range || '7d',
      start: periodInfo.start || dayjs().subtract(7, 'days').toISOString(),
      end: periodInfo.end || dayjs().toISOString()
    };
  }

  /**
   * Extract meta information
   */
  static extractMetaInfo(data) {
    const metaInfo = data.meta || {};

    return {
      dataSource: metaInfo.dataSource || 'unknown',
      fallback: metaInfo.fallback || false,
      error: metaInfo.error || null,
      generatedAt: metaInfo.generatedAt || new Date().toISOString(),
      serviceStatus: metaInfo.serviceStatus || { elasticsearch: false }
    };
  }

  /**
   * Transform data for chart components
   */
  static transformForCharts(analyticsData) {
    const data = this.transformAnalyticsResponse(analyticsData);

    return {
      clicksOverTime: data.dailyClicks.map(item => ({
        date: dayjs(item.date).format('DD/MM'),
        clicks: item.clicks,
        dateValue: item.dateValue,
        fullDate: dayjs(item.date).format('DD/MM/YYYY')
      })),

      deviceData: data.topDevices.map((item, index) => ({
        name: item.device,
        value: item.clicks,
        color: CHART_COLORS[index] || '#d9d9d9',
        percentage: item.percentage || this.calculatePercentage(item.clicks, data.totalClicks)
      })),

      browserData: data.topBrowsers.map(item => ({
        browser: item.browser,
        clicks: item.clicks
      })),

      locationData: data.topCountries.map(item => ({
        country: item.country,
        clicks: item.clicks
      }))
    };
  }

  /**
   * Calculate statistics from transformed data
   */
  static calculateStats(analyticsData) {
    const data = this.transformAnalyticsResponse(analyticsData);
    
    const totalClicks = data.totalClicks;
    const uniqueClicks = data.uniqueClicks;
    const clickRate = totalClicks > 0 ? ((uniqueClicks / totalClicks) * 100) : 0;
    const avgDaily = data.dailyClicks.length > 0 ? 
      Math.round(totalClicks / data.dailyClicks.length) : 0;

    return {
      totalClicks,
      uniqueClicks,
      clickRate: parseFloat(clickRate.toFixed(1)),
      avgDaily
    };
  }

  /**
   * Validate and sanitize export data
   */
  static prepareExportData(analyticsData, format = 'json') {
    const data = this.transformAnalyticsResponse(analyticsData);
    
    const exportData = {
      summary: {
        totalClicks: data.totalClicks,
        uniqueClicks: data.uniqueClicks,
        clickThroughRate: this.calculatePercentage(data.uniqueClicks, data.totalClicks),
        dataSource: data.meta.dataSource,
        exportedAt: new Date().toISOString()
      },
      link: data.link,
      period: data.period,
      breakdown: {
        daily: data.dailyClicks,
        countries: data.topCountries,
        devices: data.topDevices,
        browsers: data.topBrowsers
      }
    };

    if (format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return exportData;
  }

  // ===== ES6 UTILITY METHODS =====

  /**
   * Normalize date to consistent format
   */
  static normalizeDate(dateValue) {
    if (!dateValue) return null;
    
    try {
      const date = dayjs(dateValue);
      return date.isValid() ? date.format('YYYY-MM-DD') : null;
    } catch {
      return null;
    }
  }

  /**
   * Calculate percentage with safe division
   */
  static calculatePercentage(value, total) {
    if (!total || total === 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
  }

  /**
   * Create default analytics structure
   */
  static createDefaultAnalytics() {
    return {
      ...DEFAULT_ANALYTICS_STRUCTURE,
      link: null,
      period: {
        range: '7d',
        start: dayjs().subtract(7, 'days').toISOString(),
        end: dayjs().toISOString()
      },
      meta: {
        dataSource: 'none',
        fallback: true,
        error: 'No data available',
        generatedAt: new Date().toISOString(),
        serviceStatus: { elasticsearch: false }
      }
    };
  }

  /**
   * Convert data to CSV format
   */
  static convertToCSV(data) {
    const rows = [
      'Category,Item,Value',
      `Summary,Total Clicks,${data.summary.totalClicks}`,
      `Summary,Unique Clicks,${data.summary.uniqueClicks}`,
      `Summary,Click Through Rate,${data.summary.clickThroughRate}%`,
      '',
      'Daily Stats,Date,Clicks',
      ...data.breakdown.daily.map(item => `Daily Stats,${item.date},${item.clicks}`),
      '',
      'Countries,Country,Clicks',
      ...data.breakdown.countries.map(item => `Countries,${item.country},${item.clicks}`),
      '',
      'Devices,Device,Clicks',
      ...data.breakdown.devices.map(item => `Devices,${item.device},${item.clicks}`),
      '',
      'Browsers,Browser,Clicks',
      ...data.breakdown.browsers.map(item => `Browsers,${item.browser},${item.clicks}`)
    ];

    return rows.join('\n');
  }

  /**
   * Handle error responses from API
   */
  static handleErrorResponse(error, fallbackData = null) {
    console.error('❌ Analytics API Error:', error);
    
    // If we have fallback data from a 200 response with warning
    if (fallbackData && error.fallback) {
      return this.transformAnalyticsResponse(fallbackData);
    }
    
    // Return default structure for complete failures
    return this.createDefaultAnalytics();
  }
}

// ===== ES6 CONVENIENCE EXPORTS =====
export const {
  transformAnalyticsResponse,
  transformForCharts,
  calculateStats,
  prepareExportData,
  handleErrorResponse
} = AnalyticsTransformer;

export default AnalyticsTransformer;