import { Box } from '@mui/material';
import Header from './Header';
import BottomNav from './BottomNav';

export default function StudentLayout({ children, todayTime = 0 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Header todayTime={todayTime} />
      
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          p: 3,
          pb: 10, // 하단 네비게이션 공간
        }}
      >
        {children}
      </Box>

      <BottomNav />
    </Box>
  );
}
