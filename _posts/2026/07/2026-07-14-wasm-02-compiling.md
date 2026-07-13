---
title: "[WebAssembly 실전] Day 2: 언어를 Wasm으로 - Rust, C, Go 컴파일과 데이터 교환"
date: 2026-07-14 00:00:00 +0900
categories: [Web, WebAssembly]
tags: ["WebAssembly", "Wasm", "Rust", "Emscripten", "wasm-bindgen", "TinyGo", "JavaScript"]
---

## 서론: 숫자를 넘어 진짜 데이터로

Day 1에서 Wasm 코어는 숫자 네 종류만 주고받는다고 했다. 그런데 실제 앱은 문자열·배열·객체를 다룬다. 이 간극을 메우는 것이 언어별 툴체인과 바인딩이다. 오늘은 Rust·C·Go를 Wasm으로 컴파일하고, JS와 복잡한 데이터를 교환하는 법을 본다.

## 1. 데이터 교환의 근본 문제

```
JS의 문자열 "hello" → Wasm에 어떻게 넘기나?
  Wasm은 i32/i64/f32/f64만 안다. 문자열은 모른다.

해법: 선형 메모리(Day 1)를 매개로
  1. JS가 "hello"를 UTF-8 바이트로 인코딩
  2. Wasm 메모리에 그 바이트를 씀
  3. Wasm 함수에 (포인터, 길이) = (주소 i32, 바이트수 i32) 전달
  4. Wasm은 메모리에서 그 범위를 읽음
```

이 과정을 손으로 하면 끔찍하다. 그래서 각 언어가 자동화 도구를 제공한다.

## 2. Rust + wasm-bindgen: 가장 매끄러운 길

Rust는 Wasm 지원이 가장 성숙하다. `wasm-bindgen`이 데이터 교환을 자동 생성한다.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("안녕하세요, {}님!", name)   // 문자열 입출력이 자연스럽다
}

#[wasm_bindgen]
pub struct Counter { value: i32 }

#[wasm_bindgen]
impl Counter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Counter { Counter { value: 0 } }
    pub fn increment(&mut self) { self.value += 1; }
    pub fn get(&self) -> i32 { self.value }
}
```

```bash
# wasm-pack이 .wasm + JS 글루 코드 + 타입 정의(.d.ts)까지 생성
wasm-pack build --target web
```

```javascript
import init, { greet, Counter } from './pkg/my_module.js';

await init();
console.log(greet("류혜진"));   // 안녕하세요, 류혜진님!

const c = new Counter();        // Rust 구조체를 JS 객체처럼
c.increment();
console.log(c.get());           // 1
```

`wasm-bindgen`이 포인터·길이 전달, UTF-8 인코딩, 메모리 관리를 전부 숨긴다.

## 3. C/C++ + Emscripten

Emscripten은 C/C++ 생태계 전체(심지어 SDL·OpenGL)를 Wasm으로 가져온다.

```c
// math.c
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE   // 트리 셰이킹에서 살아남도록 export 표시
int fibonacci(int n) {
    if (n < 2) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        int t = a + b; a = b; b = t;
    }
    return b;
}
```

```bash
# -sEXPORTED_RUNTIME_METHODS로 JS에서 호출 가능한 헬퍼 노출
emcc math.c -o math.js \
     -sEXPORTED_FUNCTIONS=_fibonacci \
     -sEXPORTED_RUNTIME_METHODS=ccall,cwrap
```

```javascript
const fib = Module.cwrap('fibonacci', 'number', ['number']);
console.log(fib(20));   // 6765
```

기존 C 라이브러리(이미지 코덱, 암호화, 게임 엔진)를 웹으로 포팅하는 데 강력하다.

## 4. Go / TinyGo

Go도 Wasm으로 컴파일되지만 표준 컴파일러는 런타임(GC 포함)을 통째로 넣어 바이너리가 크다(MB 단위). 경량이 필요하면 **TinyGo**를 쓴다.

```go
//go:build wasm

package main

//export add
func add(a, b int32) int32 {
    return a + b
}

func main() {}   // Wasm에선 빈 main이 필요
```

```bash
# 표준 Go: 큰 바이너리, 전체 언어 기능
GOOS=js GOARCH=wasm go build -o main.wasm

# TinyGo: 수십 KB, 임베디드·엣지에 적합 (일부 기능 제한)
tinygo build -o main.wasm -target wasm ./main.go
```

원칙: **Go의 모든 기능이 필요하면 표준 컴파일러, 작은 크기가 중요하면 TinyGo.**

## 5. 호스트 함수 가져오기 (import)

Wasm은 스스로 콘솔 출력·네트워크를 못 한다. 호스트가 함수를 주입해야 한다(Day 1의 import).

```rust
#[wasm_bindgen]
extern "C" {
    // JS의 console.log를 Wasm으로 가져옴
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn do_work() {
    log("Wasm에서 호출한 console.log");   // 호스트 함수 사용
}
```

Wasm이 할 수 있는 일은 호스트가 import로 허락한 것뿐이다. 이 명시적 권한 부여가 Day 3에서 다룰 보안 모델의 핵심이다.

## 6. 성능과 데이터 교환 비용

```
Wasm이 빠른 경우:
  ✅ CPU 집약 연산 (이미지 처리, 암호화, 압축, 파싱, 물리 시뮬)
  ✅ 일관된 성능 (JIT 워밍업 변동이 적음)

Wasm이 불리한 경우:
  ❌ JS ↔ Wasm 경계를 자주 넘나드는 작은 호출 (경계 비용)
  ❌ DOM 조작 (Wasm은 DOM 직접 접근 불가 → JS 경유)

원칙: 무거운 계산을 Wasm에서 "한 덩어리"로 처리하고,
      경계 횡단을 최소화한다 (데이터를 메모리로 한 번에 넘김)
```

## 7. Day 2 체크리스트

1. 문자열·구조체가 선형 메모리의 (포인터, 길이)로 교환됨을 이해했다.
2. Rust `wasm-bindgen`/`wasm-pack`으로 데이터 교환을 자동화했다.
3. Emscripten으로 C 코드를 컴파일하고 JS에서 호출했다.
4. Go와 TinyGo의 바이너리 크기·기능 트레이드오프를 구분했다.
5. import로 호스트 함수를 가져오고, 경계 횡단 비용을 줄이는 원칙을 잡았다.

## 다음 편 예고

지금까지는 브라우저 안의 Wasm이었다. 브라우저 밖 — 서버·CLI에서 파일·네트워크를 쓰려면 표준 인터페이스가 필요하다. Day 3에서는 **WASI와 Wasm의 보안 모델**을 다룬다.
