import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Paper, Typography, TextField, Button,
  Avatar, Snackbar, Alert, IconButton, CircularProgress,
  AppBar, Toolbar
} from '@mui/material';
import { PhotoCamera, ArrowBack } from '@mui/icons-material';
import { updateProfile } from '../../store/slices/authSlice';
import { uploadProfileImage } from '../../api/auth';

// 학습 레벨 (value는 AI 분석 결과로 자동 설정됨)
const LEVELS = [
  { value: 'beginner', label: '하 (초급)' },
  { value: 'intermediate', label: '중 (중급)' },
  { value: 'advanced', label: '상 (고급)' },
];

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({ name: '' });
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '' });
      setProfileImage(user.profileImage || null);
    }
  }, [user]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const imageUrl = await uploadProfileImage(file);
      setProfileImage(imageUrl);
      setSuccess(true);
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('이미지 업로드에 실패했습니다');
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await dispatch(updateProfile(form)).unwrap();
      setSuccess(true);
    } catch (err) {
      console.error('Profile update failed:', err);
      setError('프로필 업데이트에 실패했습니다');
    }
    setLoading(false);
  };

  const getLevelLabel = () => {
    const level = LEVELS.find(l => l.value === user?.learningLevel);
    return level?.label || '분석 중...';
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 헤더 */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            프로필 설정
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            {/* 프로필 이미지 */}
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={profileImage}
                sx={{ 
                  width: 100, 
                  height: 100, 
                  cursor: 'pointer',
                  bgcolor: 'primary.main',
                  fontSize: '2.5rem'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {!profileImage && (user?.name?.[0]?.toUpperCase() || '?')}
              </Avatar>
              {uploading ? (
                <CircularProgress
                  size={24}
                  sx={{ position: 'absolute', bottom: 8, right: 0 }}
                />
              ) : (
                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
              )}
            </Box>
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={handleImageChange}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              사진을 클릭하여 변경
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {user?.email}
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="이름"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              margin="normal"
              required
            />

            {/* 학습 레벨: AI 분석 결과로 자동 설정됨 (읽기 전용) */}
            <TextField
              fullWidth
              label="학습 레벨 (AI 분석 결과)"
              value={getLevelLabel()}
              margin="normal"
              InputProps={{ readOnly: true }}
              helperText="전월 학습 데이터를 기반으로 자동 산출됩니다"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? '저장 중...' : '저장'}
            </Button>
          </Box>
        </Paper>
      </Container>

      {/* 성공 메시지 */}
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess(false)}>
          프로필이 업데이트되었습니다
        </Alert>
      </Snackbar>

      {/* 에러 메시지 */}
      <Snackbar
        open={!!error}
        autoHideDuration={3000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
