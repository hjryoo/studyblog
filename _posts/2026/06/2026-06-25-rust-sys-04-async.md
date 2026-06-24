---
title: "[Rust 시스템] Day 4: async/await와 Tokio - 수만 개의 연결을 한 줌의 스레드로"
date: 2026-06-25 00:00:00 +0900
categories: [Systems, Rust]
tags: ["Rust", "async", "await", "Tokio", "Future", "비동기", "네트워크"]
---

## 서론: 스레드만으로는 부족하다

연결마다 스레드를 하나씩 쓰면 수만 개의 동시 연결에서 메모리와 컨텍스트 스위칭이 무너진다. 비동기 모델은 "기다리는 동안" 스레드를 다른 작업에 양보해, 소수의 OS 스레드로 수만 개의 작업을 굴린다. Rust의 `async`/`await`는 이 비동기 코드를 동기 코드처럼 쓰게 하면서, Day 1~3의 안전 보장을 그대로 유지한다.

## 1. Future: 아직 끝나지 않은 값

`async fn`은 호출 즉시 실행되지 않는다. **Future**(미래에 완료될 계산)를 반환할 뿐이다.

```rust
// async fn은 Future를 반환한다 (이 자체로는 아무것도 실행 안 됨)
async fn fetch_data() -> u32 {
    42
}

#[tokio::main]
async fn main() {
    let fut = fetch_data();   // Future 생성만 — 본문 실행 안 됨
    let value = fut.await;    // .await에서 비로소 실행되고 완료를 기다림
    println!("{}", value);
}
```

핵심: Future는 **게으르다(lazy)**. `.await`하거나 런타임에 spawn해야 실제로 진행된다. 이것이 JS의 Promise(생성 즉시 시작)와 다른 점이다.

## 2. .await의 의미: 양보 지점

`.await`는 "여기서 결과가 필요하지만, 아직 준비 안 됐으면 스레드를 양보하겠다"는 뜻이다.

```rust
use tokio::time::{sleep, Duration};

async fn handle() {
    println!("시작");
    sleep(Duration::from_secs(1)).await;  // 1초 대기 — 스레드는 다른 작업으로
    println!("1초 후");
}
```

`sleep().await` 동안 OS 스레드는 블로킹되지 않고 런타임이 다른 Future를 실행한다. 그래서 적은 스레드로 많은 동시 작업이 가능하다.

## 3. Tokio 런타임과 동시 실행

Future를 실제로 굴리는 것이 런타임이다. Tokio가 사실상 표준이다.

```rust
use tokio::task;

#[tokio::main]
async fn main() {
    // spawn: Future를 런타임에 올려 동시 실행
    let h1 = task::spawn(async { expensive(1).await });
    let h2 = task::spawn(async { expensive(2).await });

    // 둘 다 동시에 진행되고, 결과를 모은다
    let (r1, r2) = (h1.await.unwrap(), h2.await.unwrap());
    println!("{} {}", r1, r2);
}
```

여러 Future를 동시에 기다릴 땐 `join!`(모두 완료)과 `select!`(가장 먼저 완료된 하나)를 쓴다.

```rust
use tokio::select;

async fn with_timeout() {
    select! {
        result = fetch() => println!("응답: {:?}", result),
        _ = sleep(Duration::from_secs(5)) => println!("타임아웃"),
    }
}
```

## 4. 실전: 비동기 TCP 에코 서버

비동기의 진가는 네트워크 서버에서 드러난다.

```rust
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("listening on :8080");

    loop {
        let (mut socket, addr) = listener.accept().await?;

        // 연결마다 가벼운 task를 spawn — OS 스레드가 아니다
        tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            loop {
                let n = match socket.read(&mut buf).await {
                    Ok(0) => return,             // 연결 종료
                    Ok(n) => n,
                    Err(_) => return,
                };
                // 받은 데이터를 그대로 되돌려 보냄
                if socket.write_all(&buf[..n]).await.is_err() {
                    return;
                }
            }
        });
    }
}
```

`tokio::spawn`이 만드는 task는 OS 스레드보다 훨씬 가벼워, 수만 개의 동시 연결도 소수의 스레드 위에서 처리된다.

## 5. 비동기에서의 공유 상태

async에서도 상태 공유는 `Arc`로 한다. 단, 락은 **비동기 버전**을 쓴다.

```rust
use std::sync::Arc;
use tokio::sync::Mutex;   // std::sync::Mutex가 아님!

#[derive(Clone)]
struct Server { conns: Arc<Mutex<u64>> }

impl Server {
    async fn on_connect(&self) {
        let mut n = self.conns.lock().await;  // .await로 락 대기
        *n += 1;
    }
}
```

> **주의**: 표준 `std::sync::Mutex`를 들고 `.await`를 넘으면 그 스레드가 락을 쥔 채 다른 task로 양보해 교착이 날 수 있다. `.await`를 가로지르는 락은 반드시 `tokio::sync::Mutex`를 쓴다. 락 구간이 짧고 await가 없다면 std Mutex가 더 빠르다.

## 6. 블로킹 코드와 섞기

CPU를 오래 쓰거나 동기 블로킹하는 작업을 async task 안에서 그대로 돌리면 런타임 전체가 멈춘다.

```rust
// ❌ async task 안에서 무거운 동기 작업 → 런타임의 다른 task가 굶음
async fn bad() { heavy_cpu_work(); }

// ✅ 전용 블로킹 스레드 풀로 격리
async fn good() {
    let result = tokio::task::spawn_blocking(|| {
        heavy_cpu_work()   // 별도 스레드에서 실행
    }).await.unwrap();
}
```

원칙: **async 런타임 위에서는 절대 블로킹하지 않는다.** 동기 작업은 `spawn_blocking`으로 격리한다.

## 7. Day 4 체크리스트

1. `async fn`이 게으른 Future를 반환하고, `.await`에서 비로소 진행됨을 이해했다.
2. `.await`가 스레드를 양보하는 지점이라 소수 스레드로 많은 작업이 가능함을 파악했다.
3. `tokio::spawn`·`join!`·`select!`로 동시 실행과 타임아웃을 구성했다.
4. 비동기 TCP 서버에서 연결마다 가벼운 task를 띄웠다.
5. `.await`를 넘는 락은 `tokio::sync::Mutex`, 무거운 동기 작업은 `spawn_blocking`으로 격리하는 규칙을 익혔다.

## 다음 편 예고

지금까지는 안전한 고수준 Rust였다. 마지막 Day 5(시리즈 마무리)에서는 그 반대편 — `unsafe`, FFI로 C와 연동하기, 그리고 OS도 힙도 없는 **임베디드 `no_std`** 환경에서 Rust를 쓰는 법을 다룬다.
