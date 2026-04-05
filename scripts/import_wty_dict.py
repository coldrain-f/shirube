# -*- coding: utf-8 -*-
"""
wty-ja-ko.zip에서 품사가 있는 항목만 필터링하여 SHIRUBE SUB 사전에 삽입.
Sudachi로 읽기(후리가나)와 동사 활용 유형을 개선.
"""

import sys
import io
import zipfile
import json
import sqlite3

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from sudachipy import dictionary as sudachi_dict

# ── Sudachi 초기화 ─────────────────────────────────────────────────────────
sudachi = sudachi_dict.Dictionary()
tokenizer = sudachi.create()

# ── Sudachi 활용형 → Yomitan 규칙 매핑 ────────────────────────────────────
CONJ_MAP = {
    '五段-カ行': 'v5k',
    '五段-ガ行': 'v5g',
    '五段-サ行': 'v5s',
    '五段-タ行': 'v5t',
    '五段-ナ行': 'v5n',
    '五段-バ行': 'v5b',
    '五段-マ行': 'v5m',
    '五段-ラ行': 'v5r',
    '五段-ワア行': 'v5u',
    '五段-ア行': 'v5u',
    '下一段': 'v1',
    '上一段': 'v1',
    'カ行変格': 'vk',
    'サ行変格': 'vs',
}

# 어미 기반 폴백 (Sudachi가 명사로 오분석할 때)
ENDING_MAP = [
    ('くる', 'vk'), ('する', 'vs'),
    ('える', 'v1'), ('いる', 'v1'),
    ('ける', 'v1'), ('げる', 'v1'), ('せる', 'v1'), ('ねる', 'v1'),
    ('べる', 'v1'), ('める', 'v1'), ('れる', 'v1'), ('てる', 'v1'),
    ('でる', 'v1'), ('へる', 'v1'), ('ぜる', 'v1'),
    ('く', 'v5k'), ('ぐ', 'v5g'), ('す', 'v5s'), ('つ', 'v5t'),
    ('ぬ', 'v5n'), ('ぶ', 'v5b'), ('む', 'v5m'), ('る', 'v5r'),
    ('う', 'v5u'),
]

# wty 품사 태그 → 표시용 한국어 레이블
POS_LABEL = {
    'v': '동사', 'vi': '자동사', 'vt': '타동사',
    'n': '명사', 'adj': '형용사', 'adv': '부사',
    'ptcl': '조사', 'pref': '접두사', 'suf': '접미사',
    'pron': '대명사', 'conj': '접속사', 'intj': '감탄사',
    'num': '수사', 'aux': '조동사', 'name': '고유명사',
    'abbv': '약어', 'adn': '연체사', 'char': '문자',
    'idio': '관용구', 'phrase': '구', 'prov': '속담',
    'symb': '기호', 'rare': '희귀', 'arch': '고어',
    'sl': '속어', 'dialect': '방언',
}

VERB_TAGS = {'v', 'vi', 'vt'}


def infer_verb_type_from_ending(term: str) -> str:
    for ending, vtype in ENDING_MAP:
        if term.endswith(ending):
            return vtype
    return 'v'


def get_reading_and_pos(term: str, original_pos_tags: list[str]) -> tuple[str, str]:
    """
    Sudachi로 읽기와 동사 유형을 반환.
    - 읽기: 모든 형태소의 읽기를 연결
    - 동사 유형: Sudachi 활용형 → Yomitan 규칙, 실패 시 어미 폴백
    """
    tokens = tokenizer.tokenize(term)
    reading = ''.join(m.reading_form() for m in tokens)

    is_verb = any(t in VERB_TAGS for t in original_pos_tags)

    if not is_verb:
        return reading, original_pos_tags[0] if original_pos_tags else ''

    # 동사 유형 탐색
    for m in tokens:
        pos = m.part_of_speech()
        if pos[0] == '動詞':
            conj_type = pos[4]
            for key, val in CONJ_MAP.items():
                if key in conj_type:
                    return reading, val
            return reading, 'v'
        # 명사 + サ変可能 (勉強する 타입)
        if pos[0] == '名詞' and pos[2] == 'サ変可能':
            return reading, 'vs-i'

    # Sudachi가 동사를 찾지 못한 경우 → 어미 기반 폴백
    return reading, infer_verb_type_from_ending(term)


def extract_meaning(definitions: list) -> str:
    """구조화된 Yomitan 정의에서 한국어 의미 텍스트를 추출."""
    glosses = []
    for defn in definitions:
        if isinstance(defn, str):
            glosses.append(defn)
        elif isinstance(defn, dict) and defn.get('type') == 'structured-content':
            text = _extract_content(defn.get('content', []))
            if text.strip():
                glosses.append(text.strip())
    return ' | '.join(g for g in glosses if g)


