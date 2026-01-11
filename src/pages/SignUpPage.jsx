import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Paper,
  CircularProgress,
  Link,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, Warning } from '@mui/icons-material';
import { register, confirmSignUp } from '../api/auth';

function SignUpPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  
  // 모든 useState를 먼저 선언 (훅 순서 유지)
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 이미 로그인된 경우 잘못된 접근 메시지 표시 후 이전 페이지로
  useEffect(() => {
    if (isAuthenticated) {
      setShowAccessDenied(true);
      const timer = setTimeout(() => {
        navigate(-1); // 이전 페이지로 이동
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate]);

  // 잘못된 접근 페이지
  if (showAccessDenied) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Warning sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              잘못된 접근입니다
            </Typography>
            <Typography variant="body1" color="text.secondary">
              이미 로그인된 상태입니다. 이전 페이지로 돌아갑니다...
            </Typography>
            <CircularProgress sx={{ mt: 3 }} />
          </Paper>
        </Box>
      </Container>
    );
  }

  // 1단계: 회원가입 요청
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await register(email, password, name, role);
      console.log('SignUp response:', response);
      
      if (response.confirmationRequired !== false) {
        setStep('confirm');
      } else {
        // 인증 불필요한 경우 바로 완료
        navigate('/login');
      }
    } catch (err) {
      console.error('SignUp error:', err);
      setError(err.response?.data?.error || err.message || '회원가입 실패');
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 인증 코드 확인
  const handleConfirm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await confirmSignUp(email, code);
      navigate('/login');
    } catch (err) {
      console.error('Confirm error:', err);
      setError(err.response?.data?.error || err.message || '인증 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            {step === 'form' ? '회원가입' : '이메일 인증'}
          </Typography>
          
          {step === 'form' ? (
            <Box component="form" onSubmit={handleSignUp} sx={{ mt: 3 }}>
              <TextField
                fullWidth
                label="이메일"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                autoComplete="email"
              />
              <TextField
                fullWidth
                label="비밀번호"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                inputProps={{ minLength: 8 }}
                helperText="8자 이상 입력하세요"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                fullWidth
                label="이름"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                margin="normal"
                required
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>역할</InputLabel>
                <Select
                  value={role}
                  label="역할"
                  onChange={(e) => setRole(e.target.value)}
                >
                  <MenuItem value="student">학생</MenuItem>
                  <MenuItem value="tutor">튜터</MenuItem>
                </Select>
              </FormControl>
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : '인증 코드 받기'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleConfirm} sx={{ mt: 3 }}>
              <Typography variant="body1" align="center" sx={{ mb: 2 }}>
                {email}로 발송된 6자리 코드를 입력하세요.
              </Typography>
              <TextField
                fullWidth
                label="인증 코드"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                margin="normal"
                required
                inputProps={{ maxLength: 6 }}
                placeholder="123456"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : '가입 완료'}
              </Button>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              이미 계정이 있으신가요?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/login')}
                sx={{ cursor: 'pointer' }}
              >
                로그인
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default SignUpPage;
