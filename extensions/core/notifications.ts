export interface NotificationItem {
  id: string;
  level: "info" | "warning" | "error";
  message: string;
  timestamp: string;
}

const notifications: NotificationItem[] = [];

export function getNotifications(): NotificationItem[] {
  return [...notifications];
}

export function clearNotifications(): void {
  notifications.length = 0;
}

export default function (pi: any) {
  // Catch errors or significant lifecycle events to notify
  pi.on("agent_end", async (event: any) => {
    if (event?.status === "error") {
      notifications.push({
        id: `notif_${Date.now()}`,
        level: "error",
        message: event.error ?? "Agent finished with error",
        timestamp: new Date().toISOString(),
      });
    }
  });
}
