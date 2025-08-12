// Complete AdminDashboardPage.js - Fixed Authentication
// Replace your entire AdminDashboardPage.js with this file

import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Space,
  Button,
  Table,
  Alert,
  Typography,
  Progress,
  Tag,
  Avatar,
  Tooltip,
  Divider,
  Badge,
  Empty,
  Spin,
  Result,
} from "antd";
import {
  UserOutlined,
  LinkOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  WifiOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ApiOutlined,
  HddOutlined,
  SafetyOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined,
  SecurityScanOutlined,
  MonitorOutlined,
} from "@ant-design/icons";
import notificationService from "../services/notificationService";
import useAuthStore from "../stores/authStore";

const { Title, Text } = Typography;

// ==========================================
// API SERVICE - FIXED AUTHENTICATION
// ==========================================
const adminAPI = {
  getBaseUrl: () => process.env.REACT_APP_API_URL || "http://localhost:4000",

  // Fixed token getter - works with your auth architecture
  getAuthToken: () => {
    // Method 1: Direct from localStorage (most reliable)
    let token = localStorage.getItem("token");

    if (!token) {
      // Method 2: Try auth store as fallback
      const authStore = useAuthStore.getState();
      token = authStore.token;
    }

    if (!token) {
      console.error("❌ No token found in localStorage or auth store");
      return null;
    }

    // Clean and validate token
    token = token.trim();

    // Remove quotes if accidentally added
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }

    // Remove Bearer prefix if accidentally stored
    if (token.startsWith("Bearer ")) {
      token = token.substring(7);
    }

    // Validate JWT format
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error("❌ Invalid JWT format - Parts:", parts.length);
      console.error("Token preview:", token.substring(0, 50) + "...");
      return null;
    }

    console.log("✅ Valid token found, length:", token.length);
    return token;
  },

  getAuthHeaders: () => {
    const token = adminAPI.getAuthToken();

    if (!token) {
      throw new Error("No valid authentication token available");
    }

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  },

  // Enhanced request method with your error handling
  makeAuthenticatedRequest: async (endpoint, options = {}) => {
    try {
      const url = `${adminAPI.getBaseUrl()}${endpoint}`;
      console.log("🌐 Making authenticated request to:", url);

      const headers = adminAPI.getAuthHeaders();

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      console.log("📡 Response status:", response.status, response.statusText);

      // Handle authentication errors based on your backend
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ 401 Error data:", errorData);

        // Handle your specific error codes
        if (errorData?.code === "TOKEN_MALFORMED") {
          console.error("❌ Token malformed - clearing auth");
          localStorage.removeItem("token");
          useAuthStore.getState().logout();
          window.location.href = "/login";
          throw new Error("Token format invalid - please login again");
        } else if (errorData?.code === "TOKEN_EXPIRED") {
          console.error("❌ Token expired - clearing auth");
          localStorage.removeItem("token");
          useAuthStore.getState().logout();
          window.location.href = "/login";
          throw new Error("Session expired - please login again");
        } else if (errorData?.code === "TOKEN_REVOKED") {
          console.error("❌ Token revoked - clearing auth");
          localStorage.removeItem("token");
          useAuthStore.getState().logout();
          window.location.href = "/login";
          throw new Error("Session revoked - please login again");
        } else {
          console.error("❌ General auth error - clearing auth");
          localStorage.removeItem("token");
          useAuthStore.getState().logout();
          window.location.href = "/login";
          throw new Error("Authentication failed - please login again");
        }
      }

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData?.code === "ADMIN_REQUIRED") {
          throw new Error("Admin access required");
        }
        throw new Error("Access forbidden");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Request successful for:", endpoint);
      return data;
    } catch (error) {
      console.error("❌ Request failed:", error.message);
      throw error;
    }
  },

  // API endpoints
  getAdminStats: () => adminAPI.makeAuthenticatedRequest("/api/admin/stats"),
  getSystemHealth: () => adminAPI.makeAuthenticatedRequest("/health"),
  getQueueStatus: () =>
    adminAPI.makeAuthenticatedRequest("/api/admin/queues/status"),
  getPerformanceMetrics: () =>
    adminAPI.makeAuthenticatedRequest("/api/admin/system/performance"),
  getSecurityStatus: () =>
    adminAPI.makeAuthenticatedRequest("/api/admin/security/status"),
  getRecentActivity: (limit = 10) =>
    adminAPI.makeAuthenticatedRequest(
      `/api/admin/activity/recent?limit=${limit}`
    ),
};

