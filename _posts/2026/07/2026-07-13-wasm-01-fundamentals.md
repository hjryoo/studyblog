---
title: "[WebAssembly 실전] Day 1: Wasm의 기초 - 스택 머신, 모듈, 선형 메모리"
date: 2026-07-13 00:00:00 +0900
categories: [Web, WebAssembly]
tags: ["WebAssembly", "Wasm", "스택 머신", "선형 메모리", "WAT", "바이트코드", "샌드박스"]
---

## 서론: 브라우저를 넘어선 휴대용 바이트코드

WebAssembly(Wasm)는 이름 때문에 "브라우저용 기술"로 오해받지만, 본질은 **언어·플랫폼 중립의 휴대용 바이트코드**다. 안전하게 샌드박스되고, 거의 네이티브 속도로 돌고, 어디서든 같은 결과를 낸다. 이 시리즈는 Wasm의 구조부터 엣지 런타임 배포까지 5일에 걸쳐 다룬다. 첫날은 Wasm이 무엇인지, 어떻게 동작하는지다.

## 1. Wasm은 무엇이 아닌가

```
Wasm은 ...
  ❌ 프로그래밍 언어가 아니다 (컴파일 타깃이다)
  ❌ JavaScript 대체가 아니다 (보완한다)
  ❌ 브라우저 전용이 아니다 (서버·엣지·플러그인에서도 돈다)

Wasm은 ...
  ✅ C/C++/Rust/Go 등이 컴파일되는 저수준 바이트코드
  ✅ 스택 기반 가상 머신의 명령어 집합
  ✅ 기본적으로 외부와 격리된 샌드박스
```

## 2. 스택 머신: Wasm의 실행 모델

Wasm은 레지스터가 아니라 **스택**으로 계산한다. 명령어가 스택에서 값을 꺼내(pop) 연산하고 결과를 다시 쌓는다(push).

```wat
;; WAT(WebAssembly Text Format): (a + b) * 2 계산
(func $calc (param $a i32) (param $b i32) (result i32)
  local.get $a    ;; 스택: [a]
  local.get $b    ;; 스택: [a, b]
  i32.add         ;; a, b를 꺼내 더함 → 스택: [a+b]
  i32.const 2     ;; 스택: [a+b, 2]
  i32.mul)        ;; 둘을 꺼내 곱함 → 스택: [(a+b)*2]
```

스택 머신은 구조가 단순해 **검증과 컴파일이 빠르다.** 브라우저가 Wasm을 받자마자 빠르게 안전성을 확인하고 네이티브 코드로 컴파일할 수 있는 이유다.

## 3. 네 가지 숫자 타입뿐

Wasm 코어의 값 타입은 놀랍도록 단순하다.

```
i32, i64   정수 (32/64비트)
f32, f64   부동소수점 (32/64비트)

문자열·배열·구조체는? → 없다. 선형 메모리에 바이트로 직접 다룬다.
```

이 단순함이 핵심이다. 모든 고수준 타입은 메모리 위의 바이트 배치로 표현되고, 그 해석은 컴파일러와 호스트의 약속(ABI)에 맡긴다.

## 4. 선형 메모리: 거대한 바이트 배열

Wasm 모듈의 메모리는 하나의 연속된 바이트 배열(`linear memory`)이다. 페이지(64KB) 단위로 자라며, JS와 공유할 수 있다.

```wat
(module
  (memory (export "mem") 1)   ;; 1페이지(64KB) 메모리 선언·export

  (func (export "store_and_load") (result i32)
    i32.const 0       ;; 주소 0
    i32.const 42      ;; 저장할 값
    i32.store         ;; mem[0..4] = 42
    i32.const 0
    i32.load))        ;; mem[0..4]를 읽음 → 42
```

중요한 안전 속성: Wasm 코드는 **이 선형 메모리 밖을 절대 접근할 수 없다.** 호스트의 메모리나 다른 모듈을 건드릴 방법이 없다. 경계를 벗어난 접근은 트랩(trap)으로 즉시 중단된다. 이것이 Wasm 샌드박스의 토대다.

## 5. 모듈 구조

Wasm 모듈은 여러 섹션으로 구성된다.

```
Module
 ├─ Types     함수 시그니처 목록
 ├─ Imports   호스트에서 가져올 함수·메모리 (예: console.log)
 ├─ Functions 함수 본문 (바이트코드)
 ├─ Memory    선형 메모리 선언
 ├─ Globals   전역 변수
 ├─ Exports   호스트에 노출할 함수·메모리
 └─ Start     로드 시 자동 실행될 함수 (선택)
```

`import`와 `export`가 외부 세계와의 유일한 창구다. 모듈은 자기가 명시적으로 import한 것만 쓸 수 있다 — 이 **능력 기반(capability) 모델**이 보안의 핵심이다(Day 3에서 심화).

## 6. 직접 만들어 실행하기

```bash
# WAT → Wasm 바이너리 (wabt 툴킷)
wat2wasm calc.wat -o calc.wasm

# 바이너리를 다시 텍스트로 (역어셈블·디버깅)
wasm2wat calc.wasm

# wasmtime 같은 독립 런타임으로 실행 (브라우저 없이)
wasmtime calc.wasm --invoke calc 3 4   # → 14
```

브라우저(JS)에서 로드:

```javascript
const bytes = await fetch('calc.wasm').then(r => r.arrayBuffer());
const { instance } = await WebAssembly.instantiate(bytes);
console.log(instance.exports.calc(3, 4));  // 14
```

같은 `.wasm` 파일이 브라우저·wasmtime·서버 어디서나 동일하게 동작한다 — "한 번 컴파일, 어디서나 실행"의 실체다.

## 7. Day 1 체크리스트

1. Wasm이 언어가 아니라 휴대용 컴파일 타깃·바이트코드임을 이해했다.
2. 스택 머신 실행 모델과 그것이 빠른 검증·컴파일을 가능케 함을 파악했다.
3. 코어 타입이 네 가지 숫자뿐이고 나머지는 선형 메모리의 바이트임을 안다.
4. 선형 메모리 밖 접근 불가가 샌드박스의 토대임을 이해했다.
5. WAT를 작성·컴파일해 브라우저와 독립 런타임에서 실행했다.

## 다음 편 예고

코어 Wasm은 숫자만 주고받는다. 실제 언어로 작성한 코드를 컴파일해 문자열·구조체를 다루려면 더 필요하다. Day 2에서는 **Rust·C·Go를 Wasm으로 컴파일하고 JS와 데이터를 주고받는 법**을 다룬다.
