import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { Logout, School, Person } from '@mui/icons-material';

export default function Header({ todayTime = 0, studentCount = 0 }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const isStudent = user?.role === 'student';
  const isTutor = user?.role === 'tutor';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <AppBar position="static" sx={{ bgcolor: 'white', color: 'text.primary' }} elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 0, mr: 4, color: 'primary.main', fontWeight: 700 }}>
          🎤 SpeakTracker
        </Typography>
        
        {/* 학생: 오늘 학습 시간 표시 */}
        {isStudent && (
          <Chip 
            icon={<School />}
            label={`오늘 학습: ${Math.floor(todayTime / 60)}분 ${todayTime % 60}초`}
            color="primary"
            variant="outlined"
            sx={{ mr: 'auto' }}
          />
        )}

        {/* 튜터: 담당 학생 수 표시 */}
        {isTutor && (
          <Chip 
            icon={<Person />}
            label={`담당 학생: ${studentCount}명`}
            color="secondary"
            variant="outlined"
            sx={{ mr: 'auto' }}
          />
        )}

        {/* 역할이 없는 경우 (기본) */}
        {!isStudent && !isTutor && (
          <Chip 
            label={`오늘 학습: ${Math.floor(todayTime / 60)}분 ${todayTime % 60}초`}
            color="primary"
            variant="outlined"
            sx={{ mr: 'auto' }}
          />
        )}

        <Chip 
          label={isStudent ? '학생' : isTutor ? '튜터' : '게스트'}
          size="small"
          color={isStudent ? 'info' : isTutor ? 'secondary' : 'default'}
          sx={{ mr: 2 }}
        />
        <Typography variant="body2" sx={{ mr: 2 }}>
          {user?.name || user?.email}
        </Typography>
        <Button 
          onClick={handleLogout} 
          startIcon={<Logout />}
          variant="outlined"
          size="small"
        >
          로그아웃
        </Button>
      </Toolbar>
    </AppBar>
  );
}
