---
title: "[LLM 앱 실전] Day 3: 함수 호출 - LLM에게 도구를 쥐여주기"
date: 2026-08-05 00:00:00 +0900
categories: [AI, LLM]
tags: ["LLM", "함수 호출", "Tool Use", "Function Calling", "API 연동", "MCP", "구조화 출력"]
---

## 서론: 말하는 모델에서 행동하는 모델로

LLM은 텍스트를 생성할 뿐, 스스로 계산하거나 검색하거나 이메일을 보낼 수 없다. "지금 서울 날씨는?"이라 물으면 그럴듯하게 지어낸다. **함수 호출(tool use)**은 모델에게 "이런 도구를 쓸 수 있다"고 알려주고, 모델이 필요할 때 그 도구를 호출하도록 한다. 이것이 LLM을 단순 챗봇에서 실제 일을 하는 시스템으로 바꾼다.

## 1. 함수 호출의 흐름

중요한 오해부터 짚자. **모델이 직접 함수를 실행하지 않는다.** 모델은 "이 함수를 이 인자로 부르라"고 요청하고, 실행은 우리 코드가 한다.

```
1. 우리가 사용 가능한 도구 목록(스키마)을 모델에 전달
2. 사용자: "서울 날씨 알려줘"
3. 모델: "get_weather(city='서울')을 호출하라" (실행 아님, 요청)
4. 우리 코드: 실제 get_weather 실행 → 결과 획득
5. 결과를 다시 모델에 전달
6. 모델: "서울은 현재 맑고 25도입니다" (자연어 응답)
```

## 2. 도구 정의: 스키마로 알려주기

모델은 도구의 이름·설명·파라미터를 JSON 스키마로 받는다(Day 1의 구조화 출력과 같은 메커니즘).

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "특정 도시의 현재 날씨를 조회한다",  # 모델이 언제 쓸지 판단하는 근거
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "도시 이름"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["city"],
        },
    },
}]
```

**설명(description)이 핵심이다.** 모델은 이 설명을 읽고 "지금 이 도구가 필요한가, 어떤 인자를 넣을까"를 판단한다. 명확할수록 정확히 호출한다.

## 3. 호출 처리 루프

```python
messages = [{"role": "user", "content": "서울 날씨 알려줘"}]

while True:
    resp = client.chat.completions.create(
        model="...", messages=messages, tools=tools)
    msg = resp.choices[0].message
    messages.append(msg)

    if not msg.tool_calls:
        break   # 도구 호출 없음 → 최종 답변 완성

    # 모델이 요청한 각 도구를 실제로 실행
    for call in msg.tool_calls:
        args = json.loads(call.function.arguments)
        result = dispatch(call.function.name, args)   # 실제 함수 실행
        messages.append({
            "role": "tool",
            "tool_call_id": call.id,
            "content": json.dumps(result),   # 결과를 모델에 반환
        })
    # 루프 반복 → 모델이 결과를 받아 다음 행동 결정
```

이 루프가 핵심이다. 모델은 한 번에 여러 도구를 부를 수도, 한 도구의 결과를 보고 다음 도구를 부를 수도 있다(→ Day 4 에이전트).

## 4. 안전한 도구 실행

모델이 호출을 "요청"하지만, 무엇을 실행할지 결정하는 것은 우리 코드다. 여기에 보안 경계가 있다.

```python
def dispatch(name, args):
    # 화이트리스트: 허용된 함수만 실행 (임의 실행 차단)
    if name not in ALLOWED_TOOLS:
        return {"error": "허용되지 않은 도구"}

    # 인자 검증: 모델 출력을 신뢰하지 말고 검증
    if name == "get_weather":
        city = args.get("city", "")
        if not is_valid_city(city):
            return {"error": "잘못된 도시"}
        return get_weather(city)
```

원칙(WebAssembly Day 3의 능력 기반 보안과 같은 사고): **모델 출력은 신뢰할 수 없는 입력으로 취급한다.** 부수효과가 큰 도구(삭제·결제·이메일)는 인간 승인을 거치거나 권한을 좁힌다.

## 5. 도구 설계 원칙

```
1. 좁고 명확하게: 한 도구는 한 가지 일. 모호한 만능 도구는 오용됨
2. 좋은 설명: 모델이 읽는 유일한 단서. "언제 쓰는지"를 명시
3. 에러를 텍스트로: 실패 시 모델이 이해할 메시지 반환 → 모델이 재시도·대안 모색
4. 멱등성: 같은 호출이 반복돼도 안전하게 (분산 Day 5, gRPC Day 4)
5. 도구 수 제한: 너무 많으면 모델이 혼란 → 보통 한 번에 10~20개 이하
```

## 6. 표준화: MCP (Model Context Protocol)

도구를 앱마다 다시 만드는 대신, 표준 프로토콜로 도구·데이터 소스를 연결하는 흐름이 자리 잡았다.

```
MCP (Model Context Protocol):
  LLM 앱과 외부 도구/데이터를 잇는 개방형 표준
  - MCP 서버: 도구·리소스를 제공 (예: 파일시스템, DB, GitHub)
  - MCP 클라이언트: LLM 앱이 여러 MCP 서버에 연결

장점: 한 번 만든 도구 서버를 여러 LLM 앱이 재사용
  → "USB-C 같은" 표준 커넥터 (도구 생태계 공유)
```

직접 함수 호출로 시작하고, 도구를 여러 앱·팀이 공유해야 할 때 MCP로 표준화하는 것이 자연스러운 진화다.

## 7. Day 3 체크리스트

1. 모델이 함수를 실행하는 게 아니라 "호출을 요청"하고 우리 코드가 실행함을 이해했다.
2. 도구를 JSON 스키마로 정의하고 description의 중요성을 파악했다.
3. 호출-실행-반환 루프를 구현했다.
4. 모델 출력을 신뢰 않고 화이트리스트·검증으로 안전하게 실행했다.
5. 좁은 도구 설계 원칙과 MCP 표준화의 가치를 이해했다.

## 다음 편 예고

도구 하나를 부르는 것을 넘어, 모델이 스스로 계획을 세우고 여러 도구를 연쇄적으로 사용해 복잡한 목표를 달성하려면? Day 4에서는 **에이전트** — 추론·행동·관찰의 루프로 자율적으로 작업하는 시스템을 다룬다.
