import StudentLayout from '../../components/common/StudentLayout';
import { Box } from '@mui/material';

export default function LandingPage() {
  const CLOUDFRONT_URL = 'https://d2zczzecj3n92n.cloudfront.net';

  return (
    <StudentLayout>
      <Box
        sx={{
          position: 'fixed',
          top: 64, // Header 높이
          left: 0,
          right: 0,
          bottom: 56, // BottomNav 높이
          overflow: 'hidden',
          bgcolor: 'white',
          zIndex: 1,
        }}
      >
        <iframe
          src={CLOUDFRONT_URL}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
          title="SpeakTracker 소개"
        />
      </Box>
    </StudentLayout>
  );
}
