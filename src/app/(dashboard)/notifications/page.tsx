'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import DashboardHero from '@/components/layout/DashboardHero';
import { Bell, Check, Trash2, ExternalLink, Calendar, MessageSquare, Syringe, Info, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: 'READ' | 'UNREAD';
  link: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (notification.status === 'UNREAD') {
      await markAsRead([notification.id]);
    }
    
    // Navigate to the link if available
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'VISIT_REMINDER':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'VACCINATION_REMINDER':
        return <Syringe className="h-5 w-5 text-purple-500" />;
      case 'CHAT':
        return <MessageSquare className="h-5 w-5 text-emerald-500" />;
      case 'ALERT':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'INFO':
        return <Info className="h-5 w-5 text-teal-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationBgColor = (type: string, isUnread: boolean) => {
    if (!isUnread) return 'bg-white hover:bg-gray-50';
    
    switch (type) {
      case 'VISIT_REMINDER':
        return 'bg-blue-50/70 hover:bg-blue-100/70';
      case 'VACCINATION_REMINDER':
        return 'bg-purple-50/70 hover:bg-purple-100/70';
      case 'CHAT':
        return 'bg-emerald-50/70 hover:bg-emerald-100/70';
      case 'ALERT':
        return 'bg-red-50/70 hover:bg-red-100/70';
      default:
        return 'bg-teal-50/70 hover:bg-teal-100/70';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.status === 'UNREAD').length;
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'UNREAD') return n.status === 'UNREAD';
    if (filter === 'READ') return n.status === 'READ';
    return true;
  });

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Notifications"
        subtitle={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up! No unread notifications.'}
        pillLabel="Alerts"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              className="!bg-white hover:!bg-gray-100 !text-gray-900 font-bold rounded-xl !border !border-gray-200 shadow-sm transition-all cursor-pointer"
              onClick={markAllAsRead}
            >
              <Check className="h-4 w-4 mr-2 text-teal-600" />
              Mark All as Read
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'ALL' 
              ? 'bg-gray-900 text-white shadow-sm' 
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'UNREAD' 
              ? 'bg-gray-900 text-white shadow-sm' 
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('READ')}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'READ' 
              ? 'bg-gray-900 text-white shadow-sm' 
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 transition-colors cursor-pointer ${
                    getNotificationBgColor(notification.type, notification.status === 'UNREAD')
                  } ${notification.link ? 'cursor-pointer' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{notification.title}</h4>
                      {notification.status === 'UNREAD' && (
                        <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />
                      )}
                      {notification.link && (
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-gray-400">
                        {formatDateTime(notification.createdAt)}
                      </p>
                      <Badge variant="default" className="text-xs">
                        {notification.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {notification.status === 'UNREAD' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead([notification.id]);
                        }}
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete notification"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'ALL' ? 'No notifications' : `No ${filter.toLowerCase()} notifications`}
              </h3>
              <p className="text-gray-500">
                {filter === 'ALL' ? "You're all caught up!" : 'Check the other tabs for more notifications'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
