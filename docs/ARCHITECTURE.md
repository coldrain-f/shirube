# Shirube — 아키텍처 문서

커스텀 일본어 사전 관리 시스템의 전체 구조와 설계를 기술한다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [서버 액션 (Server Actions)](#5-서버-액션)
6. [API 라우트](#6-api-라우트)
7. [페이지 구성](#7-페이지-구성)
8. [데이터 흐름](#8-데이터-흐름)
9. [내보내기 파이프라인](#9-내보내기-파이프라인)
10. [UI 컴포넌트](#10-ui-컴포넌트)
11. [환경 변수](#11-환경-변수)

---

## 1. 프로젝트 개요

Shirube는 일본어 단어 데이터를 수집·검수하여 **Yomitan** 및 **Kindle** 커스텀 사전 포맷으로 내보낼 수 있는 웹 기반 백오피스다.

**핵심 설계 원칙:**
- 기계 번역 대신 네이버 사전을 iframe으로 띄워 사용자가 직접 뜻을 정리하는 **Human-in-the-loop** 파이프라인
- 활용형(Conjugation) 데이터는 DB에 저장하지 않고, 내보내기 시점에 품사(POS) 태그로부터 자동 생성
- 빈도수(`frequency`) 기반 우선순위 정렬로 고빈도 단어부터 처리
- 키보드 단축키 중심의 빠른 검수 UX (Ctrl+Enter 저장, 화살표 탐색)

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.x |
| UI | React | 19.x |
| 언어 | TypeScript | 5.x |
| 스타일 | Tailwind CSS | 4.x |
| UI 컴포넌트 | shadcn-ui (Base UI 기반) | - |
| 리치 텍스트 에디터 | TipTap | 3.x |
| 데이터베이스 | SQLite | - |
| ORM | Prisma | 5.x |
| SQLite 드라이버 | better-sqlite3 | 12.x |
| 알림(Toast) | Sonner | 2.x |
| 아이콘 | lucide-react | 1.x |
| Yomitan 빌더 | yomichan-dict-builder | 2.x |
| HTML 파서 | htmlparser2 | 12.x |
| ZIP 생성 | JSZip | 3.x |

---

## 3. 디렉토리 구조

```
shirube/
├── docs/                          # 프로젝트 문서
│   ├── ARCHITECTURE.md            # 이 문서
│   ├── PLAN.md                    # 프로젝트 명세서
│   └── TODO.md                    # 할 일 목록
│
├── prisma/
│   ├── schema.prisma              # DB 스키마 정의
│   ├── dev.db                     # SQLite 데이터베이스 (gitignore)
│   ├── yomitan_pos_reference.db   # 품사 참조 데이터 원본 (read-only)
│   └── migrations/                # Prisma 마이그레이션 기록
│
├── resources/
│   └── JPDB.txt                   # JPDB 빈도수 데이터 (term → frequency)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 루트 레이아웃 (헤더 네비게이션 포함)
│   │   ├── page.tsx               # 홈 (/ → /staging 리다이렉트)
│   │   │
│   │   ├── staging/               # 대기열 화면
│   │   │   ├── page.tsx           # 서버 컴포넌트 (데이터 페칭)
│   │   │   └── client-view.tsx    # 클라이언트 컴포넌트 (Split View UI)
│   │   │
│   │   ├── dictionary/            # 내 사전 화면
│   │   │   ├── page.tsx
│   │   │   └── client-view.tsx
│   │   │
│   │   ├── dictionaries/          # 사전 관리 화면
│   │   │   ├── page.tsx
│   │   │   └── client-view.tsx
│   │   │
│   │   ├── actions/               # Next.js Server Actions
│   │   │   ├── staging.ts         # 대기열 관련 액션
│   │   │   └── dictionary.ts      # 사전/항목 관련 액션
│   │   │
│   │   └── api/
│   │       └── export/
│   │           ├── yomitan/
│   │           │   └── route.ts   # GET /api/export/yomitan
│   │           └── kindle/
│   │               └── route.ts   # GET /api/export/kindle
│   │
│   ├── components/
│   │   ├── nav-links.tsx          # 네비게이션 (usePathname으로 Active 처리)
│   │   └── ui/                    # shadcn-ui 컴포넌트 모음
│   │       ├── rich-text-editor.tsx  # TipTap 기반 HTML 에디터
│   │       ├── toggle.tsx         # Base UI Toggle 래퍼
│   │       ├── resizable.tsx      # 분할 패널
│   │       ├── alert-dialog.tsx
│   │       ├── dialog.tsx
│   │       ├── select.tsx
│   │       ├── table.tsx
│   │       └── ...
│   │
│   └── lib/
│       ├── prisma.ts              # Prisma 싱글턴 (dev 환경 중복 인스턴스 방지)
│       └── utils.ts               # cn() 유틸 (clsx + tailwind-merge)
│
├── AGENTS.md / CLAUDE.md          # AI 어시스턴트용 지시 파일
├── next.config.ts                 # Next.js 설정 (body size limit: 100MB)
├── tailwind.config.ts
├── tsconfig.json
└── components.json                # shadcn-ui 설정
```

---

## 4. 데이터베이스 스키마

데이터베이스: SQLite (`prisma/dev.db`)
ORM: Prisma 5.x
스키마 파일: `prisma/schema.prisma`

---

### 테이블 1: `staging_words` — 수집 대기열

단어 데이터를 수집하고 검수 전까지 임시 보관하는 큐 테이블.
내 사전에 등록되면 `is_processed = true`로 마킹되고 대기열 화면에서 사라진다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Int | PK, auto increment | 식별자 |
| `term` | String | NOT NULL | 일본어 단어 기본형 (예: `書く`) |
| `reading` | String? | nullable | 후리가나 읽는 법 (예: `かく`) |
| `meaning` | String? | nullable | 뜻풀이 (HTML 허용). 대기열 단계에서는 비어있을 수 있음 |
| `frequency` | Int | NOT NULL | 빈도수 순위. 낮을수록 고빈도. `-1`은 빈도 데이터 없음을 의미 |
| `part_of_speech` | String? | nullable | Yomitan 활용 규칙 태그 (예: `v1`, `v5`, `vk`, `vs`, `adj-i`, 빈 문자열). 공백으로 구분한 복수 지정 가능 (예: `v5 vs`) |
| `source` | String | NOT NULL | 데이터 출처 (예: `jpdb`, `manual`, `import`) |
| `is_processed` | Boolean | default: false | 내 사전 등록 완료 여부. true이면 대기열에서 조회되지 않음 |

**정렬 기준:** frequency ASC (단, -1은 맨 뒤)
**페이지 크기:** 100건

---

### 테이블 2: `dictionaries` — 사전 메타데이터

여러 개의 사전 컨테이너를 관리하는 테이블.
각 사전은 Yomitan/Kindle 내보내기 시 별도 파일로 생성된다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Int | PK, auto increment | 식별자 |
| `name` | String | UNIQUE, NOT NULL | 내부 식별 이름 (예: `내사전-2026`) |
| `title` | String? | nullable | Yomitan/Kindle에 표시될 사전 제목 |
| `revision` | String? | nullable | 버전 식별자 (예: `2026-03-28`). Yomitan `index.json`에 포함 |
| `sequenced` | Boolean? | default: true | Yomitan `sequenced` 플래그. true이면 단어에 시퀀스 번호가 부여되어 정렬에 영향 |
| `format` | Int? | default: 3 | Yomitan 사전 포맷 버전. 현재 표준은 3 |
| `author` | String? | nullable | 사전 제작자 이름 |
| `url` | String? | nullable | 출처 URL (Yomitan `index.json`의 `url` 필드) |
| `description` | String? | nullable | 사전 설명 (Yomitan `index.json`의 `description` 필드) |
| `created_at` | DateTime | default: now() | 생성 시각 |
| `updated_at` | DateTime | auto update | 마지막 수정 시각 |

**관계:** `dictionaries` 1 ↔ N `dictionary_entries`

---

### 테이블 3: `dictionary_entries` — 완성된 사전 항목

검수가 완료된 단어 데이터. Yomitan/Kindle 내보내기의 실제 대상.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Int | PK, auto increment | 식별자 |
| `term` | String | NOT NULL | 일본어 단어 기본형 |
| `reading` | String | NOT NULL | 후리가나. `term`과 함께 복합 인덱스 구성 |
| `meaning` | String | NOT NULL | 뜻풀이 (HTML 허용). TipTap 에디터로 입력된 HTML 그대로 저장 |
| `part_of_speech` | String | NOT NULL | Yomitan 활용 규칙 (예: `v1`, `v5`, `adj-i`, 빈 문자열). 내보내기 시 활용형 생성에 사용 |
| `pitch_accent` | String? | nullable | 고저 악센트 정보 (미구현, 향후 사용) |
| `audio_file` | String? | nullable | TTS 오디오 파일 경로 또는 식별자. Yomitan 오디오 스키마에 포함. Kindle 내보내기 시 무시 |
| `tags` | String? | nullable | 분류 태그. 공백 구분 문자열로 저장. Yomitan `termTags`에 포함 |
| `dictionary_id` | Int? | FK → dictionaries(id), nullable | 소속 사전. null이면 미분류. 사전 삭제 시 SetNull |
| `created_at` | DateTime | default: now() | 생성 시각 |
| `updated_at` | DateTime | auto update | 마지막 수정 시각 |

**인덱스:** `@@index([term, reading])` — 동음이의어 검색 성능용
**주의:** term+reading 조합이 고유하지 않으며, 동일 단어를 복수 의미로 등록할 수 있다.
(`addWordToDictionary`의 upsert는 term+reading 기준으로 중복 방지)

---

### 테이블 4: `yomitan_pos_reference` — 품사 참조 데이터

Jitendex-Yomitan 사전에서 추출한 품사 참조 테이블.
대기열 단어에 품사를 자동으로 채울 때 lookup 소스로 사용한다.
총 약 90만 건. `prisma/yomitan_pos_reference.db`에서 `dev.db`로 복사 후 사용.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | Int | PK, auto increment | 식별자 |
| `term` | String | NOT NULL | 일본어 단어 |
| `reading` | String | NOT NULL | 후리가나 |
| `pos_tags` | String? | nullable | 세분화된 품사 태그 원본 (예: `v5k`, `adj-na`). 표시/디버그용 |
| `yomitan_rules` | String? | nullable | 실제 Yomitan 활용 규칙 (예: `v5`, `v1 vs`). 공백 구분 복수 가능. 이 값이 `staging_words.part_of_speech`에 적용됨 |
| `source_dict` | String | NOT NULL | 출처 사전 이름 (예: `Jitendex`). 복수 출처 구분용 |

**인덱스:**
- `@@unique([term, reading])` — 중복 방지 및 빠른 exact match
- `@@index([term])` — term 단독 검색(reading 없을 때 fallback)용

**품사 자동 채우기 로직:**
1. term+reading 일치 항목 우선 적용
2. 없으면 term 단독으로 첫 번째 매칭 항목 적용
3. 둘 다 없으면 해당 단어는 `notFound` 카운트에 포함

---

## 5. 서버 액션

`'use server'` 지시어로 선언. 클라이언트 컴포넌트에서 직접 호출 가능.
모든 액션은 변경 후 `revalidatePath()`로 캐시를 무효화한다.

### `src/app/actions/staging.ts`

| 함수 | 설명 |
|------|------|
| `getStagingWords(query, page)` | 미처리 단어 페이지네이션 조회 (100건). 빈도수 오름차순 정렬, -1은 맨 뒤 |
| `markWordProcessed(id)` | `is_processed = true` 처리 |
| `deleteStagingWord(id)` | 단어 삭제 |
| `updateStagingWord(id, data)` | term/reading/meaning/part_of_speech 수정 |
| `addWordToDictionary(data)` | `dictionary_entries`에 upsert (term+reading 기준). `staging_id`가 있으면 해당 대기열 항목을 processed 처리 |
| `clearAllStagingWords()` | 미처리 단어 전체 삭제 |
| `getAllStagingWordsForExport()` | CSV/JSON 내보내기용 전체 조회 |
| `importStagingWords(words, skipDuplicates)` | CSV/JSON에서 파싱한 단어 배열을 일괄 삽입. skipDuplicates=true이면 term 중복 건너뜀 |
| `getJPDBUpdatesNeeded()` | `resources/JPDB.txt`와 현재 빈도수를 비교하여 변경이 필요한 항목 목록 반환 |
| `bulkUpdateFrequencies(updates)` | 빈도수 일괄 업데이트 (Prisma transaction, 500건 청크) |
| `getPosUpdatesFromReference()` | `yomitan_pos_reference`에서 모든 대기열 단어의 품사를 조회하여 업데이트 목록 반환 |
| `bulkApplyPosUpdates(updates)` | 품사 일괄 적용 (Prisma transaction) |

### `src/app/actions/dictionary.ts`

| 함수 | 설명 |
|------|------|
| `getDictionaries()` | 전체 사전 목록 조회 (항목 수 포함) |
| `createDictionary(data)` | 새 사전 생성 |
| `updateDictionary(id, data)` | 사전 메타데이터 수정 |
| `deleteDictionary(id)` | 사전 삭제 (항목은 dictionary_id = null으로 변경) |
| `getDictionaryEntries(dictionaryId?)` | 항목 조회. dictionaryId 없으면 전체 반환 |
| `deleteDictionaryEntry(id)` | 항목 삭제 |
| `updateDictionaryEntry(id, data)` | 항목 수정 |

---

## 6. API 라우트

### `GET /api/export/yomitan?dictionaryId={id}`

Yomitan 포맷 사전 ZIP 파일을 생성하여 다운로드 응답으로 반환.

**처리 흐름:**
1. `dictionaryId`로 사전 메타데이터 및 항목 조회
2. `yomichan-dict-builder`로 Dictionary/DictionaryIndex 초기화
3. 각 항목에 대해:
   - `htmlparser2`로 meaning HTML 파싱
   - DOM 노드 → Yomitan structured-content 변환
     - `<strong>/<b>` → `{tag:'span', style:{fontWeight:'bold'}}`
     - `<em>/<i>` → `{tag:'span', style:{fontStyle:'italic'}}`
     - `<u>` → `{tag:'span', style:{textDecorationLine:'underline'}}`
     - `<p>/<div>` → `{tag:'div'}`
   - `posToYomitanRules()`로 품사 정규화 (레거시 v5k/v5r 등 → v5)
   - TermEntry 생성 (term, reading, definitionTags, deinflectors, sequenceNumber)
4. 임시 디렉토리에 ZIP 출력 후 반환, 임시 파일 삭제

**응답:** `application/zip`, `Content-Disposition: attachment; filename="[name]_yomitan.zip"`

---

### `GET /api/export/kindle?dictionaryId={id}`

Kindle 사전 소스(HTML+OPF) ZIP 파일을 생성하여 다운로드 응답으로 반환.
사용자가 로컬에서 `kindlegen` 또는 `mobigen`으로 `.mobi`로 컴파일해야 한다.

**처리 흐름:**
1. 항목 조회 (dictionaryId 없으면 전체)
2. OEB-1 규격 HTML 생성
   - 네임스페이스: `xmlns:idx`, `xmlns:mbp`, `xmlns:svg`, `xmlns:math`
   - 각 항목: `<idx:entry>` → `<idx:orth>` + reading/POS/meaning
3. OPF 메타데이터 파일 생성
   - `DictionaryInLanguage: ja`, `DictionaryOutLanguage: ko`
   - `DefaultLookupIndex: "dictionary"`
4. JSZip으로 `kindle_dict.html` + `shirube_kindle.opf` + `README.txt` 묶음

**응답:** `application/zip`, `Content-Disposition: attachment; filename="shirube_[name]_kindle.zip"`

**현재 한계:** 활용형 `<idx:iform>` 태그가 미구현 상태. `docs/TODO.md` Phase 6 참고.

---

## 7. 페이지 구성

### `/staging` — 대기열

Split View 레이아웃 (ResizablePanelGroup):

| 패널 | 내용 |
|------|------|
| 좌측 (30%) | 단어 목록 + 등록 폼 |
| 중앙 (40%) | 네이버 사전 iframe (`ja.dict.naver.com`) |

**단어 목록 툴바 기능:**
- CSV/JSON 내보내기
- CSV/JSON 불러오기
- 품사 자동 채우기 (`yomitan_pos_reference` 기반)
- JPDB 빈도수 자동 채우기
- 전체 삭제

**등록 폼 필드:** term, reading, meaning (RichTextEditor), POS 토글, 사전 선택
**키보드 단축키:** `Ctrl+Enter` 저장, `↑↓` 목록 이동

---

### `/dictionary` — 내 사전

`dictionary_entries` 전체 목록 테이블 뷰.

- 검색 (term/reading/meaning)
- 사전별 필터
- 항목 수정 다이얼로그 (term, reading, meaning, POS, pitch_accent, tags)
- 항목 삭제
- Yomitan / Kindle 내보내기 버튼

---

### `/dictionaries` — 사전 관리

`dictionaries` 테이블 CRUD.

- 사전 생성 (name, title, revision, author, url, description, sequenced, format)
- 사전 수정
- 사전 삭제 (연결된 항목은 미분류 상태로 전환)

---

## 8. 데이터 흐름

```
외부 데이터 소스
(JPDB.txt, CSV, JSON)
        │
        ▼
  importStagingWords()
        │
        ▼
  staging_words 테이블
  [is_processed = false]
        │
        ├── 품사 자동 채우기 ◄── yomitan_pos_reference 테이블
        ├── 빈도수 자동 채우기 ◄── resources/JPDB.txt
        │
        ▼
  대기열 화면 (Split View)
  사용자 검수: reading, meaning, POS 입력
        │
        ▼
  addWordToDictionary()
  [upsert on term+reading]
        │
        ▼
  dictionary_entries 테이블
  [is_processed = true → 대기열에서 사라짐]
        │
        ├── /api/export/yomitan ──► .zip (Yomitan 설치)
        └── /api/export/kindle ───► .zip → kindlegen → .mobi (Kindle)
```

---

## 9. 내보내기 파이프라인

### 9.1 Yomitan 품사 정규화

Yomitan deinflection 엔진이 인식하는 규칙: `v1`, `v5`, `vk`, `vs`, `adj-i`

`posToYomitanRules()` 함수가 레거시 세분화 태그를 정규화한다:

| 저장값 | Yomitan rules |
|--------|--------------|
| `v1` | `v1` |
| `v5` (또는 `v5k`, `v5r` 등 레거시) | `v5` |
| `vk` | `vk` |
| `vs` | `vs` |
| `adj-i` | `adj-i` |
| 그 외 (빈 문자열, `adj-na` 등) | `""` (활용 없음) |

Kindle의 경우 `v5` 활용형 생성 시 표제어의 마지막 가나로 세부 어미를 판별한다 (미구현, `docs/TODO.md` Phase 6 참고).

### 9.2 HTML → Yomitan Structured-Content 변환

TipTap 에디터에서 생성된 HTML을 Yomitan이 렌더링할 수 있는 structured-content 객체 트리로 변환.

```
HTML (meaning 컬럼)
  → htmlparser2 파싱
  → domhandler DOM 트리
  → domToStructuredContent() 재귀 변환
  → Yomitan structured-content 배열
```

---

## 10. UI 컴포넌트

### PosToggleGroup

품사(Yomitan rules)를 멀티 선택하는 토글 버튼 그룹.
`staging/client-view.tsx`와 `dictionary/client-view.tsx` 양쪽에 로컬 정의.

- 선택값: 공백으로 join된 문자열 (예: `"v5 vs"`)
- 토글 버튼: `v1`, `v5`, `vk`, `vs`, `adj-i`
- 아무것도 선택하지 않으면 빈 문자열 = 활용 없음 (명사, 부사, 조사 등)

### RichTextEditor

TipTap 기반 인라인 HTML 에디터. `src/components/ui/rich-text-editor.tsx`.

- 지원 포맷: Bold, Italic, Underline, Paragraph
- 출력: HTML 문자열 (`<p>`, `<strong>`, `<em>`, `<u>` 등)
- 사용 위치: 대기열 등록 폼, 대기열 수정 다이얼로그, 내 사전 수정 다이얼로그

### NavLinks

`src/components/nav-links.tsx`. 클라이언트 컴포넌트.

- `usePathname()`으로 현재 경로 감지
- 현재 페이지와 일치하는 메뉴 항목을 `font-medium text-foreground`로 강조

---

## 11. 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `file:./prisma/dev.db` | Prisma SQLite 파일 경로 |

**Prisma 싱글턴 패턴** (`src/lib/prisma.ts`):
Next.js 개발 서버에서 Hot Reload 시 PrismaClient 인스턴스가 중복 생성되는 것을 방지하기 위해 `globalThis`에 캐싱.

```ts
// 개발 환경: globalThis에 인스턴스 캐싱
// 프로덕션 환경: 매번 새 인스턴스 생성
const prisma = globalThis.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
```

**next.config.ts 설정:**
- `serverActions.bodySizeLimit`: `100mb` — 대용량 CSV/JSON 임포트를 위한 요청 크기 제한
