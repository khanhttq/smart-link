// frontend/src/pages/AnalyticsPage.js - ES6 Enhanced with Modern React and Improved UX
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { generateShortUrl } from '../utils/urlUtils';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Select, 
  Typography, 
  Space, 
  Empty,
  Spin,
  Button,
  message,
  Alert,
  Dropdown,
  Tooltip,
  Badge,
  Tag
} from 'antd';
import {
  BarChartOutlined,
  EyeOutlined,
  UserOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import {
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { useLinkStore } from '../stores/linkStore';
import { analyticsApi, ApiError, NetworkError } from '../utils/apiClient';
import { AnalyticsTransformer } from '../utils/analyticsTransformer';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// ===== ES6 CONSTANTS =====
const DATE_RANGES = {
  '24h': { label: '24 giờ qua', value: '1d' },
  '7d': { label: '7 ngày qua', value: '7d' },
  '30d': { label: '30 ngày qua', value: '30d' },
  '90d': { label: '3 tháng qua', value: '90d' }
};

const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', 
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
];

const EXPORT_FORMATS = [
  { key: 'json', label: 'JSON', icon: '📄' },
  { key: 'csv', label: 'CSV', icon: '📊' }
];

// ===== ES6 CUSTOM HOOKS =====
const useAnalytics = (linkId, dateRange) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isElasticSearchDown, setIsElasticSearchDown] = useState(false);

  const fetchAnalytics = useCallback(async (targetLinkId, range) => {
    if (!targetLinkId) return;
    
    setLoading(true);
    setError(null);
    setIsElasticSearchDown(false);
    
    try {
      console.log(`🔍 Fetching analytics for link ${targetLinkId} with range ${range}`);
      
      const response = await analyticsApi.getLinkAnalytics(targetLinkId, range);
      
      if (response.success) {
        const transformedData = AnalyticsTransformer.transformAnalyticsResponse(response);
        setData(transformedData);
        
        if (response.fallback || response.warning) {
          setIsElasticSearchDown(true);
          message.warning(response.warning || 'Đang sử dụng dữ liệu backup');
        }
        
        console.log('📊 Analytics data transformed and loaded:', transformedData);
      } else {
        throw new ApiError(response.message || 'Failed to fetch analytics', 500, 'FETCH_FAILED');
      }
    } catch (err) {
      console.error('❌ Analytics fetch error:', err);
      
      const fallbackData = AnalyticsTransformer.handleErrorResponse(err, err.fallbackData);
      setData(fallbackData);
      
      if (err instanceof NetworkError) {
        setError('Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.');
        message.error('Lỗi kết nối mạng');
      } else if (err.status === 503 && err.details?.fallback) {
        setIsElasticSearchDown(true);
        setError('Dịch vụ analytics tạm thời không khả dụng. Đang sử dụng dữ liệu backup.');
        message.warning('Đang sử dụng dữ liệu backup');
      } else if (err.status === 404) {
        setError('Không tìm thấy liên kết hoặc bạn không có quyền truy cập.');
        message.error('Liên kết không tồn tại');
      } else if (err.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        message.error('Vui lòng đăng nhập lại');
      } else {
        setError(err.message || 'Có lỗi xảy ra khi tải dữ liệu analytics');
        message.error('Không thể tải dữ liệu analytics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, isElasticSearchDown, fetchAnalytics };
};

// ===== ES6 HELPER FUNCTIONS =====
// NEW: Enhanced empty state info generator
const getEmptyStateInfo = (analyticsData, currentLink) => {
  const isLinkNew = currentLink && dayjs().diff(dayjs(currentLink.createdAt), 'hours') < 24;
  const hasNoClicks = !analyticsData || (analyticsData.totalClicks === 0 && analyticsData.uniqueClicks === 0);
  const isUsingFallback = analyticsData?.meta?.fallback;
  
  if (hasNoClicks && isLinkNew) {
    return {
      type: 'new-link',
      title: 'Link mới tạo',
      description: 'Link này vừa được tạo và chưa có lượt click nào. Hãy chia sẻ link để bắt đầu thu thập dữ liệu analytics.',
      icon: '🆕',
      action: 'share'
    };
  } else if (hasNoClicks && !isLinkNew) {
    return {
      type: 'no-clicks',
      title: 'Chưa có clicks',
      description: 'Link này chưa có lượt click nào. Hãy chia sẻ link trên mạng xã hội hoặc gửi cho bạn bè để thu thập dữ liệu.',
      icon: '📊',
      action: 'promote'
    };
  } else if (isUsingFallback && analyticsData.totalClicks > 0) {
    return {
      type: 'fallback-with-data',
      title: 'Đang sử dụng dữ liệu backup',
      description: 'Hệ thống analytics chính tạm thời không khả dụng. Đang hiển thị dữ liệu từ cơ sở dữ liệu backup.',
      icon: '⚠️',
      action: 'retry'
    };
  } else if (isUsingFallback && analyticsData.totalClicks === 0) {
    return {
      type: 'fallback-empty',
      title: 'Chưa có dữ liệu analytics',  
      description: 'Link chưa có lượt click nào. Dữ liệu đang được lấy từ cơ sở dữ liệu backup.',
      icon: '📈',
      action: 'share'
    };
  }
  
  return null;
};

// ===== ES6 MAIN COMPONENT =====
const AnalyticsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const linkId = searchParams.get('link');
  const [dateRange, setDateRange] = useState('7d');
  const [selectedLinkId, setSelectedLinkId] = useState(linkId);
  const [exportLoading, setExportLoading] = useState(false);
  
  const { links, fetchLinks, loading: linksLoading } = useLinkStore();
  const { data: analyticsData, loading: analyticsLoading, error, isElasticSearchDown, fetchAnalytics } = useAnalytics(selectedLinkId, dateRange);

  // ===== ES6 COMPUTED VALUES =====
  const currentLink = useMemo(() => 
    links.find(link => link.id === (selectedLinkId || linkId)), 
    [links, selectedLinkId, linkId]
  );

  const chartData = useMemo(() => {
    if (!analyticsData) return { clicksOverTime: [], deviceData: [], browserData: [], locationData: [] };
    return AnalyticsTransformer.transformForCharts(analyticsData);
  }, [analyticsData]);

  const stats = useMemo(() => {
    if (!analyticsData) return { totalClicks: 0, uniqueClicks: 0, clickRate: 0, avgDaily: 0 };
    return AnalyticsTransformer.calculateStats(analyticsData);
  }, [analyticsData]);

  // ===== ES6 EVENT HANDLERS =====
  const handleLinkSelect = useCallback((value) => {
    setSelectedLinkId(value);
    setSearchParams({ link: value });
  }, [setSearchParams]);

  const handleDateRangeChange = useCallback((value) => {
    setDateRange(value);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedLinkId || linkId) {
      fetchAnalytics(selectedLinkId || linkId, dateRange);
    }
    fetchLinks();
  }, [selectedLinkId, linkId, dateRange, fetchAnalytics, fetchLinks]);

  const handleExport = useCallback(async (format = 'json') => {
    const linkToExport = selectedLinkId || linkId;
    if (!linkToExport) return;

    setExportLoading(true);
    try {
      const exportData = AnalyticsTransformer.prepareExportData(analyticsData, format);
      
      const fileName = `analytics-${currentLink?.shortCode || 'data'}-${dateRange}.${format}`;
      const blob = new Blob([format === 'csv' ? exportData : JSON.stringify(exportData, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      message.success(`Analytics đã được xuất dưới dạng ${format.toUpperCase()}`);
    } catch (err) {
      console.error('❌ Export error:', err);
      message.error('Không thể xuất dữ liệu');
    } finally {
      setExportLoading(false);
    }
  }, [selectedLinkId, linkId, dateRange, currentLink, analyticsData]);

  // ===== ES6 EFFECTS =====
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  useEffect(() => {
    if (selectedLinkId || linkId) {
      const targetLinkId = selectedLinkId || linkId;
      fetchAnalytics(targetLinkId, dateRange);
    }
  }, [selectedLinkId, linkId, dateRange, fetchAnalytics]);

  // ===== ES6 RENDER HELPERS =====
  const renderEmptyState = () => (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <Empty
        image={<BarChartOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
        description={
          <div>
            <Title level={4} type="secondary">Chưa có liên kết nào</Title>
            <Text type="secondary">
              Bạn cần tạo ít nhất một liên kết để xem analytics.
            </Text>
          </div>
        }
      >
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Tạo liên kết đầu tiên
        </Button>
      </Empty>
    </div>
  );

  const renderLinkSelector = () => (
    <Card size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text strong>Chọn liên kết để xem analytics:</Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn một liên kết..."
          value={selectedLinkId || linkId}
          onChange={handleLinkSelect}
          showSearch
          filterOption={(input, option) =>
            option.children.toLowerCase().includes(input.toLowerCase())
          }
        >
          {links.map((link) => (
            <Option key={link.id} value={link.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {link.title || link.shortCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {link.originalUrl.length > 50 
                      ? link.originalUrl.substring(0, 50) + '...' 
                      : link.originalUrl
                    }
                  </div>
                </div>
                <Badge count={link.clickCount || 0} style={{ backgroundColor: '#1890ff' }} />
              </div>
            </Option>
          ))}
        </Select>
      </Space>
    </Card>
  );

  // NEW: Updated service alert for better UX
  const renderServiceAlert = () => {
    if (!isElasticSearchDown && !analyticsData?.meta?.fallback) return null;

    const isEmptyData = stats.totalClicks === 0;
    
    return (
      <Alert
        message={isEmptyData ? "Thông tin hệ thống" : "Đang sử dụng dữ liệu backup"}
        description={
          isEmptyData 
            ? "Chưa có số liệu thống kê."
            : "Hệ thống analytics chính tạm thời không khả dụng. Đang hiển thị dữ liệu từ database backup."
        }
        type={isEmptyData ? "info" : "warning"}
        showIcon
        icon={isEmptyData ? <InfoCircleOutlined /> : <ExclamationCircleOutlined />}
        action={
          !isEmptyData && (
            <Button size="small" onClick={handleRefresh}>
              Thử lại
            </Button>
          )
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  const renderErrorAlert = () => {
    if (!error) return null;

    return (
      <Alert
        message="Lỗi tải dữ liệu"
        description={error}
        type="error"
        showIcon
        closable
        onClose={() => setError(null)}
        action={
          <Button size="small" type="primary" onClick={handleRefresh}>
            Thử lại
          </Button>
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  const renderStatsCards = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Tổng clicks"
            value={stats.totalClicks}
            prefix={<EyeOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Clicks duy nhất"
            value={stats.uniqueClicks}
            prefix={<UserOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Tỷ lệ unique"
            value={stats.clickRate}
            precision={1}
            suffix="%"
            prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Clicks/ngày TB"
            value={stats.avgDaily}
            prefix={<BarChartOutlined style={{ color: '#722ed1' }} />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
    </Row>
  );

  const renderCharts = () => (
    <Row gutter={[16, 16]}>
      {/* Clicks Over Time */}
      <Col span={24}>
        <Card title="Clicks theo thời gian" size="small">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.clicksOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <RechartsTooltip />
              <Line 
                type="monotone" 
                dataKey="clicks" 
                stroke="#1890ff" 
                strokeWidth={2}
                dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      {/* Device Distribution */}
      <Col xs={24} lg={12}>
        <Card title="Phân bố thiết bị" size="small">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData.deviceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.deviceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      {/* Top Browsers */}
      <Col xs={24} lg={12}>
        <Card title="Top Browsers" size="small">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.browserData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="browser" type="category" width={80} />
              <RechartsTooltip />
              <Bar dataKey="clicks" fill="#52c41a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      {/* Top Locations */}
      <Col xs={24}>
        <Card title="Top Locations" size="small">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.locationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="country" />
              <YAxis />
              <RechartsTooltip />
              <Bar dataKey="clicks" fill="#faad14" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  );

  // NEW: Enhanced charts or empty state rendering
  const renderChartsOrEmptyState = () => {
    const emptyStateInfo = getEmptyStateInfo(analyticsData, currentLink);
    
    if (stats.totalClicks > 0) {
      return renderCharts();
    }
    
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {emptyStateInfo?.icon || '📊'}
          </div>
          
          <Title level={3} style={{ color: '#666', marginBottom: 8 }}>
            {emptyStateInfo?.title || 'Chưa có dữ liệu'}
          </Title>
          
          <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 24 }}>
            {emptyStateInfo?.description || 'Chưa có dữ liệu clicks để hiển thị'}
          </Text>
          
          {analyticsData?.meta?.dataSource && (
            <div style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Nguồn dữ liệu: {' '}
                <Tag color={analyticsData.meta.dataSource === 'elasticsearch' ? 'green' : 'orange'}>
                  {analyticsData.meta.dataSource === 'elasticsearch' ? 'ElasticSearch' : 'Database Backup'}
                </Tag>
              </Text>
            </div>
          )}
          
          <Space size="middle">
            {emptyStateInfo?.action === 'share' && currentLink && (
              <>
                <Button 
                  type="primary" 
                  icon={<ShareAltOutlined />}
                  onClick={() => {
                    const fullUrl = generateShortUrl(currentLink.shortCode, currentLink.domain);
                    navigator.clipboard.writeText(fullUrl);
                    message.success('Link đã được copy!');
                  }}
                >
                  Copy Link để chia sẻ
                </Button>
                <Button 
                  icon={<EyeOutlined />}
                  onClick={() => window.open(generateShortUrl(currentLink.shortCode, currentLink.domain), '_blank')}
                >
                  Xem link
                </Button>
              </>
            )}
            
            {emptyStateInfo?.action === 'promote' && (
              <Space direction="vertical">
                <Button type="primary" icon={<ShareAltOutlined />}>
                  Chia sẻ trên mạng xã hội
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Hoặc gửi link cho bạn bè để bắt đầu thu thập analytics
                </Text>
              </Space>
            )}
            
            {emptyStateInfo?.action === 'retry' && (
              <Button 
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={analyticsLoading}
              >
                Thử tải lại
              </Button>
            )}
          </Space>
          
          {currentLink && (
            <Card 
              size="small" 
              style={{ 
                marginTop: 32, 
                maxWidth: 500, 
                margin: '32px auto 0',
                textAlign: 'left' 
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Link Details:</Text>
                </div>
                <div>
                  <Text type="secondary">Title: </Text>
                  <Text>{currentLink.title || 'Không có tiêu đề'}</Text>
                </div>
                <div>
                  <Text type="secondary">Short URL: </Text>
                  <Text code>{generateShortUrl(currentLink.shortCode, currentLink.domain)}</Text>
                </div>
                <div>
                  <Text type="secondary">Destination: </Text>
                  <Text>{currentLink.originalUrl}</Text>
                </div>
                <div>
                  <Text type="secondary">Created: </Text>
                  <Text>{dayjs(currentLink.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                </div>
                {currentLink.campaign && (
                  <div>
                    <Text type="secondary">Campaign: </Text>
                    <Tag>{currentLink.campaign}</Tag>
                  </div>
                )}
              </Space>
            </Card>
          )}
        </div>
      </Card>
    );
  };

  // ===== ES6 MAIN RENDER =====
  if (linksLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Đang tải danh sách liên kết...</Text>
        </div>
      </div>
    );
  }

  if (!linksLoading && links.length === 0) {
    return renderEmptyState();
  }

  if (!currentLink && !analyticsLoading) {
    return (
      <div style={{ padding: '0 24px' }}>
        <Title level={2} style={{ marginBottom: 24 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Analytics
        </Title>
        {renderLinkSelector()}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 24px' }}>
      <Spin spinning={analyticsLoading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header with Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            flexWrap: 'wrap', 
            gap: 16 
          }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <Title level={2} style={{ margin: 0 }}>
                <BarChartOutlined style={{ marginRight: 8 }} />
                Analytics
                {(isElasticSearchDown || analyticsData?.meta?.fallback) && (
                  <Tooltip title="Đang sử dụng dữ liệu backup">
                    <ExclamationCircleOutlined 
                      style={{ color: '#faad14', marginLeft: 8, fontSize: 16 }} 
                    />
                  </Tooltip>
                )}
              </Title>
              {currentLink && (
                <div>
                  <Text type="secondary" style={{ fontSize: 16 }}>
                    Phân tích cho: <Text strong>{currentLink.title || currentLink.shortCode}</Text>
                  </Text>
                  {analyticsData && analyticsData.period && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <CalendarOutlined /> Dữ liệu từ {' '}
                        {dayjs(analyticsData.period.start).format('DD/MM/YYYY')} {' '}
                        đến {dayjs(analyticsData.period.end).format('DD/MM/YYYY')}
                        {analyticsData.meta?.dataSource && (
                          <span style={{ marginLeft: 8 }}>
                            • Nguồn: {analyticsData.meta.dataSource === 'postgresql' ? 'Backup DB' : 'ElasticSearch'}
                          </span>
                        )}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <Space wrap>
              <Select
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: 120 }}
              >
                {Object.entries(DATE_RANGES).map(([key, { label, value }]) => (
                  <Option key={key} value={value}>{label}</Option>
                ))}
              </Select>

              <Dropdown
                menu={{
                  items: EXPORT_FORMATS.map(format => ({
                    key: format.key,
                    label: `${format.icon} ${format.label}`,
                    onClick: () => handleExport(format.key)
                  }))
                }}
                trigger={['click']}
              >
                <Button 
                  icon={<DownloadOutlined />} 
                  loading={exportLoading}
                  disabled={!analyticsData}
                >
                  Xuất dữ liệu
                </Button>
              </Dropdown>

              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={analyticsLoading}
              >
                Tải lại
              </Button>
            </Space>
          </div>

          {/* Service Status Alert */}
          {renderServiceAlert()}

          {/* Error Alert */}
          {renderErrorAlert()}

          {/* Stats Overview */}
          {renderStatsCards()}

          {/* Charts or Empty State */}
          {renderChartsOrEmptyState()}
        </Space>
      </Spin>
    </div>
  );
};

export default AnalyticsPage;