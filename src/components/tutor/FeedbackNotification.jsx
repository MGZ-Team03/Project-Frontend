import { Snackbar, Alert } from '@mui/material';

export default function FeedbackNotification({ 
  notification, 
  onClose,
  autoHideDuration = 4000,
  anchorOrigin = { vertical: 'bottom', horizontal: 'center' }
}) {
  return (
    <Snackbar
      open={!!notification}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
    >
      <Alert 
        onClose={onClose} 
        severity={notification?.severity || 'info'}
      >
        {notification?.message}
      </Alert>
    </Snackbar>
  );
}
