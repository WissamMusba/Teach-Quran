import { createSlice } from '@reduxjs/toolkit';
export const authSlice = createSlice({
  name: 'auth', initialState: { user: null as any, isAuthenticated: false },
  reducers: {
    setUser: (state, action) => { state.user = action.payload; state.isAuthenticated = !!action.payload; },
    logout: (state) => { state.user = null; state.isAuthenticated = false; }
  }
});
export const { setUser, logout } = authSlice.actions;
export default authSlice.reducer;