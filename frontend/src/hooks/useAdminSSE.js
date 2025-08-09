// frontend/src/hooks/useAdminSSE.js
import { useState, useEffect, useRef } from "react";
import { notification } from "antd";
import useAuthStore from "../stores/authStore";

const useAdminSSE = () => {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  // ✅ Get token from authStore like other components
  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!token || !isAuthenticated) {
      console.log("⚠️ No token or not authenticated for SSE");
      return;
    }

    console.log("🔌 Connecting to Admin SSE...");

    // ✅ FIX: EventSource cannot set Authorization header in browser
    // Pass token via query parameter instead
    const eventSource = new EventSource(
      `http://localhost:4000/api/admin/live-stats?token=${encodeURIComponent(
        token
      )}`
    );

    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.onopen = () => {
      console.log("✅ SSE Connected");
      setConnected(true);
      setError(null);

      notification.success({
        message: "Real-time Connected",
        description: "Dashboard is now live updating",
        duration: 3,
      });
    };

    // Handle stats updates
    eventSource.addEventListener("stats-update", (event) => {
      try {
        const newData = JSON.parse(event.data);
        console.log("📊 SSE Stats Update:", newData);
        setData(newData);
      } catch (err) {
        console.error("❌ Error parsing SSE data:", err);
      }
    });

    // Handle heartbeat
    eventSource.addEventListener("heartbeat", (event) => {
      console.log("💓 SSE Heartbeat received");
    });

    // Handle errors
    eventSource.addEventListener("error", (event) => {
      try {
        const errorData = JSON.parse(event.data);
        console.error("❌ SSE Error:", errorData);
        setError(errorData.message);

        notification.error({
          message: "Real-time Error",
          description: errorData.message,
          duration: 5,
        });
      } catch (err) {
        console.error("❌ SSE Parse Error:", err);
      }
    });

    // Handle connection errors
    eventSource.onerror = (event) => {
      console.error("❌ SSE Connection Error:", event);
      setConnected(false);
      setError("Connection lost");

      notification.warning({
        message: "Connection Lost",
        description: "Trying to reconnect...",
        duration: 3,
      });
    };

    // Cleanup on unmount
    return () => {
      console.log("🔌 Disconnecting SSE...");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setConnected(false);
    };
  }, [token, isAuthenticated]);

  // Manual reconnect function
  const reconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    // Force re-effect by changing a dependency
    window.location.reload();
  };

  return {
    data,
    connected,
    error,
    reconnect,
  };
};

export default useAdminSSE;
