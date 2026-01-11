import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction } from '@mui/material';
import { MenuBook, Chat, BarChart } from '@mui/icons-material';

const navItems = [
  { label: '연습', icon: <MenuBook />, path: '/practice' },
  { label: '대화', icon: <Chat />, path: '/chat' },
  { label: '통계', icon: <BarChart />, path: '/stats' },
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
