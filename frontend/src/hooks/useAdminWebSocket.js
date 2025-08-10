// frontend/src/hooks/useAdminWebSocket.js
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./useAuth";

const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || "ws://localhost:5000";
const RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

export const useAdminWebSocket = () => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected"); // disconnected, connecting, connected, error
  const [stats, setStats] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  // Clean up function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!user || user.role !== "admin" || !token) {
      setError("Admin access required");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("🌐 WebSocket already connected");
      return;
    }

    try {
      setConnectionState("connecting");
      setError(null);

      const wsUrl = `${WEBSOCKET_URL}/admin/ws?token=${encodeURIComponent(
        token
      )}`;
      console.log("🌐 Connecting to Admin WebSocket...");

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("✅ Admin WebSocket connected");
        setIsConnected(true);
        setConnectionState("connected");
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectCount(0);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
          setError("Failed to parse server message");
        }
      };

      wsRef.current.onclose = (event) => {
        console.log("📡 Admin WebSocket closed:", event.code, event.reason);
        setIsConnected(false);
        setConnectionState("disconnected");

        // Only attempt reconnection if not manually closed
        if (
          !isManuallyClosedRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          scheduleReconnect();
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError("Maximum reconnection attempts reached");
          setConnectionState("error");
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ Admin WebSocket error:", error);
        setError("WebSocket connection error");
        setConnectionState("error");
      };
    } catch (error) {
      console.error("❌ Error creating WebSocket connection:", error);
      setError("Failed to create WebSocket connection");
      setConnectionState("error");
    }
  }, [user, token]);

  // Handle incoming messages
  const handleMessage = useCallback((message) => {
    console.log("📨 WebSocket message:", message.type);
    setLastUpdate(new Date());

    switch (message.type) {
      case "connection":
        console.log("✅ Connection established:", message.data.message);
        break;

      case "initial_stats":
      case "stats_update":
        setStats(message.data);
        break;

      case "action_result":
        console.log("🎯 Action result:", message.data);
        // You can add a toast notification here
        if (window.showToast) {
          window.showToast(
            message.data.success ? "success" : "error",
            message.data.message
          );
        }
        break;

      case "error":
        console.error("❌ Server error:", message.data);
        setError(message.data.message || "Server error");
        break;

      case "pong":
        // Heartbeat response
        break;

      default:
        console.log("📋 Unknown message type:", message.type, message.data);
    }
  }, []);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    reconnectAttemptsRef.current += 1;
    setReconnectCount(reconnectAttemptsRef.current);

    const delay = Math.min(
      RECONNECT_INTERVAL * reconnectAttemptsRef.current,
      30000
    ); // Max 30s delay

    console.log(
      `🔄 Scheduling reconnection attempt ${reconnectAttemptsRef.current} in ${delay}ms`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!isManuallyClosedRef.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  // Send message to server
  const sendMessage = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type,
          payload,
          timestamp: new Date().toISOString(),
        };

        wsRef.current.send(JSON.stringify(message));
        console.log("📤 Sent message:", type);
        return true;
      } catch (error) {
        console.error("❌ Error sending message:", error);
        setError("Failed to send message");
        return false;
      }
    } else {
      console.warn("⚠️ WebSocket not connected, cannot send message");
      setError("WebSocket not connected");
      return false;
    }
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    console.log("🔄 Manual reconnection requested");
    cleanup();
    reconnectAttemptsRef.current = 0;
    setReconnectCount(0);
    isManuallyClosedRef.current = false;
    connect();
  }, [cleanup, connect]);

  // Disconnect
  const disconnect = useCallback(() => {
    console.log("🛑 Manual disconnection requested");
    isManuallyClosedRef.current = true;
    cleanup();
    setIsConnected(false);
    setConnectionState("disconnected");
    setError(null);
  }, [cleanup]);

  // Request latest stats
  const requestStats = useCallback(() => {
    return sendMessage("request_stats");
  }, [sendMessage]);

  // Send clear queues command
  const clearQueues = useCallback(
    (queueNames = []) => {
      return sendMessage("clear_queues", { queueNames });
    },
    [sendMessage]
  );

  // Send restart service command
  const restartService = useCallback(
    (serviceName) => {
      return sendMessage("restart_service", { service: serviceName });
    },
    [sendMessage]
  );

  // Send ping
  const ping = useCallback(() => {
    return sendMessage("ping");
  }, [sendMessage]);

  // Auto-connect when user is admin and has token
  useEffect(() => {
    if (user?.role === "admin" && token) {
      isManuallyClosedRef.current = false;
      connect();
    } else {
      disconnect();
    }

    return () => {
      isManuallyClosedRef.current = true;
      cleanup();
    };
  }, [user, token, connect, disconnect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isManuallyClosedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    // Connection state
    isConnected,
    connectionState,
    error,
    reconnectCount,
    lastUpdate,

    // Data
    stats,

    // Actions
    connect,
    disconnect,
    reconnect,
    sendMessage,
    requestStats,
    clearQueues,
    restartService,
    ping,

    // Utils
    isReady: isConnected && connectionState === "connected",
    isReconnecting: connectionState === "connecting" && reconnectCount > 0,
  };
};
