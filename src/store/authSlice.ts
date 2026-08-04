/**
 * FILE: src/store/authSlice.ts
 * ROLE: Current logged-in Firebase user + authentication flag.
 * DEPENDS ON: none (self-contained).
 * USED BY: src/screens/LoginScreen.tsx:5 (setUser);
 *          src/screens/DashboardScreen.tsx:7 (logout);
 *          src/App.tsx:28 (reads state.auth.isAuthenticated)
 * NOTE: `user` is never read by any useSelector — only isAuthenticated is
 *       consumed, and only by App.tsx. Auth state is effectively a sync-engine
 *       switch. Persisted via whitelist 'auth'.
 */
import { createSlice } from '@reduxjs/toolkit';
export const authSlice = createSlice({
  // initialState:
  //   - user: null (any)       -> firebase user-ish object; actual payload written is
  //                               { id: res.user.uid, username } (NOT the raw firebase user)
  //   - isAuthenticated: false -> !!payload derived in setUser; drives App sync engine
  name: 'auth', initialState: { user: null as any, isAuthenticated: false },
  reducers: {
    /**
     * WHAT: Sets `user` = payload and flips isAuthenticated to !!payload.
     * CALLED BY: LoginScreen.tsx:17 (handleLogin, after loginUser() succeeds;
     *            then navigation.replace('Dashboard') at :18).
     * AFFECTS: App.tsx:28 `state.auth.isAuthenticated` — the ONLY gate that starts
     *          the background sync engine (App.tsx:31-56: initial sync, 30-min
     *          interval, foreground/background AppState sync). No screen
     *          re-renders from auth state; Login/Dashboard navigate imperatively.
     */
    setUser: (state, action) => { state.user = action.payload; state.isAuthenticated = !!action.payload; },
    /**
     * WHAT: user=null, isAuthenticated=false.
     * CALLED BY: DashboardScreen.tsx:80 (logout button; awaits logoutUser() then
     *            navigation.replace('Login')).
     * AFFECTS: App.tsx:32-56 — effect cleanup clears interval + AppState listener,
     *          stopping all automatic sync. (Note: syncSlice status is NOT reset.)
     */
    logout: (state) => { state.user = null; state.isAuthenticated = false; }
  }
});
export const { setUser, logout } = authSlice.actions;
export default authSlice.reducer;