// ==========================================
// ENHANCED METRIC CARD COMPONENT
// ==========================================
const EnhancedMetricCard = ({
  title,
  value,
  icon,
  color = "#1890ff",
  trend,
  trendValue,
  suffix,
  prefix,
  loading = false,
  description,
  status = "normal",
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    return trend === "up" ? (
      <ArrowUpOutlined style={{ color: "#52c41a", fontSize: "12px" }} />
    ) : (
      <ArrowDownOutlined style={{ color: "#f5222d", fontSize: "12px" }} />
    );
  };

  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "#52c41a";
      case "warning":
        return "#fadb14";
      case "error":
        return "#f5222d";
      default:
        return color;
    }
  };

  return (
    <Card
      className="enhanced-metric-card"
      hoverable
      loading={loading}
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Gradient Background Accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "100px",
          height: "100px",
          background: `linear-gradient(135deg, ${getStatusColor()}15 0%, ${getStatusColor()}05 100%)`,
          borderRadius: "50%",
          transform: "translate(30px, -30px)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div style={{ flex: 1 }}>
            <Text
              type="secondary"
              style={{ fontSize: "12px", fontWeight: 500 }}
            >
              {title}
            </Text>
            {description && (
              <div>
                <Text type="secondary" style={{ fontSize: "11px" }}>
                  {description}
                </Text>
              </div>
            )}
          </div>
          <div
            style={{
              backgroundColor: `${getStatusColor()}10`,
              borderRadius: "8px",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {React.cloneElement(icon, {
              style: {
                fontSize: "20px",
                color: getStatusColor(),
              },
            })}
          </div>
        </div>

        {/* Main Value */}
        <div style={{ marginBottom: "8px" }}>
          <Statistic
            value={value}
            precision={typeof value === "number" && value % 1 !== 0 ? 2 : 0}
            valueStyle={{
              fontSize: "28px",
              fontWeight: 700,
              color: getStatusColor(),
              lineHeight: 1,
            }}
            prefix={prefix}
            suffix={suffix}
          />
        </div>

        {/* Trend Indicator */}
        {trend && trendValue && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              backgroundColor: trend === "up" ? "#f6ffed" : "#fff2f0",
              borderRadius: "6px",
              border: `1px solid ${trend === "up" ? "#d9f7be" : "#ffccc7"}`,
            }}
          >
            {getTrendIcon()}
            <Text
              style={{
                fontSize: "12px",
                color: trend === "up" ? "#52c41a" : "#f5222d",
                fontWeight: 500,
              }}
            >
              {trendValue}% vs last month
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
};

// ==========================================
// SYSTEM SERVICES CARD COMPONENT
// ==========================================
const SystemServicesCard = ({ services, loading }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "healthy":
        return "#52c41a";
      case "warning":
        return "#fadb14";
      case "error":
        return "#f5222d";
      default:
        return "#d9d9d9";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy":
        return <CheckCircleOutlined />;
      case "warning":
        return <WarningOutlined />;
      case "error":
        return <ExclamationCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  return (
    <Card
      title="System Services"
      loading={loading}
      size="small"
      style={{ height: "100%" }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="small">
        {Object.entries(services || {}).map(
          ([serviceName, serviceData], index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                backgroundColor: "#fafafa",
                borderRadius: "6px",
                border: "1px solid #f0f0f0",
              }}
            >
              <Space>
                <ApiOutlined />
                <div>
                  <Text strong style={{ fontSize: "13px" }}>
                    {serviceName}
                  </Text>
                  {serviceData.responseTime && (
                    <div>
                      <Text type="secondary" style={{ fontSize: "11px" }}>
                        {serviceData.responseTime}ms
                      </Text>
                    </div>
                  )}
                </div>
              </Space>
              <Tag
                color={getStatusColor(serviceData.status)}
                icon={getStatusIcon(serviceData.status)}
                style={{ margin: 0 }}
              >
                {serviceData.status}
              </Tag>
            </div>
          )
        )}
      </Space>
    </Card>
  );
};

