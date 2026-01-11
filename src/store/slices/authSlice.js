import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { login as cognitoLogin, logout as cognitoLogout, getCurrentUser } from '../../api/auth';

// 로그인 액션
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const user = await cognitoLogin(email, password);
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      return rejectWithValue(error.message || '로그인에 실패했습니다.');
    }
  }
);

// 로그아웃 액션
export const logout = createAsyncThunk('auth/logout', async () => {
  cognitoLogout();
  return null;
});

// 인증 상태 확인
export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const user = await getCurrentUser();
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  return user;
});

const initialState = {
  user: JSON.parse(localStorage.getItem('user')) || null,
  isAuthenticated: !!localStorage.getItem('idToken'),
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 로그인
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // 로그아웃
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
      })
      // 인증 확인
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
