---
title: "[대규모 시스템] Day 4: 레이트 리미팅 - 시스템을 보호하고 공정하게 나누기"
date: 2026-07-23 00:00:00 +0900
categories: [Systems, Architecture]
tags: ["시스템 설계", "레이트 리미팅", "Token Bucket", "Sliding Window", "API", "Redis", "복원력"]
---

## 서론: 무제한은 곧 붕괴다

확장 가능한 시스템(Day 3)을 만들어도, 한 클라이언트가 초당 수만 요청을 던지면 다른 모두가 피해를 본다. 악의적 공격이든, 버그 난 클라이언트든, 폭주하는 재시도든. 레이트 리미팅은 "초당 N개까지만"이라는 경계로 시스템을 보호하고 자원을 공정하게 나눈다.

## 1. 왜 필요한가

```
보호: DDoS·폭주 클라이언트로부터 시스템 방어
공정: 한 사용자가 자원을 독점하지 못하게
비용: 외부 API 호출·연산 비용 통제
품질: 과부하로 전체가 느려지느니, 초과분을 거절해 나머지를 지킴 (분산 Day 5 로드 셰딩)

응답: 한도 초과 시 HTTP 429 Too Many Requests + Retry-After 헤더
```

## 2. 알고리즘 1: 고정 윈도우 (Fixed Window)

```
"매 1분마다 카운터 리셋, 분당 100개까지"

[12:00:00~12:00:59] 카운트 100 도달 → 이후 거절
[12:01:00] 카운터 0으로 리셋

✅ 구현 단순 (카운터 + TTL)
❌ 경계 문제: 12:00:59에 100개 + 12:01:00에 100개 = 1초에 200개 통과
```

```python
def fixed_window(user_id, limit=100):
    key = f"rl:{user_id}:{int(time.time() // 60)}"  # 분 단위 키
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, 60)
    return count <= limit
```

## 3. 알고리즘 2: 슬라이딩 윈도우 (Sliding Window)

고정 윈도우의 경계 문제를 푼다.

```
슬라이딩 로그: 각 요청의 타임스탬프를 저장, "지난 60초" 안의 개수를 셈
  ✅ 정확
  ❌ 모든 요청 타임스탬프 저장 → 메모리 비쌈

슬라이딩 윈도우 카운터: 현재+이전 윈도우를 가중 평균으로 근사
  현재 윈도우 30% 경과 시: 이전 윈도우 70% + 현재 100% 가중
  ✅ 정확도와 비용의 균형 — 실무에서 가장 흔함
```

```python
def sliding_log(user_id, limit=100, window=60):
    key = f"rl:{user_id}"
    now = time.time()
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)  # 윈도우 밖 제거
    pipe.zadd(key, {str(now): now})              # 현재 요청 기록
    pipe.zcard(key)                              # 윈도우 내 개수
    pipe.expire(key, window)
    _, _, count, _ = pipe.execute()
    return count <= limit
```

## 4. 알고리즘 3: 토큰 버킷 (Token Bucket)

가장 널리 쓰이는 방식. 버스트(순간 폭증)를 허용하면서 평균을 제한한다.

```
버킷에 토큰이 일정 속도로 채워짐 (예: 초당 10개, 최대 100개)
요청마다 토큰 1개 소비. 토큰 없으면 거절.

✅ 버스트 허용: 모아둔 토큰만큼 순간 폭증 가능 (최대 100개)
✅ 평균 제한: 장기적으론 채우는 속도(초당 10개)로 수렴
→ 자연스러운 사용 패턴(가끔 몰림)에 친화적
```

```python
def token_bucket(user_id, rate=10, capacity=100):
    key = f"tb:{user_id}"
    now = time.time()
    # 마지막 갱신 이후 채워진 토큰 계산 (Lua 스크립트로 원자적 실행 권장)
    data = redis.hgetall(key)
    tokens = float(data.get("tokens", capacity))
    last = float(data.get("ts", now))

    tokens = min(capacity, tokens + (now - last) * rate)  # 토큰 보충
    if tokens >= 1:
        tokens -= 1
        redis.hset(key, mapping={"tokens": tokens, "ts": now})
        return True
    return False
```

> 실무에서는 read-modify-write 경쟁을 피하려 이 로직을 Redis Lua 스크립트로 원자 실행한다.

## 5. 누출 버킷 (Leaky Bucket)

```
요청이 큐(버킷)에 쌓이고, 일정 속도로 "새어 나가며" 처리됨
  ✅ 출력 속도가 항상 일정 (다운스트림 보호에 이상적)
  ❌ 버스트를 흡수만 하고 즉시 처리 안 함 (지연 증가)

토큰 버킷 vs 누출 버킷:
  토큰 버킷 — 버스트 허용 (입력 유연)
  누출 버킷 — 출력 평탄화 (Day 2 부하 평탄화와 유사)
```

## 6. 분산 환경에서의 레이트 리미팅

서버가 여러 대면(Day 3) 각 서버의 로컬 카운터로는 전체 제한이 안 된다.

```
문제: 서버 3대, 각자 "분당 100" → 실제로는 분당 300 허용됨

해법:
  1. 중앙 저장소(Redis)에 카운터 집중 → 정확하나 모든 요청이 Redis 조회
  2. 로컬 + 주기 동기화 → 빠르나 약간 부정확
  3. 전용 서비스/게이트웨이(Envoy, API Gateway)에 위임

키 설계: 사용자별·API키별·IP별·엔드포인트별 등 차원을 조합
  rl:{user}:{endpoint} → 사용자가 특정 API를 남용해도 다른 API는 영향 없음
```

## 7. 클라이언트 친화적 설계

```
응답에 한도 정보를 헤더로 제공 (클라이언트가 조절 가능하게):
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 23
  X-RateLimit-Reset: 1721740800
  Retry-After: 30          ← 429 응답 시 재시도 시점 안내

계층적 제한: 무료 100/분, 유료 10000/분처럼 등급별 차등
점진적 대응: 즉시 차단보다 경고 → 스로틀 → 차단 단계적으로
```

## 8. Day 4 체크리스트

1. 레이트 리미팅이 보호·공정·비용·품질을 위한 것임을 이해했다.
2. 고정/슬라이딩 윈도우의 경계 문제와 정확도-비용 트레이드오프를 파악했다.
3. 토큰 버킷으로 버스트를 허용하며 평균을 제한했다.
4. 토큰 버킷과 누출 버킷의 차이(입력 유연 vs 출력 평탄)를 구분했다.
5. 분산 환경의 중앙 카운터 문제와 클라이언트 친화적 헤더 설계를 익혔다.

## 다음 편 예고

캐시·큐·LB·레이트리밋으로 시스템을 키우고 보호했다. 마지막 Day 5(시리즈 마무리)에서는 이 복잡한 시스템을 **관측하고 운영**하는 법 — 메트릭·로그·추적, SLO, 그리고 장애 대응을 정리한다.
