# Shirube Project TODO List

## Phase 1: 초기 설정 (Project Initialization)
- [x] Next.js (App Router, TypeScript) 프로젝트 생성
- [x] Tailwind CSS 및 shadcn-ui 초기화
- [x] 데이터베이스 설정 (SQLite + ORM)
- [x] 기본 폴더 및 라우팅 구조 세팅

## Phase 2: 데이터베이스 스키마 및 모델링 (Database Schema)
- [x] `staging_words` 테이블 생성 (단어, 빈도수, 품사, 출처 등)
- [x] `dictionary_entries` 테이블 생성 (완성된 단어, 뜻풀이, 요미가나 등)
- [x] `dictionaries` 테이블 생성 (사전 메타데이터: name, title, revision, author 등)
- [x] `dictionary_entries`에 `dictionary_id` FK 추가 (다중 사전 지원)

## Phase 3: 관리자 페이지 핵심 UI/UX (Admin Dashboard)
- [x] Split View 레이아웃 구현 (좌측 폼/목록, 우측 Naver 사전 iframe)
- [x] `staging_words` 데이터 표시용 Data Table 구성
- [x] 키보드 단축키 지원 (Ctrl+Enter 저장/이동, 화살표 포커스)
- [x] `dictionary_entries` 내 사전 관리 기능 (CRUD 화면)

## Phase 4: 내보내기 기능 (Export Logic)
- [x] Yomitan Export (yomichan-dict-builder 라이브러리 적용, structured-content HTML 변환, 품사별 deinflection rules 정규화)
- [x] Kindle Export (HTML/OPF 템플릿 기반 및 mobi 컴파일)

## Phase 5: 추가 기능
- [x] 대기열 데이터 내보내기 기능(CSV/JSON)
- [x] 대기열 데이터 초기화 기능
- [x] 대기열 데이터 불러오기 기능(CSV/JSON)
- [x] JAKO 2018사전 마이그레이션
- [x] 대기열 데이터에 JPDB Frequency 빈도수 자동으로 채우기 기능
- [x] 대기열 데이터 업데이트 버튼(표제어, 요미가나, 뜻, 품사 등)
- [x] 대기열 데이터(단어) 삭제 버튼
- [x] 대기열 데이터 사전에 등록 오류 해결
- [x] 대기열 데이터 일괄 사전에 등록 기능
- [x] 사전 선택 기능(대기열에서 사전에 등록할 때 사전을 선택할 수 있도록)
- [x] 사전이 여러 개로 설계가 변경됨에 따른 대기열 단어 목록 조회, 내보내기, 불러오기, 대기열 초기화 기능 수정 및 DB 구조 확인 및 변경
- [x] 사전이 여러 개로 설계가 변경됨에 따른 별도 사전 관리 화면 개발 필요(Yomitan, Kindle로 만들어질 사전 등록 및 수정, 삭제 기능.)

---

## Phase 6: Kindle 활용형 내보내기 (우선순위: 높음)

Kindle 사전은 `<idx:iform>` 태그에 활용형을 직접 열거해야 활용형 검색이 가능하다.
현재는 base form만 있어 「書いて」「食べた」 등으로 검색해도 사전이 히트되지 않는다.

### 구현해야 할 것

- [ ] 품사별 활용형 생성 함수 작성 (`src/lib/conjugate.ts`)
  - 각 품사에 대해 아래 활용형을 전부 생성해야 함:

  **v1 (상하1단, 食べる 형)**
  - ます형: 食べます
  - て형: 食べて
  - た형: 食べた
  - ない형: 食べない
  - ば형: 食べれば
  - 명령형: 食べろ / 食べよ
  - 의지형: 食べよう
  - 가능형: 食べられる
  - 수동형: 食べられる
  - 사역형: 食べさせる
  - 사역수동형: 食べさせられる

  **v5k (書く 형)**
  - ます형: 書きます
  - て형: 書いて (음편 -いて)
  - た형: 書いた
  - ない형: 書かない
  - ば형: 書けば
  - 명령형: 書け
  - 의지형: 書こう
  - 가능형: 書ける
  - 수동형: 書かれる
  - 사역형: 書かせる

  **v5s (話す 형)**
  - て형: 話して, た형: 話した, ない형: 話さない, 가능형: 話せる

  **v5t (待つ 형)**
  - て형: 待って (음편 -って), た형: 待った, ない형: 待たない, 가능형: 待てる

  **v5n (死ぬ 형)**
  - て형: 死んで (음편 -んで), た형: 死んだ, ない형: 死なない, 가능형: 死ねる

  **v5m (飲む 형)**
  - て형: 飲んで (음편 -んで), た형: 飲んだ, ない형: 飲まない, 가능형: 飲める

  **v5r (帰る 형)**
  - て형: 帰って (음편 -って), た형: 帰った, ない형: 帰らない, 가능형: 帰れる

  **v5w (歌う 형)**
  - て형: 歌って (음편 -って), た형: 歌った, ない형: 歌わない, 가능형: 歌える

  **v5g (泳ぐ 형)**
  - て형: 泳いで (음편 -いで), た형: 泳いだ, ない형: 泳がない, 가능형: 泳げる

  **v5b (呼ぶ 형)**
  - て형: 呼んで (음편 -んで), た형: 呼んだ, ない형: 呼ばない, 가능형: 呼べる

  **vk (くる 형)**
  - 漢字: 来る / 来ます / 来て / 来た / 来ない / 来れば / 来い / 来よう / 来られる
  - 仮名: くる / きます / きて / きた / こない / くれば / こい / こよう

  **vs (する 형)**
  - する / します / して / した / しない / すれば / しろ / しよう / される / させる
  - 복합동사(〜する)에 대해서도 어근 추출 후 同일하게 적용

  **adj-i (高い 형)**
  - 高く / 高くて / 高かった / 高くない / 高ければ / 高そう / 高すぎる

  **adj-na (静か 형)**
  - 静かだ / 静かで / 静かな / 静かに / 静かだった / 静かじゃない

