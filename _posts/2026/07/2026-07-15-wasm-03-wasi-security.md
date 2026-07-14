---
title: "[WebAssembly 실전] Day 3: WASI와 보안 모델 - 브라우저 밖의 Wasm"
date: 2026-07-15 00:00:00 +0900
categories: [Web, WebAssembly]
tags: ["WebAssembly", "WASI", "보안", "샌드박스", "Capability", "wasmtime", "Component Model"]
---

## 서론: 시스템 인터페이스가 필요하다

Day 1~2의 Wasm은 숫자 계산과 메모리 조작만 했다. 파일을 읽거나 시간을 알거나 네트워크를 쓰려면? 브라우저에선 JS가 대신했지만, 서버·CLI에는 JS가 없다. **WASI(WebAssembly System Interface)**가 그 표준 시스템 인터페이스다. 그리고 WASI의 설계 철학 자체가 Wasm 보안 모델의 정수다.

## 1. WASI란 무엇인가

```
WASI = Wasm 모듈이 OS 기능(파일·시계·랜덤·네트워크)을 쓰는 표준 API

핵심: POSIX와 비슷해 보이지만 근본이 다르다
  POSIX: 프로세스는 기본적으로 파일시스템 전체에 접근 가능
  WASI:  명시적으로 부여받은 것만 접근 가능 (능력 기반 보안)
```

WASI 모듈은 import로 `fd_read`, `clock_time_get` 같은 함수를 받아 쓴다. 호스트(런타임)가 이 함수들을 구현해 제공한다.

## 2. 능력 기반 보안(Capability-based Security)

Wasm 보안의 핵심 원리다. "기본은 아무것도 못 함, 준 것만 할 수 있음."

```
전통적 프로그램:
  실행하면 그 사용자 권한으로 모든 것에 접근 가능
  악성 코드 = 사용자가 할 수 있는 모든 것을 함

WASI Wasm 모듈:
  기본적으로 파일·네트워크·환경변수 일절 접근 불가
  호스트가 명시적으로 넘긴 "능력(파일 디스크립터 등)"만 사용 가능
  → 악성 모듈도 받은 능력 밖으로는 아무것도 못 함
```

```bash
# 이 명령으로 wasmtime은 /tmp만 모듈에 노출한다
# 모듈은 /etc/passwd 같은 다른 경로엔 절대 접근 불가
wasmtime run --dir=/tmp app.wasm

# 환경변수도 명시적으로 넘긴 것만 보임
wasmtime run --env API_KEY=secret app.wasm
```

이것이 Wasm을 "신뢰할 수 없는 코드를 안전하게 실행"하는 데 이상적으로 만든다(Day 4의 플러그인·멀티테넌시로 이어진다).

## 3. WASI로 파일 다루기

```rust
// WASI 타깃으로 컴파일하면 표준 라이브러리가 그대로 동작
use std::fs;
use std::io::Write;

fn main() -> std::io::Result<()> {
    // 호스트가 --dir로 허락한 디렉터리 안에서만 동작
    let content = fs::read_to_string("input.txt")?;
    let upper = content.to_uppercase();

    let mut out = fs::File::create("output.txt")?;
    out.write_all(upper.as_bytes())?;
    Ok(())
}
```

```bash
# wasm32-wasi 타깃으로 빌드
rustup target add wasm32-wasip1
cargo build --target wasm32-wasip1 --release

# 현재 디렉터리만 노출해 실행
wasmtime run --dir=. target/wasm32-wasip1/release/app.wasm
```

같은 Rust 코드가 네이티브로도, Wasm으로도 컴파일되고, Wasm 쪽은 자동으로 샌드박스된다.

## 4. WASI Preview 1 vs Preview 2 / 컴포넌트 모델

WASI는 진화 중이다. 큰 전환점이 컴포넌트 모델이다.

```
WASI Preview 1 (wasip1):
  파일·시계·랜덤 등 기본 시스템 호출. 안정적이고 널리 지원.

WASI Preview 2 (wasip2) + Component Model:
  - WIT(Wasm Interface Types)로 고수준 타입(문자열·레코드·리스트)을
    인터페이스 수준에서 직접 정의 (Day 2의 수동 포인터 교환을 표준화)
  - 모듈을 조립 가능한 "컴포넌트"로 — 다른 언어로 만든 컴포넌트끼리
    타입 안전하게 연결
  - 네트워크 소켓(wasi-sockets), HTTP(wasi-http) 등 능력 확장
```

```wit
// WIT: 언어 중립 인터페이스 정의
interface greeter {
    greet: func(name: string) -> string;
}
```

컴포넌트 모델은 "Wasm을 언어 중립 패키지·플러그인 포맷"으로 만드는 핵심이다.

## 5. 샌드박스의 경계와 한계

Wasm 샌드박스가 강력하지만 만능은 아니다. 한계를 알아야 한다.

```
보장하는 것:
  ✅ 메모리 격리 (선형 메모리 밖 접근 불가)
  ✅ 능력 격리 (부여 안 한 리소스 접근 불가)
  ✅ 제어 흐름 무결성 (임의 코드 점프 불가)

보장하지 않는 것 (호스트가 추가로 막아야):
  ❌ 자원 고갈: 무한 루프·메모리 폭증 → 연료(fuel)·메모리 한도 설정
  ❌ 사이드 채널: 타이밍 공격 등
  ❌ 호스트가 잘못 부여한 과한 능력
```

```rust
// wasmtime: 실행 비용에 상한을 둬 무한 루프를 차단
let mut config = Config::new();
config.consume_fuel(true);
// ... store.set_fuel(1_000_000); 연료 소진 시 트랩
```

원칙: **샌드박스는 격리를 주지만, 자원 한도는 호스트가 명시적으로 설정해야 한다.**

## 6. 어디서 도는가: 런타임 생태계

```
wasmtime   Bytecode Alliance 표준 런타임. WASI/컴포넌트 모델 선도.
WasmEdge   엣지·AI 추론 특화. 클라우드 네이티브.
Wasmer     다양한 임베딩(여러 언어에서 호스트로 사용), WAPM 패키지.
wazero     순수 Go 구현 (CGo 없음) → Go 앱에 Wasm 임베드하기 쉬움.
```

브라우저 밖 Wasm은 이 런타임들을 라이브러리로 임베드해 호스트 애플리케이션에 박아 넣는 형태가 흔하다(Day 4).

## 7. Day 3 체크리스트

1. WASI가 Wasm의 표준 시스템 인터페이스임을 이해했다.
2. 능력 기반 보안("준 것만 할 수 있음")이 POSIX와 어떻게 다른지 안다.
3. `--dir`/`--env`로 노출 범위를 제한해 WASI 모듈을 실행했다.
4. 컴포넌트 모델과 WIT가 언어 중립 인터페이스를 표준화함을 파악했다.
5. 샌드박스가 메모리·능력을 격리하되 자원 한도는 호스트가 설정해야 함을 이해했다.

## 다음 편 예고

WASI와 능력 기반 보안을 갖추면, "신뢰할 수 없는 코드를 안전하게 실행"하는 강력한 응용이 열린다. Day 4에서는 Wasm을 **플러그인 시스템과 엣지 컴퓨팅**에 적용하는 실전 패턴을 다룬다.
