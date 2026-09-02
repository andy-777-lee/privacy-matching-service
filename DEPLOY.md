# 🚀 배포 가이드

## Step 1: Vercel 배포 (프론트엔드)

### GitHub 업로드

```bash
# 1. GitHub에서 새 저장소 생성
# - 저장소 이름: privacy-matching-service
# - Public 또는 Private 선택
# - README, .gitignore, license 추가 안 함 (이미 있음)

# 2. 로컬 코드를 GitHub에 푸시
cd /home/user/matching-service
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/privacy-matching-service.git
git push -u origin main
```

### Vercel 연동

1. **https://vercel.com** 접속
2. **GitHub 계정으로 로그인**
3. **"Add New Project"** 클릭
4. **"Import Git Repository"** 선택
5. **privacy-matching-service** 저장소 선택
6. **"Deploy"** 클릭!

**완료!** 
- URL 생성됨: `https://privacy-matching-service.vercel.app` (또는 유사)
- 자동 HTTPS 적용
- Git push 시 자동 재배포

---

## Step 2: Firebase 연동 (백엔드)

### Firebase 프로젝트 생성

1. **https://console.firebase.google.com** 접속
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름: **privacy-matching**
4. Google Analytics: **사용 안 함** (선택)
5. **프로젝트 만들기**

### Firebase 설정

1. 프로젝트 개요 → **웹 앱 추가** (</> 아이콘)
2. 앱 닉네임: **Privacy Matching Web**
3. Firebase Hosting: **체크 안 함**
4. **앱 등록**
5. **Firebase SDK 구성** 코드 복사 (다음 단계에서 사용)

### Firestore Database 활성화

1. 왼쪽 메뉴 → **Firestore Database**
2. **데이터베이스 만들기**
3. 위치: **asia-northeast3 (서울)** 선택
4. 보안 규칙: **테스트 모드로 시작** (나중에 변경)
5. **사용 설정**

---

## 다음 단계

Firebase SDK를 프로젝트에 추가하고 localStorage를 Firebase로 마이그레이션합니다.

자세한 내용은 다음 파일 참조:
- `firebase-setup.md` - Firebase 설정 상세 가이드
- `firebase-migration.md` - localStorage → Firebase 마이그레이션 가이드

---

## 📱 휴대폰 인증 로그인 + SMS 알림 설정

로그인은 **휴대폰 번호 + SMS 인증번호** 방식이며, 매칭 알림도 SMS로 발송됩니다.
동기 처리(인증번호 발송/확인, 알림 발송)는 **Vercel 서버리스 함수**(`/api`)가 담당하므로
Firebase는 무료(Spark) 플랜을 유지할 수 있습니다.

### 1. SMS 발송사(Solapi) 준비

1. https://solapi.com 가입 (개인 가능)
2. **발신번호 등록** (본인 휴대폰 번호로 인증 등록)
3. **API Key / API Secret** 발급
4. 잔액 충전 (SMS 건당 약 10~20원)

### 2. Firebase 서비스 계정 키

- Firebase Console → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성** → JSON 다운로드
- (GitHub Actions에 쓰던 `FIREBASE_SERVICE_ACCOUNT` 시크릿과 동일한 값)

### 3. Vercel 환경 변수 등록

Vercel 프로젝트 → Settings → Environment Variables 에 추가:

| 변수명 | 값 |
|--------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 JSON 전체 (한 줄 문자열) |
| `SOLAPI_API_KEY` | Solapi API Key |
| `SOLAPI_API_SECRET` | Solapi API Secret |
| `SOLAPI_SENDER` | 등록한 발신번호 (예: `01012345678`) |
| `SITE_URL` | 배포된 사이트 주소 (예: `https://...vercel.app`) |

> ⚠️ 이 값들은 **절대 코드/깃에 커밋하지 마세요.** Vercel 환경 변수로만 관리합니다.

### 4. 동작 흐름

```
[로그인/가입]  휴대폰 번호 입력 → /api/send-otp (SMS 발송)
              → 인증번호 입력 → /api/verify-otp (Firebase 커스텀 토큰 발급) → 로그인
[알림]        프로필 요청/수락/거절/매칭완료 시 → /api/notify → 상대방에게 SMS
```
