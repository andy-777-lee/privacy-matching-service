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