_SKIP_CONTENT_TYPES = {
    'backlink', 'details-entry-examples', 'extra-info',
    'example-sentence', 'example-sentence-a', 'example-sentence-b',
    'summary-entry',
}


def _extract_content(content) -> str:
    """structured-content를 재귀적으로 순회하여 텍스트 추출.
    backlink, 예문(details-entry-examples) 등 제외."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [_extract_content(item) for item in content]
        return ' '.join(p for p in parts if p)
    if isinstance(content, dict):
        data = content.get('data', {})
        if isinstance(data, dict) and data.get('content') in _SKIP_CONTENT_TYPES:
            return ''
        if 'href' in content:
            return ''
        return _extract_content(content.get('content', ''))
    return ''


def build_pos_display(pos_tags: list[str], specific_pos: str) -> str:
    """표시용 품사 문자열 생성.
    동사류는 specific_pos(v1/v5k/vs 등 Yomitan 규칙)를 우선 사용.
    비동사는 한글 레이블로 변환.
    """
    if any(t in VERB_TAGS for t in pos_tags):
        # 동사: Sudachi가 구체화한 유형 (v1, v5k, vk, vs, vs-i 등) 저장
        return specific_pos
    # 비동사: 원본 태그를 한글 레이블로
    labels = [POS_LABEL.get(t, t) for t in pos_tags if t in POS_LABEL]
    return ', '.join(labels) if labels else specific_pos


# ── 메인 처리 ──────────────────────────────────────────────────────────────
def main():
    print('wty-ja-ko.zip 로드 중...')
    with zipfile.ZipFile('resources/wty-ja-ko.zip') as z:
        with z.open('term_bank_1.json') as f:
            bank1 = json.load(f)
        # bank2는 non-lemma 활용형 → 제외
        # with z.open('term_bank_2.json') as f:
        #     bank2 = json.load(f)

    # 품사 있는 항목만 (index 2 비어있지 않고, non-lemma 아님)
    entries = [e for e in bank1 if e[2] and e[2] != 'non-lemma']
    print(f'품사 있는 항목: {len(entries)}/{len(bank1)}')

    # DB 연결
    conn = sqlite3.connect('prisma/dev.db')
    cur = conn.cursor()
    cur.execute('SELECT id FROM dictionaries WHERE name = "SHIRUBE SUB"')
    row = cur.fetchone()
    if not row:
        print('오류: SHIRUBE SUB 사전을 찾을 수 없음')
        conn.close()
        return
    dict_id = row[0]
    print(f'SHIRUBE SUB ID: {dict_id}')

    # 기존 데이터 초기화 (재실행 대비)
    cur.execute('DELETE FROM dictionary_entries WHERE dictionary_id = ?', (dict_id,))
    conn.commit()
    print('기존 항목 초기화 완료')

    to_insert = []
    skipped = 0

    for idx, entry in enumerate(entries):
        term      = entry[0]
        pos_raw   = entry[2].strip()   # 원본 품사 태그 (공백 구분 가능)
        defns     = entry[5]

        pos_tags = pos_raw.split()
        primary_tag = pos_tags[0] if pos_tags else ''

        # Sudachi로 읽기 + 동사 유형
        reading, specific_pos = get_reading_and_pos(term, pos_tags)

        # 의미 추출
        meaning = extract_meaning(defns)
        if not meaning:
            skipped += 1
            continue

        # 표시용 품사
        display_pos = build_pos_display(pos_tags, specific_pos)

        to_insert.append((term, reading, meaning, display_pos, dict_id))

        if (idx + 1) % 1000 == 0:
            print(f'  처리 중: {idx + 1}/{len(entries)}')

    print(f'삽입 예정: {len(to_insert)}, 건너뜀(의미 없음): {skipped}')

    # 배치 삽입
    BATCH = 500
    total_inserted = 0
    for i in range(0, len(to_insert), BATCH):
        batch = to_insert[i:i + BATCH]
        cur.executemany(
            '''INSERT INTO dictionary_entries
               (term, reading, meaning, part_of_speech, dictionary_id,
                pitch_accent, audio_file, tags, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL,
                       datetime('now'), datetime('now'))''',
            batch
        )
        conn.commit()
        total_inserted += len(batch)
        print(f'  삽입 완료: {total_inserted}/{len(to_insert)}')

    conn.close()
    print(f'\n완료! 총 {total_inserted}개 항목이 SHIRUBE SUB에 삽입됨.')


if __name__ == '__main__':
    main()
