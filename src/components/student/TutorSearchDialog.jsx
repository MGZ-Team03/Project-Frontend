import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  InputAdornment,
  Stack,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { getTutors, requestTutor } from '../../api/tutorRegister';
import { getNotifications, markNotificationAsRead } from '../../api/notifications';
import TutorRequestDialog from './TutorRequestDialog';
import ws from '../../config/webSocketConfig';

export default function TutorSearchDialog({ open, onClose, onUpdate }) {
  const [tutors, setTutors] = useState([]);
  const [filteredTutors, setFilteredTutors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('전체');
  
  // 요청 다이얼로그 상태
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);
  
  // 성공 알림
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 알림 관련 state
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Redux에서 학생 이메일 가져오기
  const studentEmail = useSelector(state => state.auth.user?.email);

  const specialties = ['전체', '발음', '문법', '회화'];

  // 튜터 목록 불러오기
  const loadTutors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTutors();
      setTutors(response.data?.tutors || []);
    } catch (err) {
      console.error('튜터 목록 조회 실패:', err);
      setError('튜터 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 알림 목록 조회 (안 읽은 것만)
  const loadNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const response = await getNotifications(false);
      
      // API 응답 구조에 맞게 notifications 추출
      const allNotifications = response.notifications || response.data?.notifications || [];
      
      // TUTOR_REQUEST_APPROVED, TUTOR_REQUEST_REJECTED 타입만 필터링
      const tutorNotifications = allNotifications.filter(
        n => n.type === 'TUTOR_REQUEST_APPROVED' || n.type === 'TUTOR_REQUEST_REJECTED'
      );
      
      setNotifications(tutorNotifications);
    } catch (err) {
      console.error('알림 조회 실패:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // WebSocket 메시지 핸들러 - 싱글톤 WebSocket 사용
  const handleWebSocketMessage = useCallback((data) => {
    // 승인 알림
    if (data.type === 'TUTOR_REQUEST_APPROVED') {
      setSnackbar({
        open: true,
        message: `${data.data.tutor_name} 튜터님이 요청을 승인했습니다! 🎉`,
        severity: 'success'
      });
      // 튜터 목록 새로고침
      loadTutors();
      // 알림 목록도 갱신
      loadNotifications();
    }
    
    // 거부 알림
    if (data.type === 'TUTOR_REQUEST_REJECTED') {
      const reason = data.data.rejection_reason || '사유 없음';
      setSnackbar({
        open: true,
        message: `${data.data.tutor_name} 튜터님이 요청을 거부했습니다: ${reason}`,
        severity: 'error'
      });
      // 튜터 목록 새로고침
      loadTutors();
      // 알림 목록도 갱신
      loadNotifications();
    }
  }, [loadTutors, loadNotifications]);

  // 다이얼로그가 열릴 때 WebSocket 리스너 등록
  useEffect(() => {
    if (open) {
      const unsubscribe = ws.addMessageListener(handleWebSocketMessage);
      return () => unsubscribe();
    }
  }, [open, handleWebSocketMessage]);

  // 알림 확인 (읽음 처리)
  const handleMarkAsRead = async (notificationIdTimestamp) => {
    try {
      await markNotificationAsRead(notificationIdTimestamp);
      
      // 목록에서 제거
      setNotifications(prev => 
        prev.filter(n => n.notificationIdTimestamp !== notificationIdTimestamp)
      );
      
      // 부모 컴포넌트에 알림 카운트 갱신 요청
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('알림 읽음 처리 실패:', err);
    }
  };

  // 튜터 목록 불러오기
  useEffect(() => {
    if (open) {
      loadTutors();
      loadNotifications();  // 알림도 함께 로드
    }
  }, [open]);

  // 검색 및 필터링
  useEffect(() => {
    let result = tutors;

    // 전문분야 필터
    if (selectedSpecialty !== '전체') {
      result = result.filter(tutor =>
        tutor.specialties?.includes(selectedSpecialty)
      );
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tutor =>
        tutor.name.toLowerCase().includes(query) ||
        tutor.bio?.toLowerCase().includes(query) ||
        tutor.specialties?.some(s => s.toLowerCase().includes(query))
      );
    }

    setFilteredTutors(result);
  }, [tutors, searchQuery, selectedSpecialty]);

  const handleRequestClick = (tutor) => {
    setSelectedTutor(tutor);
    setRequestDialogOpen(true);
  };

  const handleRequestSubmit = async (message) => {
    try {
      await requestTutor(selectedTutor.email, message);
      setRequestDialogOpen(false);
      setSnackbar({
        open: true,
        message: `${selectedTutor.name}님에게 등록 요청을 보냈습니다.`
      });
      // 목록 새로고침
      await loadTutors();
    } catch (err) {
      console.error('등록 요청 실패:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error?.message || '등록 요청에 실패했습니다.'
      });
    }
  };

  const getStatusChip = (tutor) => {
    if (tutor.myRequestStatus === 'pending') {
      return <Chip label="대기 중" color="warning" size="small" />;
    }
    if (tutor.myRequestStatus === 'registered') {
      return <Chip label="등록됨" color="success" size="small" />;
    }
    if (tutor.myRequestStatus === 'rejected') {
      return <Chip label="거부됨" color="error" size="small" />;
    }
    if (!tutor.isAccepting) {
      return <Chip label="모집 마감" color="default" size="small" />;
    }
    if (tutor.currentStudents >= tutor.maxStudents) {
      return <Chip label="정원 마감" color="default" size="small" />;
    }
    return <Chip label="모집 중" color="success" size="small" />;
  };

  const canRequest = (tutor) => {
    if (tutor.myRequestStatus === 'rejected') {
      return false;
    }
    return !tutor.myRequestStatus &&
           tutor.isAccepting &&
           tutor.currentStudents < tutor.maxStudents;
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">튜터 찾기</Typography>
            <Button
              onClick={onClose}
              color="inherit"
              startIcon={<CloseIcon />}
            >
              닫기
            </Button>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* 알림 영역 - 상단 */}
            {notifications.length > 0 && (
              <Box 
                sx={{ 
                  bgcolor: 'grey.50', 
                  p: 2, 
                  borderRadius: 2, 
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                  <NotificationsIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight="bold">
                    새 알림 {notifications.length}개
                  </Typography>
                </Stack>
                
                <Stack spacing={1}>
                  {notifications.slice(0, 3).map(notification => {
                    const isApproved = notification.type === 'TUTOR_REQUEST_APPROVED';
                    
                    return (
                      <Card 
                        key={notification.notificationIdTimestamp || notification.notification_id} 
                        variant="outlined"
                        sx={{ 
                          borderLeft: '4px solid',
                          borderLeftColor: isApproved ? 'success.main' : 'error.main',
                          bgcolor: isApproved ? 'success.lighter' : 'error.lighter',
                        }}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {isApproved ? (
                              <ApprovedIcon color="success" fontSize="small" />
                            ) : (
                              <RejectedIcon color="error" fontSize="small" />
                            )}
                            <Box flex={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {notification.data?.tutor_name}님이 요청을 {isApproved ? '승인' : '거부'}했습니다
                              </Typography>
                              {!isApproved && notification.data?.rejection_reason && (
                                <Typography variant="caption" color="text.secondary">
                                  사유: {notification.data.rejection_reason}
                                </Typography>
                              )}
                            </Box>
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
                  
                  {notifications.length > 3 && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      +{notifications.length - 3}개의 알림이 더 있습니다
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {/* 검색 바 */}
            <TextField
              fullWidth
              placeholder="튜터 이름 또는 전문분야 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            {/* 전문분야 필터 */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {specialties.map(specialty => (
                <Chip
                  key={specialty}
                  label={specialty}
                  color={selectedSpecialty === specialty ? 'primary' : 'default'}
                  onClick={() => setSelectedSpecialty(specialty)}
                  sx={{ mb: 1 }}
                />
              ))}
            </Stack>

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

            {/* 튜터 카드 리스트 */}
            {!loading && (
              <Grid container spacing={2}>
                {filteredTutors.length === 0 ? (
                  <Grid item xs={12}>
                    <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>
                      {searchQuery || selectedSpecialty !== '전체'
                        ? '검색 결과가 없습니다.'
                        : '등록된 튜터가 없습니다.'}
                    </Typography>
                  </Grid>
                ) : (
                  filteredTutors.map(tutor => (
                    <Grid item xs={12} sm={6} key={tutor.email}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Stack spacing={2}>
                            {/* 프로필 */}
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar
                                src={tutor.profile_image}
                                alt={tutor.name}
                                sx={{ width: 56, height: 56 }}
                              />
                              <Box flexGrow={1}>
                                <Typography variant="h6" gutterBottom>
                                  {tutor.name}
                                </Typography>
                                {getStatusChip(tutor)}
                              </Box>
                            </Stack>

                            {/* 소개 */}
                            <Typography variant="body2" color="text.secondary">
                              {tutor.bio || '소개가 없습니다.'}
                            </Typography>

                            {/* 전문분야 */}
                            {tutor.specialties && tutor.specialties.length > 0 && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  전문분야:
                                </Typography>
                                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap" useFlexGap>
                                  {tutor.specialties.map(s => (
                                    <Chip key={s} label={s} size="small" variant="outlined" />
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {/* 학생 수 */}
                            <Typography variant="caption" color="text.secondary">
                              학생: {tutor.currentStudents || 0}/{tutor.maxStudents || 0}명
                            </Typography>
                          </Stack>
                        </CardContent>

                        <CardActions>
                          {canRequest(tutor) ? (
                            <Button
                              fullWidth
                              variant="contained"
                              startIcon={<PersonAddIcon />}
                              onClick={() => handleRequestClick(tutor)}
                            >
                              등록 요청
                            </Button>
                          ) : (
                            <Button fullWidth disabled>
                              {tutor.myRequestStatus === 'pending' && '대기 중'}
                              {tutor.myRequestStatus === 'registered' && '등록됨'}
                              {tutor.myRequestStatus === 'rejected' && '거부됨 (재요청 불가)'}
                              {!tutor.myRequestStatus && !tutor.isAccepting && '모집 마감'}
                              {!tutor.myRequestStatus && tutor.isAccepting &&
                                tutor.currentStudents >= tutor.maxStudents && '정원 마감'}
                            </Button>
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))
                )}
              </Grid>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* 등록 요청 다이얼로그 */}
      <TutorRequestDialog
        open={requestDialogOpen}
        tutor={selectedTutor}
        onClose={() => setRequestDialogOpen(false)}
        onSubmit={handleRequestSubmit}
      />

      {/* 성공/에러 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
          severity={snackbar.severity}
          icon={snackbar.severity === 'success' ? <ApprovedIcon /> : <RejectedIcon />}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
