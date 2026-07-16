---
title: "[WebAssembly 실전] Day 4: 플러그인과 엣지 - Wasm을 호스트에 임베드하기"
date: 2026-07-16 00:00:00 +0900
categories: [Web, WebAssembly]
tags: ["WebAssembly", "Wasm", "플러그인", "엣지 컴퓨팅", "wasmtime", "멀티테넌시", "확장성"]
---

## 서론: "신뢰할 수 없는 코드의 안전한 실행"이 여는 것

Day 3의 능력 기반 샌드박스는 단순한 보안 기능이 아니다. "남이 작성한 코드를 내 서버에서 안전하게 돌린다"는 오랜 난제의 해법이다. 이 한 가지 속성에서 두 거대한 응용이 나온다 — **플러그인 시스템**과 **엣지 컴퓨팅**이다. 오늘은 Wasm을 호스트 애플리케이션에 임베드하는 실전 패턴을 본다.

## 1. 왜 Wasm이 플러그인에 이상적인가

```
전통적 플러그인의 딜레마:
  동적 라이브러리(.so/.dll): 빠르지만 호스트와 같은 권한 → 크래시·악성 위험
  별도 프로세스 + IPC: 안전하지만 느리고 복잡
  스크립트 언어 임베드(Lua 등): 안전하지만 언어 선택 강제, 느림

Wasm 플러그인:
  ✅ 샌드박스: 플러그인이 호스트를 크래시·침해 불가
  ✅ 언어 자유: 플러그인 작성자가 Rust/Go/C 등 자유 선택
  ✅ 거의 네이티브 속도
  ✅ 능력 제어: 플러그인에 정확히 필요한 것만 노출
```

Envoy, Istio, 데이터베이스, CDN이 Wasm을 확장 메커니즘으로 채택한 이유다.

## 2. 호스트에 Wasm 런타임 임베드하기

호스트 애플리케이션(여기선 Rust)이 wasmtime을 라이브러리로 박아 플러그인을 로드·실행한다.

```rust
use wasmtime::*;

fn run_plugin(wasm_path: &str, input: i32) -> Result<i32> {
    let engine = Engine::default();
    let module = Module::from_file(&engine, wasm_path)?;

    // Store: 이 플러그인 인스턴스의 상태·자원 한도를 담는 그릇
    let mut store = Store::new(&engine, ());
    store.set_fuel(10_000_000)?;   // Day 3: 무한 루프 방지 연료

    // 호스트가 플러그인에 제공할 함수 (능력 부여)
    let mut linker = Linker::new(&engine);
    linker.func_wrap("host", "log", |caller: Caller<'_, ()>, n: i32| {
        println!("[plugin] {}", n);
    })?;

    let instance = linker.instantiate(&mut store, &module)?;
    let process = instance.get_typed_func::<i32, i32>(&mut store, "process")?;

    Ok(process.call(&mut store, input)?)   // 플러그인 함수 호출
}
```

플러그인은 `linker`로 명시적으로 넘긴 `host.log` 외에는 아무것도 못 한다. 파일·네트워크 접근은 호스트가 허락하지 않는 한 불가능하다.

## 3. 멀티테넌시: 인스턴스 격리

한 호스트가 여러 사용자의 플러그인을 동시에 돌릴 때, 각 인스턴스는 완전히 격리된다.

```rust
// 각 테넌트마다 독립된 Store → 메모리·연료가 서로 분리됨
for tenant in tenants {
    let mut store = Store::new(&engine, tenant.context());
    store.set_fuel(tenant.fuel_budget)?;        // 테넌트별 자원 할당
    store.limiter(|ctx| &mut ctx.memory_limiter); // 메모리 상한

    let instance = linker.instantiate(&mut store, &tenant.module)?;
    // 한 테넌트의 무한 루프·메모리 폭증이 다른 테넌트에 영향 없음
}
```

`Engine`(컴파일된 코드)은 공유해 효율적이고, `Store`(실행 상태)는 분리해 격리한다. 한 테넌트가 연료를 소진하면 그 인스턴스만 멈춘다.

## 4. 엣지 컴퓨팅: 콜드 스타트가 거의 없다

엣지(CDN 노드)에서 사용자 코드를 돌리는 서버리스에 Wasm이 적합한 이유는 **시작 속도**다.

```
컨테이너 콜드 스타트:  수백 ms ~ 수 초 (OS·런타임 부팅)
V8 isolate:            수십 ms
Wasm 인스턴스:         수 마이크로초 ~ 1ms 미만

→ 요청마다 새 인스턴스를 띄워도 무시할 만한 비용
→ 수천 개 테넌트 함수를 한 노드에 밀집 배치 가능
```

Fastly Compute, Cloudflare Workers, Shopify Functions 등이 Wasm 기반 엣지 런타임이다.

## 5. 엣지 함수 예시

엣지에서 HTTP 요청을 가공하는 전형적 Wasm 함수.

```rust
// 엣지 런타임이 정의한 인터페이스에 맞춘 핸들러
#[wasm_handler]
fn handle(req: Request) -> Response {
    // 능력 제어: 이 함수는 허용된 origin에만 요청 가능
    if req.path().starts_with("/api/") {
        let mut resp = fetch_origin(req);
        resp.set_header("x-edge", "wasm");   // 응답 변형
        resp
    } else {
        Response::from_status(404)
    }
}
```

요청마다 인스턴스를 새로 만들어도 콜드 스타트가 없어, 상태 없는(stateless) 함수를 전 세계 엣지에 밀어 넣을 수 있다.

## 6. 플러그인 인터페이스 설계 원칙

```
1. 좁은 인터페이스: 플러그인에 노출하는 호스트 함수를 최소화
   (능력이 적을수록 안전 — Day 3의 능력 기반 보안)

2. 자원 한도 필수: 연료(CPU)·메모리·실행시간 상한을 항상 설정
   (악의 없는 버그도 호스트를 위협하므로)

3. 데이터 교환 최소화: 경계 횡단 비용(Day 2)을 고려해
   큰 페이로드는 메모리로 한 번에, 잦은 작은 호출은 피함

4. 버전 관리: WIT(Day 3)로 인터페이스를 명시해
   플러그인-호스트 호환성을 타입으로 보장

5. 컴포넌트 모델로 진화: 언어 중립 컴포넌트로 생태계 확장
```

## 7. Day 4 체크리스트

1. Wasm이 안전·다언어·고속·능력제어로 플러그인에 이상적임을 이해했다.
2. wasmtime을 호스트에 임베드해 플러그인을 로드·실행했다.
3. Store 분리로 멀티테넌트 인스턴스를 격리하고 테넌트별 자원을 할당했다.
4. Wasm의 마이크로초 콜드 스타트가 엣지 서버리스에 적합한 이유를 안다.
5. 좁은 인터페이스·자원 한도·교환 최소화의 플러그인 설계 원칙을 잡았다.

## 다음 편 예고

마지막 Day 5(시리즈 마무리)에서는 Wasm을 **프로덕션에 올리는 실전** — 빌드 최적화와 크기 줄이기, 디버깅·프로파일링, 그리고 언제 Wasm을 써야 하고 언제 쓰지 말아야 하는지를 정리한다.
