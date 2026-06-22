---
title: "[Rust 시스템] Day 2: 에러를 타입으로 - Result, Option, 그리고 ? 연산자"
date: 2026-06-23 00:00:00 +0900
categories: [Systems, Rust]
tags: ["Rust", "에러 처리", "Result", "Option", "panic", "thiserror", "anyhow"]
---

## 서론: 예외가 없는 언어의 에러 처리

Rust에는 예외(exception)가 없다. try/catch도, 던지고 어딘가에서 잡는 비지역 점프도 없다. 대신 에러를 **값**으로, 함수 시그니처에 드러나는 **타입**으로 다룬다. 호출자는 에러 가능성을 무시할 수 없고, 컴파일러가 처리를 강제한다. 이것이 시스템 소프트웨어의 견고함을 만든다.

## 1. Option: 값이 없을 수도 있음

null 대신 `Option<T>`로 "값이 있거나(`Some`) 없음(`None`)"을 타입에 담는다.

```rust
fn find_user(id: u32) -> Option<String> {
    if id == 1 { Some(String::from("alice")) } else { None }
}

fn main() {
    match find_user(1) {
        Some(name) => println!("찾음: {}", name),
        None => println!("없음"),
    }

    // 편의 메서드들
    let name = find_user(2).unwrap_or(String::from("guest"));
    let len  = find_user(1).map(|n| n.len());   // Option<usize>
    if let Some(n) = find_user(1) {             // 한 경우만 관심
        println!("{}", n);
    }
}
```

null 역참조가 언어 차원에서 불가능하다. "값이 없을 수 있음"을 다루지 않으면 컴파일되지 않는다.

## 2. Result: 성공 또는 실패

실패 이유가 있는 연산은 `Result<T, E>`를 반환한다.

```rust
use std::num::ParseIntError;

fn parse_port(s: &str) -> Result<u16, ParseIntError> {
    let n: u16 = s.parse()?;   // 실패 시 즉시 Err 반환
    Ok(n)
}

fn main() {
    match parse_port("8080") {
        Ok(port) => println!("포트: {}", port),
        Err(e)   => eprintln!("파싱 실패: {}", e),
    }
}
```

## 3. ? 연산자: 에러 전파의 핵심

`?`는 "성공이면 값을 꺼내고, 실패면 이 함수에서 즉시 `Err`를 반환"한다. 중첩 match를 평평하게 만든다.

```rust
use std::fs::File;
use std::io::{self, Read};

// ? 없이: 장황한 중첩
fn read_config_verbose() -> Result<String, io::Error> {
    let mut f = match File::open("config.toml") {
        Ok(f) => f,
        Err(e) => return Err(e),
    };
    let mut s = String::new();
    match f.read_to_string(&mut s) {
        Ok(_) => Ok(s),
        Err(e) => Err(e),
    }
}

// ? 사용: 의도가 한눈에
fn read_config() -> Result<String, io::Error> {
    let mut s = String::new();
    File::open("config.toml")?.read_to_string(&mut s)?;
    Ok(s)
}
```

## 4. 커스텀 에러 타입: thiserror

라이브러리는 호출자가 분기할 수 있도록 명확한 에러 타입을 정의한다. `thiserror`가 보일러플레이트를 없앤다.

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("파일을 읽을 수 없음: {0}")]
    Io(#[from] std::io::Error),        // io::Error를 자동 변환

    #[error("잘못된 형식: {0}")]
    Parse(#[from] toml::de::Error),

    #[error("필수 키 누락: {key}")]
    MissingKey { key: String },
}

fn load() -> Result<Config, ConfigError> {
    let text = std::fs::read_to_string("c.toml")?;  // io::Error → ConfigError
    let cfg: Config = toml::from_str(&text)?;        // toml 에러 → ConfigError
    Ok(cfg)
}
```

`#[from]` 덕분에 서로 다른 에러가 `?` 한 번으로 `ConfigError`로 자동 변환된다.

## 5. 애플리케이션 레벨: anyhow

라이브러리는 정밀한 타입이 필요하지만, 애플리케이션 최상단은 "어디서 왜 실패했나"의 맥락이 더 중요하다. `anyhow`가 적합하다.

```rust
use anyhow::{Context, Result};

fn run() -> Result<()> {
    let cfg = load_config()
        .context("설정 로드 실패")?;       // 실패 시 맥락 추가
    let conn = connect(&cfg.db_url)
        .with_context(|| format!("DB 연결 실패: {}", cfg.db_url))?;
    Ok(())
}
// 출력 예:
//   Error: DB 연결 실패: postgres://...
//   Caused by: connection refused
```

원칙: **라이브러리는 `thiserror`로 타입을, 애플리케이션은 `anyhow`로 맥락을** 택한다.

## 6. panic은 언제 쓰는가

`panic!`은 복구 불가능한 프로그래밍 오류를 위한 것이다. 정상적으로 발생할 수 있는 에러에는 쓰지 않는다.

```rust
// ✅ panic 적절: 깨질 수 없는 불변식이 깨짐 (= 버그)
let idx = compute_index();
assert!(idx < buffer.len(), "인덱스 계산 로직 버그");

// ✅ 프로토타입/테스트에서 빠르게
let port: u16 = "8080".parse().expect("리터럴이므로 항상 성공");

// ❌ panic 부적절: 외부 입력 실패는 Result로
let port: u16 = user_input.parse().unwrap();  // 사용자가 "abc" 입력 시 크래시
```

기준: **버그(불변식 위반)는 panic, 예상 가능한 실패(I/O·입력·네트워크)는 Result.** 라이브러리는 호출자 대신 패닉을 결정하지 않는다.

## 7. Day 2 체크리스트

1. `Option`으로 null 없이 "값 없음"을, `Result`로 실패를 타입에 담았다.
2. `?` 연산자로 에러 전파를 간결하게 작성했다.
3. `thiserror`로 라이브러리용 커스텀 에러를 `#[from]` 자동 변환과 함께 정의했다.
4. `anyhow`의 `.context()`로 애플리케이션 에러에 맥락을 붙였다.
5. panic(버그)과 Result(예상 실패)의 경계를 구분했다.

## 다음 편 예고

소유권 규칙은 단일 스레드만의 이야기가 아니다. Day 3에서는 그 "불변 다수 XOR 가변 단일" 규칙이 어떻게 **데이터 레이스 없는 동시성**으로 확장되는지 — `Send`/`Sync`, `Arc`, `Mutex`, 채널을 다룬다.
