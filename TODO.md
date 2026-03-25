# Shirube Project TODO List

## Phase 1: 초기 설정 (Project Initialization)
- [x] Next.js (App Router, TypeScript) 프로젝트 생성
- [ ] Tailwind CSS 및 shadcn-ui 초기화
- [ ] 데이터베이스 설정 (SQLite + ORM)
- [ ] 기본 폴더 및 라우팅 구조 세팅

## Phase 2: 데이터베이스 스키마 및 모델링 (Database Schema)
- [ ] `staging_words` 테이블 생성 (단어, 빈도수, 품사, 출처 등)
- [ ] `dictionary_entries` 테이블 생성 (완성된 단어, 뜻풀이, 요미가나 등)

## Phase 3: 관리자 페이지 핵심 UI/UX (Admin Dashboard)
- [ ] Split View 레이아웃 구현 (좌측 폼/목록, 우측 Naver 사전 iframe)
- [ ] `staging_words` 데이터 표시용 Data Table 구성
- [ ] 키보드 단축키 지원 (Ctrl+Enter 저장/이동, 화살표 포커스)
- [ ] `dictionary_entries` 내 사전 관리 기능 (CRUD 화면)

## Phase 4: 내보내기 기능 (Export Logic)
- [ ] Yomitan Export (index.json, term_bank_1.json 맵핑 및 압축)
- [ ] Kindle Export (HTML/OPF 템플릿 기반 및 mobi 컴파일)
