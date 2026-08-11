# App Access (Login) — for Play review

## Does the app require login?

**Yes.** The App uses a username + password account (Firebase Authentication). Google
requires reviewers to be able to access the app, so you must fill **App content → App
access** with test credentials.

## What to fill in

In the Play Console:

1. **App content → App access**
2. Select **"All or some functionality requires sign-in"**
3. In the test credentials box, describe:
   - The sign-up flow (anyone can create an account from the login screen), **and/or**
   - Provide a ready-made demo account.

## Recommended test account

Create a demo account from the app's login screen (Sign up) with any username/password and
paste the credentials here:

```
Username:  [FILL IN — e.g. playreviewer]
Password:  [FILL IN]
```

## Notes for the reviewer

- After signing in, a **student profile must be created** (Student list → Add student) to
  fully explore the app (reading, bookmarks, notes, voice notes, drawings all attach to a
  student).
- All features work on a fresh account — no special permissions beyond Microphone (for
  voice notes) are required.
- Voice notes require granting the Microphone permission when prompted.
