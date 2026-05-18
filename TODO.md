# TODO - Fix Firebase not working

- [ ] Reproduce the exact runtime error (browser console + backend logs during login)
- [x] Guard Firebase Analytics initialization so auth doesn’t crash in dev/local
- [ ] Verify Firebase token flow end-to-end:
  - [ ] Confirm frontend successfully obtains Firebase ID token
  - [ ] Confirm backend `admin.auth().verifyIdToken()` accepts the token
- [ ] If backend fails: validate `backend/serviceAccountKey.json` exists and matches the same Firebase project as frontend (`ocr-project-f7d37`)
- [ ] If token accepted but endpoints still fail: check Authorization header format and middleware wiring
- [ ] Run minimal smoke test:
  - [ ] Call `GET /health`
  - [ ] Login via Firebase and hit a protected endpoint

