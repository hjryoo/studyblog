---
title: "[대규모 시스템] Day 1: 캐싱 - 가장 빠른 쿼리는 하지 않는 쿼리다"
date: 2026-07-20 00:00:00 +0900
categories: [Systems, Architecture]
tags: ["시스템 설계", "캐싱", "Redis", "캐시 전략", "TTL", "Cache Stampede", "확장성"]
---

## 서론: 규모가 커지면 모든 것이 바뀐다

사용자 100명일 때 잘 돌던 시스템이 100만 명에서 무너진다. DB가 첫 병목이다. 대규모 시스템 설계의 첫 도구는 거의 항상 캐싱이다. 원칙은 단순하다 — **가장 빠른 쿼리는 아예 하지 않는 쿼리다.** 이 시리즈는 캐싱·메시지 큐·로드밸런싱·레이트 리미팅·관측성으로 대규모 시스템의 핵심 패턴을 5일에 걸쳐 다룬다.

## 1. 캐시는 어디에 두는가

요청 경로를 따라 여러 계층에 캐시가 존재한다.

```
클라이언트 → CDN → 로드밸런서 → 앱 서버 → 캐시(Redis) → DB

1. 브라우저 캐시   : 정적 자원 (Cache-Control 헤더)
2. CDN            : 이미지·JS·CSS, 지리적으로 가까운 엣지
3. 앱 로컬 캐시    : 프로세스 메모리 (가장 빠르나 서버 간 불일치)
4. 분산 캐시(Redis): 여러 앱 서버가 공유 (가장 흔한 데이터 캐시)
5. DB 버퍼 풀     : DB 자체의 메모리 캐시
```

캐시는 한 곳이 아니라 계층 전체의 전략이다. 무엇을 어느 계층에 둘지가 설계의 핵심이다.

## 2. 캐시 읽기 전략

```
Cache-Aside (지연 로딩) — 가장 흔함:
  앱이 캐시를 먼저 확인 → 없으면(miss) DB 조회 후 캐시에 저장
  ✅ 필요한 것만 캐시, 캐시 장애 시에도 DB로 동작
  ❌ 첫 요청은 항상 miss, 캐시-DB 불일치 가능

Read-Through:
  앱은 캐시만 보고, 캐시가 알아서 DB에서 채움 (캐시 라이브러리가 담당)
```

```python
def get_user(user_id):
    # Cache-Aside 패턴
    key = f"user:{user_id}"
    cached = redis.get(key)
    if cached:
        return json.loads(cached)        # 캐시 히트

    user = db.query("SELECT ... WHERE id=%s", user_id)  # 미스 → DB
    redis.setex(key, 3600, json.dumps(user))            # TTL 1시간
    return user
```

## 3. 캐시 쓰기 전략

쓰기 시 캐시와 DB를 어떻게 일관되게 유지하느냐가 까다롭다.

```
Write-Through:
  쓰기를 캐시와 DB에 동시에 → 일관성 좋음, 쓰기 지연 증가
Write-Back (Write-Behind):
  캐시에만 쓰고 DB는 나중에 비동기로 → 빠름, 캐시 장애 시 데이터 유실
Write-Around:
  DB에만 쓰고 캐시는 무효화 → 자주 안 읽는 데이터에 적합

실무 정석: Cache-Aside 읽기 + 쓰기 시 캐시 "무효화(invalidate)"
  쓰기 → DB 갱신 → 해당 캐시 키 삭제 (다음 읽기가 새로 채움)
```

```python
def update_user(user_id, data):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")   # 갱신 아닌 삭제 — 다음 읽기가 최신 로드
```

업데이트가 아니라 **삭제**하는 이유: 동시 쓰기 시 캐시에 옛 값을 덮어쓰는 경쟁을 피한다.

## 4. 캐시 무효화: 두 가지 어려운 문제

"컴퓨터 과학의 두 가지 어려운 문제: 캐시 무효화, 이름 짓기, off-by-one 에러." 무효화가 어려운 이유는 일관성 때문이다.

```
TTL 기반:  만료 시간을 둬 자동 갱신 (간단, 그동안 stale 허용)
이벤트 기반: 데이터 변경 시 즉시 무효화 (정확, 구현 복잡)
버전 키:    user:123:v2 처럼 버전을 키에 — 갱신 시 버전 올려 자연 무효화

원칙: 짧은 stale을 허용할 수 있으면 TTL이 가장 단순하고 견고하다.
```

## 5. Cache Stampede: 동시 만료의 재앙

인기 키가 만료되는 순간, 수천 요청이 동시에 miss 나서 한꺼번에 DB를 때린다. DB가 무너지는 전형적 사고다.

```
시각 T: 인기 키 만료
시각 T: 요청 5000개가 동시에 miss → 5000개가 동시에 같은 DB 쿼리 → DB 폭사

방어:
  1. 락(mutex): 첫 요청만 DB 조회, 나머지는 잠깐 대기 후 캐시 사용
  2. 만료 일찍 갱신: TTL 만료 전 확률적으로 미리 재계산
  3. 만료 시각 분산(jitter): TTL에 ±랜덤 → 동시 만료 방지
```

```python
def get_with_lock(key):
    val = redis.get(key)
    if val:
        return val
    # 첫 요청만 락을 잡아 DB 조회, 나머지는 짧게 재시도
    if redis.set(f"lock:{key}", "1", nx=True, ex=10):
        val = db.query(...)
        redis.setex(key, 3600 + random.randint(0, 300), val)  # jitter
        redis.delete(f"lock:{key}")
        return val
    time.sleep(0.05)
    return get_with_lock(key)   # 락 못 잡으면 잠깐 후 재시도
```

## 6. 무엇을 캐시하면 안 되는가

```
캐시에 적합:  읽기 많고 쓰기 적은 데이터, 재계산 비싼 결과, 변동 느린 데이터
캐시 부적합:  쓰기가 잦아 금방 stale, 사용자별 1회성 데이터,
             강한 일관성이 필수인 데이터(잔액 등 — 분산 시스템 Day 4 참고)

핵심 지표: 히트율(hit rate). 90%+ 면 효과적, 50% 미만이면 캐시 전략 재검토.
```

## 7. Day 1 체크리스트

1. 캐시가 단일 지점이 아니라 브라우저~DB의 계층 전략임을 이해했다.
2. Cache-Aside 읽기 패턴을 TTL과 함께 구현했다.
3. 쓰기 시 갱신이 아니라 무효화(삭제)하는 이유를 안다.
4. TTL·이벤트·버전 기반 무효화의 트레이드오프를 파악했다.
5. Cache Stampede를 락·jitter·조기 갱신으로 방어했다.

## 다음 편 예고

캐시는 읽기를 줄인다. 하지만 쓰기 폭주와 느린 작업은? Day 2에서는 **메시지 큐와 비동기 처리**로 트래픽 급증을 흡수하고 시스템을 분리하는 법을 다룬다.
