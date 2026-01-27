import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Stack,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import useNotificationHandler from '../../hooks/tutor/useNotificationHandler';

export default function NotificationDialog({ open, onClose, notifications, onUpdate, onStudentListUpdate }) {
  const [loading] = useState(false);

  const {
    processing,
    error,
    confirmDialog,
    handleApprove,
    handleRejectClick,
    handleReject,
    handleRejectCancel,
    clearError,
  } = useNotificationHandler(notifications, onUpdate, onStudentListUpdate);

  // 읽지 않은 알림 개수
  const unreadCount = notifications.filter(n => !n.read).length;

  // 시간 포맷팅
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } catch {
      return '방금 전';
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        disableRestoreFocus
        PaperProps={{
          sx: { minHeight: '60vh', maxHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6">
                튜터 등록 요청
              </Typography>
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
              <Alert severity="error" onClose={clearError}>
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

            {!loading && notifications.map((notification, index) => (
              <Card
                key={notification.notification_id || notification.data?.request_id || `notification-${index}`}
                variant="outlined"
                sx={{
                  bgcolor: notification.read ? 'background.paper' : 'action.hover',
                  borderLeft: !notification.read ? '4px solid' : 'none',
                  borderLeftColor: 'primary.main',
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {notification.data?.student_name?.charAt(0) || '학'}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {notification.data?.student_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {notification.data?.student_email}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {notification.data?.message || '튜터 등록을 요청했습니다.'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(notification.created_at)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>

                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<RejectIcon />}
                    onClick={() => handleRejectClick(
                      notification.data?.request_id,
                      notification.data?.student_name,
                      notification.data?.student_email
                    )}
                    disabled={processing === notification.data?.request_id}
                  >
                    거부
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<ApproveIcon />}
                    onClick={() => handleApprove(notification.data?.request_id)}
                    disabled={processing === notification.data?.request_id}
                  >
                    {processing === notification.data?.request_id ? '처리 중...' : '승인'}
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* 거부 확인 대화상자 */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleRejectCancel}
        maxWidth="xs"
        fullWidth
        disableRestoreFocus
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <RejectIcon color="error" />
            <Typography variant="h6">
              튜터 등록 요청 거부
            </Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              <Typography variant="body2">
                거부하시면 <strong>{confirmDialog.studentName}</strong> 학생이 
                더 이상 튜터 등록 요청을 할 수 없게 됩니다.
              </Typography>
            </Alert>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                학생 정보:
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                <strong>{confirmDialog.studentName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {confirmDialog.studentEmail}
              </Typography>
            </Box>
            
            <Typography variant="body2">
              정말로 이 학생의 튜터 등록 요청을 거부하시겠습니까?
            </Typography>
          </Stack>
        </DialogContent>
        
        <CardActions sx={{ justifyContent: 'flex-end', px: 3, pb: 2 }}>
          <Button
            onClick={handleRejectCancel}
            variant="outlined"
          >
            취소
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            startIcon={<RejectIcon />}
            disabled={processing === confirmDialog.requestId}
          >
            {processing === confirmDialog.requestId ? '처리 중...' : '거부하기'}
          </Button>
        </CardActions>
      </Dialog>
    </>
  );
}
