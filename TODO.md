# Shirube Project TODO List

## Phase 1: 초기 설정 (Project Initialization)
- [x] Next.js (App Router, TypeScript) 프로젝트 생성
- [x] Tailwind CSS 및 shadcn-ui 초기화
- [x] 데이터베이스 설정 (SQLite + ORM)
- [x] 기본 폴더 및 라우팅 구조 세팅

## Phase 2: 데이터베이스 스키마 및 모델링 (Database Schema)
- [x] `staging_words` 테이블 생성 (단어, 빈도수, 품사, 출처 등)
- [x] `dictionary_entries` 테이블 생성 (완성된 단어, 뜻풀이, 요미가나 등)

## Phase 3: 관리자 페이지 핵심 UI/UX (Admin Dashboard)
- [x] Split View 레이아웃 구현 (좌측 폼/목록, 우측 Naver 사전 iframe)
- [x] `staging_words` 데이터 표시용 Data Table 구성
- [x] 키보드 단축키 지원 (Ctrl+Enter 저장/이동, 화살표 포커스)
- [x] `dictionary_entries` 내 사전 관리 기능 (CRUD 화면)

## Phase 4: 내보내기 기능 (Export Logic)
- [x] Yomitan Export (index.json, term_bank_1.json 맵핑 및 압축)
- [x] Kindle Export (HTML/OPF 템플릿 기반 및 mobi 컴파일)

## Phase 5: 추가 기능
- [x] 대기열 데이터 내보내기 기능(CSV/JSON)
- [x] 대기열 데이터 초기화 기능
- [x] 대기열 데이터 불러오기 기능(CSV/JSON)
- [ ] JAKO 2018사전 마이그레이션
- [x] 대기열 데이터에 JPDB Frequency 빈도수 자동으로 채우기 기능
- [x] 대기열 데이터 업데이트 버튼(표제어, 요미가나, 뜻, 품사 등)
- [x] 대기열 데이터(단어) 삭제 버튼
- [x] 대기열 데이터 사전에 등록 오류 해결
- [x] 대기열 데이터 일괄 사전에 등록 기능
- [x] 사전 선택 기능(대기열에서 사전에 등록할 때 사전을 선택할 수 있도록)
- [x] 사전이 여러 개로 설계가 변경됨에 따른 대기열 단어 목록 조회, 내보내기, 불러오기, 대기열 초기화 기능 수정 및 DB 구조 확인 및 변경
- [x] 사전이 여러 개로 설계가 변경됨에 따른 별도 사전 관리 화면 개발 필요(Yomitan, Kindle로 만들어질 사전 등록 및 수정, 삭제 기능.)
    - Yomitan인 경우 {"title": "사전이름", "revision": "수정본", "sequenced": true, "format": 3, "author": "제작자", "url": "", "description": "사전 설명"} 정보를 폼(Form) 형태로 관리 필요.
    - Kindle인 경우 어떤 정보를 관리해야 할지 고민 필요.