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
2. **발신번호 등록** (본인 휴대폰 번호로 인증 등록) — 심사 승인 후에야 발송됩니다
3. **API Key / API Secret** 발급
4. **API Key의 IP 접근 제한을 비워두세요** (아래 참고)
5. 잔액 충전 (SMS 건당 약 10~20원)

> ⚠️ **IP 접근 제한은 반드시 해제해야 합니다.**
> Solapi 콘솔 → 개발/연동 → API Key 관리에서 허용 IP 목록을 비웁니다.
> Vercel 서버리스는 요청마다 출발지 IP가 바뀌므로 허용 목록 방식이 동작하지 않습니다
> (고정 IP는 기업용 플랜 전용). 제한이 걸려 있으면 발송 시 다음 오류가 납니다:
> `Forbidden: 허용되지 않은 IP(x.x.x.x)로 접근하고 있습니다.`
>
> 키는 Vercel 환경 변수에만 Secret으로 저장되고 브라우저로 전송되지 않으므로
> IP 제한이 없어도 노출 경로는 없습니다. 추가 안전장치가 필요하면
> Solapi 콘솔에서 **일일 발송 한도**를 낮게 설정하세요.

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

### 5. 문제 해결

발송이 실패하면 **Vercel 프로젝트 → Logs**(런타임 로그)에서 원인을 확인합니다.
Hobby 플랜은 로그 보관 기간이 짧으니, 로그 화면을 열어둔 채로 다시 시도하세요.

| 증상 | 원인 |
|------|------|
| `Forbidden: 허용되지 않은 IP...` | Solapi API Key의 IP 접근 제한 (위 참고) |
| `Unexpected token ... in JSON` | `FIREBASE_SERVICE_ACCOUNT` 값이 잘렸거나 BOM이 섞임 |
| 발신번호 관련 오류 | 발신번호 심사 미승인 또는 `SOLAPI_SENDER` 오타 |
| 잔액 관련 오류 | Solapi 잔액 부족 (충전식) |
| 오류 없이 알림만 안 옴 | 수신자의 `user_private/{uid}` 문서에 `phone` 필드가 없음 |

> 환경 변수를 추가/수정한 뒤에는 **반드시 재배포**해야 반영됩니다.
> Solapi 콘솔 설정만 바꾼 경우에는 재배포가 필요 없습니다.
