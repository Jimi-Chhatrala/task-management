import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useGetUnreadNotificationCount,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getGetUnreadNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  task_created: "✨",
  status_changed: "🔄",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: countData } = useGetUnreadNotificationCount({
    query: {
      queryKey: getGetUnreadNotificationCountQueryKey(),
      refetchInterval: 15000,
    },
  });

  const { data: notifications = [] } = useListNotifications(
    {},
    {
      query: {
        queryKey: getListNotificationsQueryKey(),
        enabled: open,
      },
    }
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = countData?.count ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUnreadNotificationCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const handleNotificationClick = (notificationId: number, taskId: number, isRead: boolean) => {
    if (!isRead) {
      markRead.mutate({ id: notificationId }, { onSuccess: invalidate });
    }
    setOpen(false);
    setLocation(`/tasks/${taskId}`);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, { onSuccess: invalidate });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          )}

          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={cn(
                "w-full text-left px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors flex gap-3 items-start",
                !n.read && "bg-primary/5"
              )}
              onClick={() => handleNotificationClick(n.id, n.task_id, n.read)}
            >
              <span className="text-base shrink-0 mt-0.5">
                {TYPE_ICONS[n.type] ?? "🔔"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm leading-snug", !n.read && "font-medium")}>
                  {n.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.read && (
                <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
