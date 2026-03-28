#!/usr/bin/env python3
"""
jako StarDict → shirube staging_words 가져오기 스크립트

사용법:
  python scripts/import_jako.py
  python scripts/import_jako.py --skip-duplicates false
  python scripts/import_jako.py --db prisma/dev.db --idx resources/jako.idx --dict resources/jako.dict
"""

import argparse
import re
import sqlite3
import struct
import sys
from pathlib import Path

BRACKET_PATTERN = re.compile(r'^([^\[<\n]+)\[([^\]]+)\]')
KANJI_RE        = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]')
_HIRA_RE        = re.compile(r'^[\u3040-\u309f]+$')

def _strip_parens(s: str) -> str:
    """괄호 처리: 히라가나 내용(okurigana)이면 괄호만 제거, 그 외엔 내용까지 제거."""
    return re.sub(r'\(([^)]*)\)', lambda m: m.group(1) if _HIRA_RE.match(m.group(1)) else '', s)
NON_BR_TAG      = re.compile(r'<(?!/?br\b)[^>]+>', re.IGNORECASE)
# 헤더 패턴: "word[bracket]<br>" 또는 "word[bracket]" (br 없을 수도 있음)
HEADER_PATTERN  = re.compile(r'^[^\[<\n]+(?:\[[^\]]*\])?\s*(?:<br>)?', re.IGNORECASE)


def strip_header(meaning: str) -> str:
    """첫 줄 헤더(あ[阿]<br> 등)를 제거하고 본문만 반환."""
    m = HEADER_PATTERN.match(meaning)
    if m and m.end() < len(meaning):
        return meaning[m.end():].strip()
    return meaning


def parse_entry(word: str, definition: str) -> list:
    """
    Returns list of (term, reading, meaning) tuples.
    - idx 키 자체도 term으로 생성 (Kindle headword 커버리지)
    - 괄호 안 한자 변형도 각각 term으로 생성
    - meaning은 헤더 제거 후 저장
    """
    raw_meaning = NON_BR_TAG.sub('', definition).strip()
    meaning     = strip_header(raw_meaning)

    m = BRACKET_PATTERN.match(definition.split('<br>')[0] if '<br>' in definition else definition)
    if not m:
        # 괄호 없음 — idx 키 자체가 term (okurigana 괄호 처리)
        terms = [t.strip() for t in _strip_parens(word).split('|') if t.strip()]
        return [(t, t, meaning) for t in terms]

    prefix  = m.group(1)  # "因る|縁る" or "よる"
    bracket = m.group(2)  # "よる"      or "因る|縁る|由る"

    bracket_clean    = _strip_parens(bracket)
    bracket_variants = [v.strip() for v in bracket_clean.split('|') if v.strip()]

    if any(KANJI_RE.search(v) for v in bracket_variants):
        # Pattern B: idx=reading, bracket=kanji variants
        reading       = _strip_parens(prefix).strip()
        idx_terms     = [prefix.strip()]                              # hiragana idx 키
        # reading이 variant 길이 × 2 초과 → 복합어 prefix일 가능성 높음 → skip
        bracket_terms = [v for v in bracket_variants
                         if KANJI_RE.search(v) and not (len(bracket_variants) > 1 and len(reading) > len(v) * 2)]
        all_terms     = list(dict.fromkeys(idx_terms + bracket_terms))  # 순서 유지 중복 제거
    else:
        # Pattern A: idx=kanji variants, bracket=reading
        reading       = bracket_variants[0] if bracket_variants else _strip_parens(prefix).strip()
        all_terms     = [t.strip() for t in _strip_parens(prefix).split('|') if t.strip()]

    return [(t, reading, meaning) for t in all_terms]


def parse_stardict(idx_path: Path, dict_path: Path):
    idx_buf  = idx_path.read_bytes()
    dict_buf = dict_path.read_bytes()

    # (term, reading, meaning) — 내부 중복 제거용 set
    seen    = set()
    entries = []
    pos = 0
    while pos < len(idx_buf):
        end    = idx_buf.index(b'\x00', pos)
        word   = idx_buf[pos:end].decode('utf-8')
        offset = struct.unpack_from('>I', idx_buf, end + 1)[0]
        size   = struct.unpack_from('>I', idx_buf, end + 5)[0]
        defn   = dict_buf[offset:offset + size].decode('utf-8')

        for t, r, m in parse_entry(word, defn):
            if not KANJI_RE.search(t):
                continue
            key = (t, r, m)
            if key not in seen:
                seen.add(key)
                entries.append((t, r, m))

        pos = end + 9

    return entries


def import_to_db(db_path: Path, entries: list, skip_duplicates: bool):
    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()

    if skip_duplicates:
        cur.execute('SELECT term FROM staging_words WHERE is_processed = 0')
        existing = {row[0] for row in cur.fetchall()}
        entries  = [(t, r, m) for t, r, m in entries if t not in existing]

    CHUNK    = 500
    imported = 0
    for i in range(0, len(entries), CHUNK):
        chunk = entries[i:i + CHUNK]
        cur.executemany(
            'INSERT INTO staging_words (term, reading, meaning, frequency, part_of_speech, source, is_processed) '
            'VALUES (?, ?, ?, 0, NULL, "jako", 0)',
            chunk
        )
        imported += len(chunk)
        print(f'\r  {imported:,} / {len(entries):,} 삽입 중...', end='', flush=True)

    conn.commit()
    conn.close()
    print()
    return imported


def main():
    root = Path(__file__).parent.parent

    parser = argparse.ArgumentParser(description='jako StarDict → staging_words 가져오기')
    parser.add_argument('--db',   default=str(root / 'prisma' / 'dev.db'))
    parser.add_argument('--idx',  default=str(root / 'resources' / 'jako.idx'))
    parser.add_argument('--dict', default=str(root / 'resources' / 'jako.dict'))
    parser.add_argument('--skip-duplicates', default='true', choices=['true', 'false'])
    args = parser.parse_args()

    idx_path  = Path(args.idx)
    dict_path = Path(args.dict)
    db_path   = Path(args.db)

    for p in [idx_path, dict_path, db_path]:
        if not p.exists():
            print(f'오류: 파일을 찾을 수 없습니다 — {p}')
            sys.exit(1)

    skip_duplicates = args.skip_duplicates == 'true'

    print(f'파싱 중: {idx_path.name} + {dict_path.name}')
    entries = parse_stardict(idx_path, dict_path)
    print(f'  총 {len(entries):,}개 항목 파싱 완료 (내부 중복 제거 후)')

    print(f'DB에 삽입 중: {db_path} (중복 건너뜀: {skip_duplicates})')
    imported = import_to_db(db_path, entries, skip_duplicates)
    skipped  = len(entries) - imported if skip_duplicates else 0

    print(f'\n완료: {imported:,}개 추가, {skipped:,}개 중복 건너뜀')


if __name__ == '__main__':
    main()
