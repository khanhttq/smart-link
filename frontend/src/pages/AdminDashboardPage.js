// frontend/src/pages/AdminDashboardPage.js - COMPLETE WITH SSE + DEBUG
import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Alert,
  Table,
  Tag,
  Button,
  Space,
  Divider,
  Progress,
  Typography,
  notification,
} from "antd";
import {
  UserOutlined,
  LinkOutlined,
  EyeOutlined,
  DashboardOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import apiClient from "../utils/apiClient";
import useAdminSSE from "../hooks/useAdminSSE";
import { useAuth } from "../hooks/useAuth";

const { Title, Text } = Typography;

const AdminDashboardPage = () => {
  // ✅ STANDARD: Use useAuth like other pages
  const { user } = useAuth();

  // ✅ DEBUG: Simple log like other pages
  console.log("🔑 AdminDashboard - User:", user ? user.email : "No user");
  console.log("🔑 User role:", user?.role);

  // ✅ SSE connection - let SSE hook handle token internally
  console.log("📡 About to call useAdminSSE...");
  const {
    data: sseData,
    connected: sseConnected,
    error: sseError,
    reconnect,
  } = useAdminSSE(); // ← No token parameter

  // ✅ DEBUG: Log SSE hook results
  console.log("📡 SSE Hook results:", {
    connected: sseConnected,
    hasData: !!sseData,
    error: sseError,
  });

  // Component states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Data states (updated by SSE)
  const [systemStatus, setSystemStatus] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [adminStats, setAdminStats] = useState(null);

  // Data states (updated manually)
  const [recentClicks, setRecentClicks] = useState([]);

  // ✅ FALLBACK: Manual data loading for testing
  const loadDataManually = async () => {
    try {
      setLoading(true);
      console.log("🔄 Loading data manually...");

      const [statusRes, queueRes, statsRes] = await Promise.all([
        apiClient.get("/api/admin/system-status"),
        apiClient.get("/api/admin/queue-stats"),
        apiClient.get("/api/admin/statistics"),
      ]);

      console.log("✅ Manual data loaded:", {
        systemStatus: statusRes.data.data,
        queueStats: queueRes.data.data,
        adminStats: statsRes.data.data.statistics,
      });

      setSystemStatus(statusRes.data.data);
      setQueueStats(queueRes.data.data);
      setAdminStats(statsRes.data.data.statistics);
      setLastRefresh(new Date());
      setLoading(false);

      notification.success({
        message: "Data Loaded",
        description: "Dashboard data loaded manually",
      });
    } catch (error) {
      console.error("❌ Manual data load failed:", error);
      setLoading(false);
      notification.error({
        message: "Manual Load Failed",
        description: error.message,
      });
    }
  };

  // ✅ Update data when SSE data arrives
  useEffect(() => {
    if (sseData) {
      console.log("📊 Updating from SSE data:", sseData);

      // Update admin stats
      if (sseData.statistics) {
        setAdminStats(sseData.statistics);
      }

      // Update system status
      if (sseData.services || sseData.performance) {
        setSystemStatus({
          services: sseData.services,
          performance: sseData.performance,
          serverInfo: sseData.serverInfo,
          timestamp: sseData.timestamp,
        });
      }

      // Update queue stats from system status
      if (sseData.services?.queue?.stats) {
        setQueueStats({
          queues: sseData.services.queue.stats,
          timestamp: sseData.timestamp,
        });
      }

      setLastRefresh(new Date(sseData.timestamp));
      setLoading(false);
    }
  }, [sseData]);

  // ✅ Fetch only recent clicks (not covered by SSE)
  const fetchRecentClicks = async () => {
    try {
      const clicksRes = await apiClient.get("/api/admin/recent-clicks");
      const clicksData = clicksRes.data.data;
      setRecentClicks(
        Array.isArray(clicksData?.clicks) ? clicksData.clicks : []
      );
    } catch (error) {
      console.error("Failed to fetch recent clicks:", error);
    }
  };

  // ✅ Initial load - only for data not covered by SSE
  useEffect(() => {
    fetchRecentClicks();

    // Fetch recent clicks every 30 seconds
    const interval = setInterval(fetchRecentClicks, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Auto-fallback if SSE doesn't work within 5 seconds
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (loading && !sseData && !adminStats) {
        console.log("⚠️ SSE timeout - loading data manually");
        loadDataManually();
      }
    }, 5000);

    return () => clearTimeout(fallbackTimer);
  }, [loading, sseData, adminStats]);

  // ✅ Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRecentClicks();
      notification.success({
        message: "Refreshed",
        description: "Recent activity updated",
      });
    } catch (error) {
      notification.error({
        message: "Refresh Failed",
        description: "Could not update recent activity",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Render service status
  const renderServiceStatus = (service, name) => {
    const isConnected = service?.connected || service?.status === "Connected";
    return (
      <Tag
        icon={isConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        color={isConnected ? "success" : "error"}
      >
        {name}: {isConnected ? "Hoạt động" : "Lỗi"}
      </Tag>
    );
  };

  // Recent clicks table columns
  const clicksColumns = [
    {
      title: "Thời gian",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (timestamp) => new Date(timestamp).toLocaleString("vi-VN"),
      width: 150,
    },
    {
      title: "Short Code",
      dataIndex: "shortCode",
      key: "shortCode",
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
    },
    {
      title: "User Agent",
      dataIndex: "userAgent",
      key: "userAgent",
      ellipsis: true,
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      render: (country) => country || "Unknown",
    },
  ];

  // ✅ IMPROVED: Loading screen with debug info
  if (loading && !adminStats) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <DashboardOutlined style={{ fontSize: "48px", color: "#1890ff" }} />
        <Title level={3}>Đang tải Admin Dashboard...</Title>
        <div style={{ marginTop: "20px" }}>
          <Space direction="vertical">
            <Text type="secondary">
              SSE: {sseConnected ? "🟢 Connected" : "🔴 Disconnected"} | User:{" "}
              {user ? "✅" : "❌"} | Data: {sseData ? "✅" : "❌"}
            </Text>
            <Space>
              <Button
                type="primary"
                onClick={loadDataManually}
                loading={loading}
              >
                Load Data Manually
              </Button>
              <Button type="default" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </Space>
          </Space>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content" style={{ padding: "24px" }}>
      {/* ✅ Real-time Status & Controls */}
      <Card
        size="small"
        style={{
          marginBottom: "16px",
          background: sseConnected ? "#f6ffed" : "#fff2e8",
          border: `1px solid ${sseConnected ? "#b7eb8f" : "#ffd591"}`,
        }}
        bodyStyle={{ padding: "12px 16px" }}
      >
        <Space split={<Divider type="vertical" />}>
          <Space>
            <Text strong>
              {sseConnected
                ? "🟢 Real-time: CONNECTED"
                : "🟡 Real-time: DISCONNECTED"}
            </Text>
            {sseError && (
              <Text type="danger" style={{ fontSize: "12px" }}>
                Error: {sseError}
              </Text>
            )}
          </Space>

          {lastRefresh && (
            <Space>
              <Text type="secondary">
                Last updated: {lastRefresh.toLocaleTimeString("vi-VN")}
              </Text>
            </Space>
          )}

          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={handleRefresh}
            size="small"
          >
            Refresh Activity
          </Button>

          {!sseConnected && (
            <Button type="default" onClick={reconnect} size="small">
              Reconnect
            </Button>
          )}

          <Button type="default" onClick={loadDataManually} size="small">
            Manual Load
          </Button>
        </Space>
      </Card>

      {/* System Status Alert */}
      <Alert
        message="Trạng thái hệ thống"
        description={
          <Space wrap>
            {systemStatus?.services && (
              <>
                {renderServiceStatus(
                  systemStatus.services.elasticsearch,
                  "ElasticSearch"
                )}
                {renderServiceStatus(systemStatus.services.redis, "Redis")}
                {renderServiceStatus(systemStatus.services.queue, "Queue")}
              </>
            )}
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: "24px" }}
      />

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Users"
              value={adminStats?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#3f8600" }}
              loading={!adminStats}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Links"
              value={adminStats?.totalLinks || 0}
              prefix={<LinkOutlined />}
              valueStyle={{ color: "#1890ff" }}
              loading={!adminStats}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Clicks hôm nay"
              value={adminStats?.todayClicks || 0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: "#722ed1" }}
              loading={!adminStats}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={(() => {
                const uptimeSeconds = systemStatus?.performance?.uptime || 0;
                const days = Math.floor(uptimeSeconds / (24 * 3600));
                const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                return `${days}D ${hours}H ${minutes}M`;
              })()}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#cf1322" }}
              loading={!systemStatus}
            />
          </Card>
        </Col>
      </Row>

      {/* System Performance */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={12}>
          <Card title="Hiệu suất hệ thống" extra={<WarningOutlined />}>
            {systemStatus?.performance && (
              <Space direction="vertical" style={{ width: "100%" }}>
                {/* Memory Usage */}
                <div>
                  <Text strong>Bộ nhớ (Memory):</Text>
                  <Progress
                    percent={Math.round(
                      (systemStatus.performance.memory.heapUsed /
                        systemStatus.performance.memory.heapTotal) *
                        100
                    )}
                    status={
                      systemStatus.performance.memory.heapUsed /
                        systemStatus.performance.memory.heapTotal >
                      0.8
                        ? "exception"
                        : systemStatus.performance.memory.heapUsed /
                            systemStatus.performance.memory.heapTotal >
                          0.6
                        ? "active"
                        : "success"
                    }
                    format={(percent) => `${percent}%`}
                  />
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    <Text>
                      Heap Used:{" "}
                      <Text code>
                        {Math.round(
                          systemStatus.performance.memory.heapUsed / 1024 / 1024
                        )}
                        MB
                      </Text>
                    </Text>{" "}
                    /
                    <Text>
                      {" "}
                      Total:{" "}
                      <Text code>
                        {Math.round(
                          systemStatus.performance.memory.heapTotal /
                            1024 /
                            1024
                        )}
                        MB
                      </Text>
                    </Text>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    <Text>
                      RSS:{" "}
                      <Text code>
                        {Math.round(
                          systemStatus.performance.memory.rss / 1024 / 1024
                        )}
                        MB
                      </Text>
                    </Text>{" "}
                    |
                    <Text>
                      {" "}
                      External:{" "}
                      <Text code>
                        {Math.round(
                          systemStatus.performance.memory.external / 1024 / 1024
                        )}
                        MB
                      </Text>
                    </Text>
                  </div>
                </div>

                {/* CPU Usage */}
                <div>
                  <Text strong>CPU Usage:</Text>
                  <div style={{ marginTop: "8px" }}>
                    <Text>
                      User Time:{" "}
                      <Text code>
                        {Math.round(systemStatus.performance.cpu.user / 1000)}ms
                      </Text>
                    </Text>
                    <br />
                    <Text>
                      System Time:{" "}
                      <Text code>
                        {Math.round(systemStatus.performance.cpu.system / 1000)}
                        ms
                      </Text>
                    </Text>
                  </div>
                </div>

                {/* Uptime Detail */}
                <div>
                  <Text strong>Uptime chi tiết:</Text>
                  <div style={{ marginTop: "4px" }}>
                    <Text code>
                      {Math.floor(systemStatus.performance.uptime / 86400)} ngày{" "}
                      {Math.floor(
                        (systemStatus.performance.uptime % 86400) / 3600
                      )}{" "}
                      giờ{" "}
                      {Math.floor(
                        (systemStatus.performance.uptime % 3600) / 60
                      )}{" "}
                      phút {Math.floor(systemStatus.performance.uptime % 60)}{" "}
                      giây
                    </Text>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Started:{" "}
                    {new Date(
                      Date.now() - systemStatus.performance.uptime * 1000
                    ).toLocaleString("vi-VN")}
                  </div>
                </div>

                {/* Server Info */}
                {systemStatus?.serverInfo && (
                  <div>
                    <Text strong>Server Info:</Text>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "4px",
                      }}
                    >
                      <Text>
                        Node:{" "}
                        <Text code>{systemStatus.serverInfo.nodeVersion}</Text>
                      </Text>{" "}
                      |
                      <Text>
                        {" "}
                        Platform:{" "}
                        <Text code>{systemStatus.serverInfo.platform}</Text>
                      </Text>
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      <Text>
                        PID: <Text code>{systemStatus.serverInfo.pid}</Text>
                      </Text>{" "}
                      |
                      <Text>
                        {" "}
                        Env:{" "}
                        <Text code>{systemStatus.serverInfo.environment}</Text>
                      </Text>
                    </div>
                  </div>
                )}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Queue Statistics"
            extra={
              sseConnected ? (
                <Text type="success">🔄 Live</Text>
              ) : (
                <Text type="warning">📴 Offline</Text>
              )
            }
          >
            {queueStats?.queues ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                {Object.entries(queueStats.queues).map(([queueName, stats]) => {
                  // Skip non-queue properties
                  if (
                    typeof stats !== "object" ||
                    queueName === "batchSize" ||
                    queueName === "processInterval" ||
                    queueName === "isInitialized"
                  ) {
                    return null;
                  }

                  return (
                    <div key={queueName}>
                      <Text strong style={{ textTransform: "capitalize" }}>
                        {queueName.replace(/([A-Z])/g, " $1")}:
                      </Text>
                      <br />
                      <Space>
                        <Text>
                          Waiting: <Text code>{stats.waiting || 0}</Text>
                        </Text>
                        <Text>
                          Active: <Text code>{stats.active || 0}</Text>
                        </Text>
                        <Text>
                          Completed: <Text code>{stats.completed || 0}</Text>
                        </Text>
                        <Text>
                          Failed:{" "}
                          <Text code type="danger">
                            {stats.failed || 0}
                          </Text>
                        </Text>
                      </Space>
                    </div>
                  );
                })}
              </Space>
            ) : (
              <Text type="secondary">Không có dữ liệu queue</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card
        title="Hoạt động gần đây"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {recentClicks.length > 0
                ? `${recentClicks.length} activities`
                : "No recent activity"}
            </Text>
            <Button
              size="small"
              onClick={() => (window.location.href = "/admin/analytics")}
            >
              Xem tất cả
            </Button>
          </Space>
        }
      >
        <Table
          columns={clicksColumns}
          dataSource={Array.isArray(recentClicks) ? recentClicks : []}
          rowKey={(record, index) => record.id || `click-${index}`}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          size="small"
          locale={{
            emptyText: "Chưa có hoạt động nào",
          }}
        />
      </Card>

      <Divider />

      {/* Quick Actions */}
      <Card
        title="Thao tác nhanh"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {sseConnected
                ? "🟢 Real-time monitoring active"
                : "🔴 Manual mode only"}
            </Text>
          </Space>
        }
      >
        <Space wrap>
          <Button
            type="primary"
            onClick={() => (window.location.href = "/admin/users")}
          >
            Quản lý Users
          </Button>
          <Button onClick={() => (window.location.href = "/admin/links")}>
            Kiểm duyệt Links
          </Button>
          <Button onClick={() => (window.location.href = "/admin/analytics")}>
            Xem Analytics
          </Button>
          <Button onClick={() => (window.location.href = "/admin/system")}>
            Cài đặt hệ thống
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