- [ ] Kindle 내보내기 route (`/api/export/kindle`) 수정
  - 각 entry에 대해 `generateConjugations(term, reading, part_of_speech)` 호출
  - 반환된 활용형 목록을 `<idx:iform>` 태그로 추가
  - 예시:
    ```html
    <idx:orth>
      帰る
      <idx:iform name="" value="帰る"/>
      <idx:iform name="" value="帰って"/>
      <idx:iform name="" value="帰った"/>
      <idx:iform name="" value="帰らない"/>
      <idx:iform name="" value="帰れる"/>
    </idx:orth>
    ```
  - reading 기반 仮名 활용형도 함께 추가 (かえって, かえった 등)

- [ ] 테스트: 생성된 zip을 kindlegen으로 컴파일 후 실제 Kindle에서 활용형 검색 확인

---

## Phase 7: 향후 개선 과제 (우선순위 순)

### 🔴 높음

- [ ] **JAKO 2018사전 마이그레이션**
  - JAKO 2018 데이터를 파싱하여 `staging_words` 또는 `dictionary_entries`에 일괄 삽입
  - 데이터 형식 확인 후 import 스크립트 작성 필요

- [ ] **Yomitan term_meta_bank (빈도수 데이터) 내보내기**
  - `staging_words`의 `frequency` 값을 Yomitan term meta bank에 포함
  - Yomitan에서 단어 정렬 및 빈도 표시에 활용
  - 형식: `[term, "freq", { reading: ..., frequency: { value: N, displayValue: "N" } }]`

### 🟡 중간

- [ ] **내 사전 페이지 페이지네이션 추가**
  - 현재 전체 목록을 한번에 로드 → 단어가 많아지면 느려짐
  - 서버사이드 페이지네이션 또는 가상 스크롤 도입

- [ ] **대기열 일괄 등록 성능 개선**
  - 현재 단어를 하나씩 순차 등록 → 대량일 경우 느림
  - 서버 액션에서 `createMany` / `upsertMany` 배치 처리로 변경

- [ ] **Kindle 사전 메타데이터 관리 항목 정의**
  - 사전 관리 화면에서 Kindle 전용 필드 정리 필요
  - 최소: 사전 제목, 언어 쌍(DictionaryInLanguage / DictionaryOutLanguage)

- [ ] **사전 항목 pitch_accent 입력 UI**
  - 현재 수정 다이얼로그에는 있으나 대기열 등록 폼에는 없음
  - 대기열 등록 폼에 피치 악센트 입력 필드 추가

- [ ] **대기열 단어 목록 SelectTrigger 표시 개선**
  - Base UI Select.Value가 value prop을 그대로 렌더링하는 문제로 품사 선택 시 "n", "v1" 등 코드만 표시됨
  - 품사 셀렉트 트리거도 `selectedPosLabel` 방식으로 한국어 레이블 표시하도록 수정

### 🟢 낮음

- [ ] **내 사전 단어 일괄 삭제 기능**
  - 체크박스 선택 후 선택 항목 일괄 삭제

- [ ] **사전 항목 소속 사전 변경 기능**
  - 내 사전 화면에서 단어의 `dictionary_id`를 다른 사전으로 이동

- [ ] **대기열 단어 중복 체크 강화**
  - 현재 term 문자열 기준 중복 체크 → term + reading 조합 기준으로 변경 고려

- [ ] **Yomitan structured-content 렌더링 확인**
  - TipTap 에디터에서 입력한 HTML(표, 목록 등)이 Yomitan에서 올바르게 렌더링되는지 검증
  - 현재 `p → div`, `strong → span(fontWeight:bold)` 등 기본 태그만 변환 중

- [ ] **내보내기 파일명에 날짜/revision 포함**
  - 예: `내사전_yomitan_20260328.zip` 형식으로 자동 생성
