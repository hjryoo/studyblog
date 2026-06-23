---
title: "[Rust 시스템] Day 3: 두려움 없는 동시성 - Send, Sync, 그리고 채널"
date: 2026-06-24 00:00:00 +0900
categories: [Systems, Rust]
tags: ["Rust", "동시성", "스레드", "Arc", "Mutex", "Send", "Sync", "채널"]
---

## 서론: 컴파일러가 데이터 레이스를 막는다

다른 언어에서 멀티스레드 버그는 재현조차 어렵다. 가끔만 터지고, 디버거를 붙이면 사라진다. Rust는 이 부류의 버그 대부분을 **컴파일 시점에** 잡는다. Day 1의 빌림 규칙("불변 다수 XOR 가변 단일")이 스레드 경계로 그대로 확장되기 때문이다. 그래서 "fearless concurrency(두려움 없는 동시성)"라 부른다.

## 1. 스레드 생성과 move

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3];

    // move: 클로저가 data의 소유권을 스레드로 가져간다
    let handle = thread::spawn(move || {
        println!("스레드에서: {:?}", data);
    });

    // println!("{:?}", data);  // ❌ data는 스레드로 이동됨
    handle.join().unwrap();      // 스레드 종료 대기
}
```

`move`가 없으면 컴파일러는 "data가 main과 새 스레드 중 누가 먼저 끝날지 모른다"며 거부한다. 소유권 이전으로 이 모호함을 없앤다.

## 2. Send와 Sync: 안전성의 두 마커

Rust의 동시성 안전은 두 마커 트레이트에 기반한다.

```
Send:  이 타입의 값을 다른 스레드로 "이동"해도 안전한가?
       (대부분의 타입이 Send. Rc는 Send 아님 — 카운터가 비원자적)

Sync:  이 타입의 참조(&T)를 여러 스레드가 "공유"해도 안전한가?
       (T가 Sync면 &T가 Send)
```

핵심은 이 마커가 **자동으로 추론**되고, 위반 시 컴파일이 막힌다는 것이다. `Rc<T>`를 스레드로 넘기려 하면:

```rust
use std::rc::Rc;
let rc = Rc::new(5);
thread::spawn(move || println!("{}", rc));
// ❌ `Rc<i32>` cannot be sent between threads safely
//    (Rc는 참조 카운트를 원자적으로 갱신하지 않아 레이스 발생 가능)
```

컴파일러가 정확한 이유까지 알려준다.

## 3. Arc + Mutex: 스레드 간 상태 공유

여러 스레드가 한 값을 공유하려면 `Arc`(원자적 참조 카운트)로 소유권을, `Mutex`로 배타적 접근을 보장한다.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // Arc: 여러 스레드가 소유권 공유 / Mutex: 한 번에 하나만 수정
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let c = Arc::clone(&counter);   // 카운트만 증가, 데이터 복제 아님
        handles.push(thread::spawn(move || {
            let mut num = c.lock().unwrap();  // 락 획득
            *num += 1;
        }));   // 스코프 종료 시 락 자동 해제 (RAII)
    }

    for h in handles { h.join().unwrap(); }
    println!("결과: {}", *counter.lock().unwrap());  // 항상 10
}
```

핵심은 `lock()`이 반환한 가드가 스코프를 벗어나면 **자동으로 언락**된다는 것이다. C에서 흔한 "언락 깜빡함"이 구조적으로 불가능하다. 또한 락을 거치지 않고는 `Mutex` 내부 값에 접근할 방법 자체가 없다.

## 4. 메시지 패싱: 공유하지 말고 통신하라

상태 공유보다 채널로 소유권을 넘기는 편이 더 안전하고 추론하기 쉬울 때가 많다.

```rust
use std::sync::mpsc;   // multi-producer, single-consumer
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    // 여러 생산자
    for id in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || {
            tx.send(format!("worker {} 완료", id)).unwrap();
            // send는 소유권을 넘긴다 — 보낸 뒤엔 접근 불가
        });
    }
    drop(tx);   // 원본 송신자를 닫아야 rx 반복이 종료됨

    // 단일 소비자: 채널이 닫힐 때까지 수신
    for msg in rx {
        println!("받음: {}", msg);
    }
}
```

"메모리를 공유해 통신하지 말고, 통신해서 메모리를 공유하라"는 원칙을 타입 시스템이 강제한다. `send`된 값은 소유권이 넘어가 송신 측에서 더는 만질 수 없다.

## 5. 읽기가 많을 때: RwLock

읽기는 동시에, 쓰기는 배타적으로 허용하려면 `RwLock`을 쓴다.

```rust
use std::sync::{Arc, RwLock};

let config = Arc::new(RwLock::new(load_config()));

// 여러 스레드가 동시에 읽기
let r = config.read().unwrap();
println!("{}", r.timeout);

// 쓰기는 단독 — 모든 읽기가 끝나야 획득
let mut w = config.write().unwrap();
w.timeout = 30;
```

읽기 빈도가 압도적으로 높은 설정·캐시에 적합하다. 단, 쓰기 기아(writer starvation)에 주의한다.

## 6. 데이터 병렬: rayon

CPU 바운드 작업을 여러 코어로 펼치는 가장 쉬운 길은 `rayon`이다.

```rust
use rayon::prelude::*;

fn main() {
    let data: Vec<u64> = (0..1_000_000).collect();

    // .iter()를 .par_iter()로 바꾸면 자동 병렬화
    let sum: u64 = data.par_iter()
        .filter(|&&x| x % 3 == 0)
        .map(|&x| x * x)
        .sum();

    println!("{}", sum);
}
```

`iter` → `par_iter` 한 글자 차이로 여러 코어를 쓴다. 그러면서도 빌림 규칙이 데이터 레이스를 막아주므로 lock 고민이 거의 없다.

## 7. Day 3 체크리스트

1. `move` 클로저로 스레드에 소유권을 안전하게 이전했다.
2. `Send`/`Sync`가 자동 추론되고 위반을 컴파일러가 거부함을 이해했다.
3. `Arc<Mutex<T>>`로 상태를 공유하고, 락이 RAII로 자동 해제됨을 확인했다.
4. `mpsc` 채널로 소유권을 넘기는 메시지 패싱을 구현했다.
5. `RwLock`과 `rayon`으로 읽기 위주·CPU 병렬 상황에 맞는 도구를 선택했다.

## 다음 편 예고

스레드는 동시 작업의 한 방법일 뿐이다. 수만 개의 연결을 다루는 네트워크 서버에는 더 가벼운 모델이 필요하다. Day 4에서는 **async/await와 Tokio 런타임**으로 비동기 I/O를 다룬다.
