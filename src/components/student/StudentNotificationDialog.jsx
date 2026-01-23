import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Stack,
  Card,
  CardContent,
  Avatar,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getNotifications, markNotificationAsRead } from '../../api/notifications';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function StudentNotificationDialog({ open, onClose, onUpdate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 알림 불러오기
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 안 읽은 알림만 조회
      const response = await getNotifications(false);
      
      // 백엔드 응답: { data: { notifications: [...], unreadCount: n } }
      setNotifications(response.data?.notifications || []);
    } catch (err) {
      console.error('알림 조회 실패:', err);
      setError('알림을 불러오는 데 실패했습니다.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리
  const handleMarkAsRead = async (notificationIdTimestamp) => {
    try {
      await markNotificationAsRead(notificationIdTimestamp);
      
      // 목록에서 제거 (notificationIdTimestamp로 필터링)
      setNotifications(prev => prev.filter(n => n.notificationIdTimestamp !== notificationIdTimestamp));
      
      // 부모 컴포넌트에 알림
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('알림 읽음 처리 실패:', err);
    }
  };

  // 시간 포맷팅
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return '방금 전';
    }
  };

  // 알림 아이콘 및 색상
  const getNotificationStyle = (type) => {
    switch (type) {
      case 'TUTOR_REQUEST_APPROVED':
        return { icon: <ApprovedIcon />, color: 'success.main', bgColor: 'success.lighter' };
      case 'TUTOR_REQUEST_REJECTED':
        return { icon: <RejectedIcon />, color: 'error.main', bgColor: 'error.lighter' };
      default:
        return { icon: <InfoIcon />, color: 'info.main', bgColor: 'info.lighter' };
    }
  };

  // 알림 제목 및 메시지
  const getNotificationContent = (notification) => {
    const { type, data, title, message } = notification;
    
    switch (type) {
      case 'TUTOR_REQUEST_APPROVED':
        return {
          title: '튜터 등록 승인됨 ✅',
          message: `${data?.tutor_name || '튜터'}님이 등록 요청을 승인했습니다!`,
        };
      case 'TUTOR_REQUEST_REJECTED':
        return {
          title: '튜터 등록 거부됨 ❌',
          message: `${data?.tutor_name || '튜터'}님이 등록 요청을 거부했습니다.`,
          reason: data?.rejection_reason,
        };
      default:
        return { title: title || '알림', message: message || '' };
    }
  };

  const unreadCount = notifications.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotificationsIcon color="primary" />
            <Typography variant="h6">알림</Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount}개`}
                color="error"
                size="small"
              />
            )}
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* 로딩 */}
          {loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          {/* 알림 목록 */}
          {!loading && notifications.length === 0 && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={8}
            >
              <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                새로운 알림이 없습니다
              </Typography>
            </Box>
          )}

          {!loading && notifications.map((notification) => {
            const style = getNotificationStyle(notification.type);
            const content = getNotificationContent(notification);

            return (
              <Card
                key={notification.notificationIdTimestamp || notification.notification_id}
                variant="outlined"
                sx={{
                  bgcolor: 'action.hover',
                  borderLeft: '4px solid',
                  borderLeftColor: style.color,
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    {/* 헤더 */}
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: style.color }}>
                        {style.icon}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {content.title}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {content.message}
                        </Typography>
                        
                        {/* 거부 사유 */}
                        {content.reason && (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            <Typography variant="caption">
                              <strong>거부 사유:</strong> {content.reason}
                            </Typography>
                          </Alert>
                        )}
                        
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {formatTime(notification.created_at)}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider />

                    {/* 읽음 처리 버튼 */}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleMarkAsRead(notification.notificationIdTimestamp)}
                    >
                      확인
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
