import {
  Card,
  CardContent,
  Stack,
  Avatar,
  Box,
  Typography,
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
import QuickFeedbackChips from './QuickFeedbackChips';

function getStatusColor(status) {
  switch (status) {
    case 'speaking': return 'success';
    case 'listening': return 'warning';
    case 'idle': return 'error';
    case 'inactive': return 'default';
    default: return 'default';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'speaking': return '학습 중';
    case 'listening': return '듣기만';
    case 'idle': return '미활동';
    case 'inactive': return '오프라인';
    default: return '오프라인';
  }
}

export default function StudentCard({ 
  student, 
  onClick, 
  onFeedbackClick, 
  tutorEmail, 
  disabled, 
  onQuickFeedbackSuccess, 
  onQuickFeedbackError 
}) {
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
      onClick={() => onClick(student.email)}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Circle sx={{ fontSize: 12, color: `${statusColor}.main` }} />

          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {student.name.charAt(0)}
          </Avatar>

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
              {student.alert && student.status !== 'inactive' && (
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

          <Stack direction="row" spacing={0.5}>
            <Tooltip title="상세 보기">
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(student.email);
                }}
              >
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="피드백 보내기">
              <IconButton
                size="small"
                color="secondary"
                onClick={(e) => onFeedbackClick(student, e)}
                disabled={disabled}
              >
                <Message fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {student.status !== 'inactive' && (
          <LinearProgress
            variant="determinate"
            value={student.speakingRatio}
            color={statusColor}
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        )}

        <QuickFeedbackChips
          student={student}
          tutorEmail={tutorEmail}
          disabled={disabled || student.status === 'inactive'}
          onSuccess={onQuickFeedbackSuccess}
          onError={onQuickFeedbackError}
        />
      </CardContent>
    </Card>
  );
}
