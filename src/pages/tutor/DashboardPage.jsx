// 튜터 실시간 모니터링 대시보드 (목업)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Avatar,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Circle,
  Visibility,
  Message,
  MenuBook,
  Chat,
  Warning,
} from '@mui/icons-material';
import TutorLayout from '../../components/common/TutorLayout';

// 목업 학생 데이터
const MOCK_STUDENTS = [
  {
    email: 'park@student.com',
    name: '박영어',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 85,
    duration: 12,
    currentSentence: 'How are you doing today?',
  },
  {
    email: 'kim@student.com',
    name: '김스피킹',
    activity: 'ai_chat',
    status: 'speaking',
    speakingRatio: 78,
    duration: 23,
    currentTopic: '카페 주문',
  },
  {
    email: 'choi@student.com',
    name: '최토익',
    activity: 'sentence',
    status: 'listening',
    speakingRatio: 30,
    duration: 8,
    currentSentence: 'The weather is nice today.',
    warning: true,
  },
  {
    email: 'jung@student.com',
    name: '정회화',
    activity: null,
    status: 'inactive',
    speakingRatio: 0,
    duration: 0,
    lastActive: '5분 전',
    alert: true,
  },
  {
    email: 'lee@student.com',
    name: '이잉글',
    activity: 'ai_chat',
    status: 'speaking',
    speakingRatio: 72,
    duration: 15,
    currentTopic: '길 묻기',
  },
  {
    email: 'han@student.com',
    name: '한영희',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 80,
    duration: 18,
    currentSentence: 'I would like a cup of coffee.',
  },
  {
    email: 'song@student.com',
    name: '송민수',
    activity: 'ai_chat',
    status: 'listening',
    speakingRatio: 45,
    duration: 10,
    currentTopic: '자기소개',
    warning: true,
  },
  {
    email: 'yoon@student.com',
    name: '윤지민',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 90,
    duration: 30,
    currentSentence: 'Where is the nearest subway station?',
  },
];

function getStatusColor(status) {
  switch (status) {
    case 'speaking': return 'success';
    case 'listening': return 'warning';
    case 'inactive': return 'error';
    default: return 'default';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'speaking': return '발음 중';
    case 'listening': return '듣기만';
    case 'inactive': return '미활동';
    default: return '오프라인';
  }
}

function StudentCard({ student, onClick }) {
  const statusColor = getStatusColor(student.status);

  return (
    <Card 
      elevation={student.alert ? 4 : 2}
      sx={{ 
        cursor: 'pointer',
        border: student.alert ? '2px solid' : 'none',
        borderColor: 'error.main',
        '&:hover': { boxShadow: 6 },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          {/* 상태 아이콘 */}
          <Circle 
            sx={{ 
              fontSize: 12, 
              color: `${statusColor}.main`,
            }} 
          />

          {/* 프로필 */}
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {student.name.charAt(0)}
          </Avatar>

          {/* 정보 */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {student.name}
              </Typography>
              {student.warning && (
                <Tooltip title="발음 비율 낮음">
                  <Warning color="warning" sx={{ fontSize: 18 }} />
                </Tooltip>
              )}
              {student.alert && (
                <Chip label="개입 필요" size="small" color="error" />
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {student.activity && (
                <Chip
                  icon={student.activity === 'sentence' ? <MenuBook sx={{ fontSize: 14 }} /> : <Chat sx={{ fontSize: 14 }} />}
                  label={student.activity === 'sentence' ? '문장연습' : 'AI대화'}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                label={getStatusLabel(student.status)}
                size="small"
                color={statusColor}
              />
            </Stack>
          </Box>

          {/* 발음 비율 & 시간 */}
          <Box sx={{ textAlign: 'right', minWidth: 80 }}>
            {student.status !== 'inactive' ? (
              <>
                <Typography variant="h6" fontWeight={600} color={`${statusColor}.main`}>
                  {student.speakingRatio}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {student.duration}분
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="error.main">
                {student.lastActive}
              </Typography>
            )}
          </Box>

          {/* 액션 버튼 */}
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="상세 보기">
              <IconButton size="small" color="primary">
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="피드백 보내기">
              <IconButton size="small" color="secondary">
                <Message fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* 진행률 바 */}
        {student.status !== 'inactive' && (
          <LinearProgress
            variant="determinate"
            value={student.speakingRatio}
            color={statusColor}
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [students] = useState(MOCK_STUDENTS);

  const activeStudents = students.filter(s => s.status !== 'inactive');
  const speakingStudents = students.filter(s => s.status === 'speaking');
  const warningStudents = students.filter(s => s.warning || s.alert);

  const handleStudentClick = (email) => {
    navigate(`/tutor/students/${email}`);
  };

  return (
    <TutorLayout studentCount={students.length}>
      <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
        {/* 요약 통계 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {students.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전체 학생
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {speakingStudents.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  발음 중
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="warning.main">
                  {warningStudents.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  주의 필요
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 상태 범례 */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'success.main' }} />
            <Typography variant="caption">발음 중</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'warning.main' }} />
            <Typography variant="caption">발음 비율 낮음</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'error.main' }} />
            <Typography variant="caption">미활동</Typography>
          </Stack>
        </Stack>

        {/* 학생 목록 */}
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          📋 현재 학습 중인 학생 ({activeStudents.length}명)
        </Typography>

        <Stack spacing={2}>
          {students.map((student) => (
            <StudentCard
              key={student.email}
              student={student}
              onClick={() => handleStudentClick(student.email)}
            />
          ))}
        </Stack>
      </Box>
    </TutorLayout>
  );
}
