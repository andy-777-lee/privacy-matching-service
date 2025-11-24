# Privacy Matching Service

프라이버시를 보장하는 매칭 서비스

Made by 이채혁

## 🎯 주요 기능

- 12개 필수 항목 프로필 등록
- 드래그 앤 드롭 선호 조건 설정
- 가중치 기반 매칭 알고리즘
- 프라이버시 보호 (이름/사진 블러)
- 관리자 승인 시스템
- 미매칭 분석

## 🚀 배포 방법

### Vercel (추천)

1. GitHub에 코드 업로드
2. https://vercel.com 접속
3. GitHub 계정으로 로그인
4. "Import Project" 선택
5. 이 저장소 선택
6. "Deploy" 클릭!

### 로컬 실행

```bash
python3 -m http.server 8001
```

http://localhost:8001 접속

## ⚠️ 현재 상태

**프로토타입 버전**
- localStorage 사용 (브라우저 저장소)
- 백엔드 서버 없음
- 실제 서비스를 위해서는 백엔드 필요

## 📝 관리자 정보

- 관리자 페이지: `#admin`
- 비밀번호: `admin2024`

## 🔧 기술 스택

- HTML5, CSS3, Vanilla JavaScript
- Browser localStorage
- Google Fonts (Inter)

