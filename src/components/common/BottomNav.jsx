import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction } from '@mui/material';
import { Home, BarChart, Info } from '@mui/icons-material';

const navItems = [
  { label: '홈', icon: <Home />, path: '/home' },
  { label: '통계', icon: <BarChart />, path: '/stats' },
  { label: '소개', icon: <Info />, path: '/introduce' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // 현재 경로에 해당하는 인덱스 찾기
  const currentIndex = navItems.findIndex(item => location.pathname === item.path);

  const handleNavigation = (event, newValue) => {
    navigate(navItems[newValue].path);
  };

  return (
    <BottomNavigation
      value={currentIndex >= 0 ? currentIndex : 0}
      onChange={handleNavigation}
      showLabels
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {navItems.map((item) => (
        <BottomNavigationAction 
          key={item.path}
          label={item.label} 
          icon={item.icon} 
        />
      ))}
    </BottomNavigation>
  );
}
