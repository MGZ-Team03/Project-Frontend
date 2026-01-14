import { Box } from '@mui/material';
import Header from './Header';

export default function TutorLayout({ children, studentCount = 0 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Header studentCount={studentCount} />
      
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          p: 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
