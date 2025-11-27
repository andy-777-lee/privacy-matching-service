# Firebase Admin SDK를 사용한 비밀번호 재설정 가이드

## 준비 사항

### 1. Firebase 서비스 계정 키 다운로드

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. ⚙️ (설정) > **Project settings** 클릭
4. **Service accounts** 탭 선택
5. **Generate new private key** 버튼 클릭
6. 다운로드된 JSON 파일을 `serviceAccountKey.json`으로 저장
7. 이 파일을 `/home/user/matching-service/` 디렉토리에 복사

### 2. 패키지 설치

```bash
cd /home/user/matching-service
npm install
```

## 비밀번호 재설정 방법

### 방법 A: 서비스 계정 키 파일 사용

1. `reset-password.js` 파일 수정:
   - 13-16번째 줄의 주석 해제
   - 19-21번째 줄 주석 처리

2. 새 비밀번호 설정 (48번째 줄):
   ```javascript
   const NEW_PASSWORD = '123400'; // 원하는 비밀번호로 변경
   ```
   
   **중요**: 4자리 숫자를 입력했다면 뒤에 "00"을 붙여야 합니다.
   - 사용자가 `1234` 입력 → `123400`으로 설정
   - 사용자가 `5678` 입력 → `567800`으로 설정

3. 스크립트 실행:
   ```bash
   node reset-password.js
   ```

### 방법 B: 환경 변수 사용 (Google Cloud 환경)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
node reset-password.js
```

## 사용 예시

```bash
$ node reset-password.js

사용자 NuEbSYrfRaR78GgUJEsmUEFmsEf2의 비밀번호를 변경합니다...
✅ 비밀번호가 성공적으로 변경되었습니다!
새 비밀번호: 123400

사용자 정보:
- UID: NuEbSYrfRaR78GgUJEsmUEFmsEf2
- Email: positiver9930@matching-service.com
- 생성일: 2025. 11. 26. 오후 1:00:00
- 마지막 로그인: 2025. 11. 27. 오전 8:15:00

완료!
```

## 주의사항

⚠️ **서비스 계정 키 파일 보안**
- `serviceAccountKey.json` 파일은 절대 Git에 커밋하지 마세요
- `.gitignore`에 추가되어 있는지 확인하세요
- 이 파일은 Firebase 프로젝트에 대한 전체 관리자 권한을 가지고 있습니다

## 문제 해결

### "Cannot find module 'firebase-admin'"
```bash
npm install firebase-admin
```

### "Credential implementation provided to initializeApp() via the 'credential' property failed to fetch a valid Google OAuth2 access token"
- 서비스 계정 키 파일 경로가 올바른지 확인
- 파일 권한 확인 (읽기 가능해야 함)

### "User not found"
- UID가 정확한지 확인
- Firebase Console에서 해당 사용자가 존재하는지 확인