// ==========================================
// MAIN ADMIN DASHBOARD COMPONENT
// ==========================================
const AdminDashboardPage = () => {
  const [adminStats, setAdminStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  // Get auth state from your store
  const { user, isAuthenticated, logout } = useAuthStore();

  // Check authentication and admin role on component mount
  useEffect(() => {
    console.log("🔐 Checking authentication state:", {
      isAuthenticated,
      userRole: user?.role,
      userEmail: user?.email,
    });

    if (!isAuthenticated) {
      console.error("❌ User not authenticated, redirecting to login");
      window.location.href = "/login";
      return;
    }

    if (user?.role !== "admin") {
      console.error("❌ User is not admin, redirecting to dashboard");
      window.location.href = "/dashboard";
      return;
    }

    console.log("✅ User authenticated as admin, proceeding with dashboard");
  }, [isAuthenticated, user]);

  // Enhanced data fetching with better error handling
  const fetchDashboardData = async () => {
    if (!isAuthenticated || user?.role !== "admin") {
      console.log("⚠️ Skipping data fetch - not authenticated or not admin");
      return;
    }

    setLoading(true);
    setConnectionStatus("loading");

    try {
      console.log("🔄 Fetching admin dashboard data...");

      // Primary data - admin stats (most important)
      const statsResponse = await adminAPI.getAdminStats();

      if (statsResponse?.success) {
        setAdminStats(statsResponse.data);
        setConnectionStatus("connected");
        setLastUpdated(new Date());

        console.log("✅ Admin stats loaded:", statsResponse.data);

        notificationService.notifySuccess({
          message: "Dashboard Updated",
          description: "Data refreshed successfully",
          duration: 2,
        });
      } else {
        throw new Error("Admin stats API returned success: false");
      }

      // Secondary data - fetch in parallel with error handling
      const secondaryRequests = [
        adminAPI
          .getSystemHealth()
          .catch((err) => ({ error: err.message, type: "health" })),
        adminAPI
          .getQueueStatus()
          .catch((err) => ({ error: err.message, type: "queues" })),
        adminAPI
          .getPerformanceMetrics()
          .catch((err) => ({ error: err.message, type: "performance" })),
        adminAPI
          .getSecurityStatus()
          .catch((err) => ({ error: err.message, type: "security" })),
        adminAPI
          .getRecentActivity(5)
          .catch((err) => ({ error: err.message, type: "activity" })),
      ];

      const results = await Promise.allSettled(secondaryRequests);

      // Process secondary data results
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value?.success) {
          const data = result.value.data;
          switch (index) {
            case 0: // Health
              setSystemStatus((prev) => ({ ...prev, services: data }));
              break;
            case 1: // Queues
              setSystemStatus((prev) => ({ ...prev, queues: data.queues }));
              break;
            case 2: // Performance
              setSystemStatus((prev) => ({ ...prev, performance: data }));
              break;
            case 3: // Security
              setSystemStatus((prev) => ({ ...prev, security: data }));
              break;
            case 4: // Activity
              setRecentActivity(data.activities || []);
              break;
          }
        } else {
          console.log(
            `⚠️ Secondary request ${index} failed or returned no data`
          );
        }
      });
    } catch (error) {
      console.error("❌ Dashboard data fetch error:", error.message);
      setConnectionStatus("error");

      // Handle authentication errors
      if (
        error.message.includes("login again") ||
        error.message.includes("Authentication failed")
      ) {
        notificationService.notifyError({
          message: "Session Expired",
          description: "Please login again to continue",
          duration: 4,
        });
        return; // Don't show additional error notification
      }

      notificationService.notifyError({
        message: "Dashboard Error",
        description: `Failed to fetch data: ${error.message}`,
        duration: 4,
      });

      // Set minimal fallback data
      setAdminStats({
        users: { total: 0, active: 0, growth: 0 },
        links: { total: 0, growth: 0 },
        analytics: { todayClicks: 0, growth: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchDashboardData();

      // Set up auto-refresh every 30 seconds
      const refreshInterval = setInterval(() => {
        fetchDashboardData();
      }, 30000);

      return () => clearInterval(refreshInterval);
    }
  }, [isAuthenticated, user]);

  // Show loading state
  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Space>
          <Spin size="large" />
          <Text>Checking authentication...</Text>
        </Space>
      </div>
    );
  }

  // Show access denied
  if (user?.role !== "admin") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Result
          status="403"
          title="403"
          subTitle="Admin access required"
          extra={
            <Button
              type="primary"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Go to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", background: "#f5f5f5", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: "#262626" }}>
            Admin Dashboard
          </Title>
          <Text type="secondary">
            Welcome, {user?.name || user?.email} •{" "}
            {adminStats?.users?.total || 0} users •{" "}
            {adminStats?.links?.total || 0} links
          </Text>
        </div>
        <Space>
          <Badge
            status={
              connectionStatus === "connected"
                ? "processing"
                : connectionStatus === "loading"
                ? "default"
                : "error"
            }
            text={
              connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "loading"
                ? "Loading..."
                : "Connection Error"
            }
          />
          {lastUpdated && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchDashboardData}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Status Alert */}
      <Alert
        message={
          <Space>
            <Text strong>System Status:</Text>
            {connectionStatus === "connected" ? (
              <Text type="success">🟢 Connected as {user?.email}</Text>
            ) : connectionStatus === "loading" ? (
              <Text>🔄 Loading dashboard data...</Text>
            ) : (
              <Text type="warning">🟡 Connection issues detected</Text>
            )}
          </Space>
        }
        type={
          connectionStatus === "connected"
            ? "success"
            : connectionStatus === "loading"
            ? "info"
            : "warning"
        }
        showIcon
        style={{ marginBottom: "24px", borderRadius: "8px" }}
      />

      {/* Main Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <EnhancedMetricCard
            title="Total Users"
            value={adminStats?.users?.total || 0}
            icon={<UserOutlined />}
            color="#1890ff"
            trend={adminStats?.users?.growth > 0 ? "up" : "down"}
            trendValue={adminStats?.users?.growth}
            loading={loading}
            description="Registered users"
            status="success"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <EnhancedMetricCard
            title="Total Links"
            value={adminStats?.links?.total || 0}
            icon={<LinkOutlined />}
            color="#722ed1"
            trend={adminStats?.links?.growth > 0 ? "up" : "down"}
            trendValue={adminStats?.links?.growth}
            loading={loading}
            description="Shortened links"
            status="normal"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <EnhancedMetricCard
            title="Today's Clicks"
            value={adminStats?.analytics?.todayClicks || 0}
            icon={<EyeOutlined />}
            color="#13c2c2"
            trend={adminStats?.analytics?.growth > 0 ? "up" : "down"}
            trendValue={adminStats?.analytics?.growth}
            loading={loading}
            description="24h activity"
            status={
              adminStats?.analytics?.todayClicks > 0 ? "success" : "warning"
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <EnhancedMetricCard
            title="Active Users"
            value={adminStats?.users?.active || 0}
            icon={<TeamOutlined />}
            color="#52c41a"
            loading={loading}
            description="Currently online"
            status="success"
          />
        </Col>
      </Row>

      {/* System Status Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={12}>
          <SystemServicesCard
            services={systemStatus?.services || {}}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Recent Activity"
            loading={loading}
            style={{ height: "100%" }}
          >
            {recentActivity.length > 0 ? (
              <Table
                columns={[
                  {
                    title: "Link",
                    dataIndex: "shortCode",
                    key: "shortCode",
                    render: (code) => <Tag color="blue">{code}</Tag>,
                  },
                  {
                    title: "User",
                    dataIndex: "user",
                    key: "user",
                    render: (user) => (
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text style={{ fontSize: "12px" }}>{user}</Text>
                      </Space>
                    ),
                  },
                ]}
                dataSource={recentActivity}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                description="No recent activity"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card title="Quick Actions" style={{ borderRadius: "12px" }}>
        <Space wrap size="middle">
          <Button
            type="primary"
            className="admin-btn-primary"
            icon={<TeamOutlined />}
            onClick={() => (window.location.href = "/admin/users")}
          >
            Manage Users
          </Button>
          <Button
            icon={<LinkOutlined />}
            onClick={() => (window.location.href = "/admin/links")}
          >
            Review Links
          </Button>
          <Button
            icon={<MonitorOutlined />}
            onClick={() => (window.location.href = "/admin/analytics")}
          >
            View Analytics
          </Button>
          <Button
            icon={<DatabaseOutlined />}
            onClick={() => (window.location.href = "/admin/system")}
          >
            System Settings
          </Button>
          <Button
            icon={<SecurityScanOutlined />}
            onClick={() => {
              /* Navigate to security logs */
            }}
          >
            Security Logs
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => {
              /* Navigate to queue management */
            }}
          >
            Queue Manager
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
