📖 프로젝트 명세서: 커스텀 일본어 사전 관리 시스템 (Yomitan & Kindle 연동)
1. 프로젝트 개요
목표: 개인화된 일본어 단어 데이터를 관리하고, 이를 Yomitan 및 Kindle 커스텀 사전 포맷으로 내보낼 수 있는 웹 기반 백오피스 구축.

주요 특징: * 활용형(Conjugation)을 배제하고 기본형(원형) 위주로 데이터를 저장.

기계 번역 대신, 네이버 사전 원본을 띄워놓고 사용자가 직접 정확한 뜻과 뉘앙스를 정리하는 반자동화(Human-in-the-loop) 파이프라인 채택.

범용적인 수집용 대기열(Staging) 테이블을 두어 빈도수 데이터 등을 편입 및 가공.

빠른 검수 및 등록을 위한 키보드 단축키 중심의 UX 제공.

2. 기술 스택
프론트엔드 & API: Next.js (App Router), React, TypeScript

UI 컴포넌트: shadcn-ui (Data Table, Form, Split View 구성 등)

데이터베이스: SQLite

ORM: Prisma 또는 Drizzle ORM

데이터 전처리 (보조): Python (JMdict 품사 매핑 등)

3. 데이터베이스 스키마 설계 (SQLite)
Table 1: staging_words (데이터 수집 및 작업 대기열)

id (PK, Int)

term (String): 단어 기본형

frequency (Int): 빈도수 (우선순위 정렬용)

part_of_speech (String, Nullable): JMdict 등으로 1차 자동 매핑된 품사

source (String): 데이터 출처 (예: 'jpdb', 'manual')

is_processed (Boolean): 내 사전 등록 완료 여부 (Default: false)

Table 2: dictionary_entries (완성된 내 사전 / 내보내기 대상)

id (PK, Int)

term (String): 단어 기본형

reading (String): 요미가나 (읽는 법)

[중요 제약조건]: 동음이의어 처리를 위해 term과 reading을 묶어 **복합 고유키(Composite Unique Key)**로 설정.

meaning (Text): 수동으로 작성/검수한 정확한 뜻풀이 (HTML 태그 허용)

part_of_speech (String): Yomitan/Kindle 활용형 처리(De-inflection)용 필수 품사 태그 (예: v1, v5k, n 등)

pitch_accent (String, Nullable): 고저 악센트 정보

audio_file (String, Nullable): Yomitan/Anki 연동용 TTS 오디오 파일 경로 또는 식별자 (Kindle 내보내기 시에는 무시)

tags (String, Nullable): 분류 태그

created_at / updated_at (DateTime)

4. 핵심 UI/UX 요구사항 (Admin Dashboard)
Split View 작업 데스크 (Tab 1):

좌측 패널: staging_words 기반 우선순위 Data Table 및 등록 Form.

우측 패널: iframe을 통한 네이버 일본어 사전 원본 렌더링 (https://ja.dict.naver.com/#/search?query=[단어]).

단축키 지원 (필수):

Ctrl(Cmd) + Enter: 폼 작성 완료 및 [저장 후 다음 단어 자동 이동]

방향키 위/아래: 좌측 대기열 리스트 포커스 이동

내 사전 관리 (Tab 2):

dictionary_entries CRUD 화면. (검색, 정렬, 수정, 다중 삭제)

5. 내보내기(Export) 로직 요구사항
Yomitan Export:

백엔드에서 데이터 조회 후 Yomitan 배열 규격(index.json, term_bank_1.json)으로 맵핑.

오디오 파일(audio_file) 데이터가 존재할 경우 Yomitan의 오디오 스키마에 맞게 포함.

jszip 라이브러리로 .zip 압축 후 클라이언트 다운로드.

Kindle Export:

part_of_speech를 참조하여 동사/형용사 활용형 태그(<idx:iform>) 템플릿을 자동으로 덧붙인 HTML/OPF 파일 스트림 생성.

(주의: 킨들은 오디오를 지원하지 않으므로 audio_file 데이터는 HTML 생성 시 제외).

생성된 소스를 로컬 mobigen 또는 Python 스크립트를 통해 최종 .mobi로 컴파일.