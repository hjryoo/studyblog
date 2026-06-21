---
title: "[Rust 시스템] Day 1: 소유권과 라이프타임 - 가비지 컬렉터 없이 메모리를 지키는 법"
date: 2026-06-22 00:00:00 +0900
categories: [Systems, Rust]
tags: ["Rust", "소유권", "라이프타임", "Borrow Checker", "메모리 안전성", "시스템 프로그래밍"]
---

## 서론: GC도 수동 해제도 아닌 제3의 길

C는 빠르지만 메모리를 직접 해제하다 use-after-free와 이중 해제를 낸다. Java·Go는 GC로 안전하지만 런타임 일시정지와 오버헤드를 감수한다. Rust는 제3의 길을 택했다. **컴파일 시점에** 누가 메모리를 소유하고 언제 해제되는지를 검증해, 런타임 비용 없이 메모리 안전을 보장한다. 이 시리즈는 그 핵심인 소유권부터 시작해 임베디드까지 5일에 걸쳐 다룬다.

## 1. 소유권의 세 규칙

```rust
fn main() {
    // 규칙 1: 모든 값은 정확히 하나의 소유자(변수)를 가진다
    let s = String::from("hello");

    // 규칙 2: 소유자가 스코프를 벗어나면 값은 자동 해제(drop)된다
    {
        let temp = String::from("world");
        // temp가 여기서 drop됨 — free() 호출 불필요
    }

    // 규칙 3: 값을 다른 변수에 대입하면 소유권이 "이동(move)"한다
    let s2 = s;
    // println!("{}", s);  // ❌ 컴파일 에러: s는 더 이상 유효하지 않음
    println!("{}", s2);    // ✅ 이제 s2가 소유자
}
```

`s2 = s` 이후 `s`를 쓰면 컴파일조차 되지 않는다. C였다면 두 포인터가 같은 메모리를 가리키다 둘 다 해제하는 이중 해제 버그였을 것을, Rust는 컴파일러가 막는다.

## 2. 빌림(Borrowing): 소유권을 넘기지 않고 빌려주기

매번 소유권을 넘기면 불편하다. 참조(`&`)로 잠시 빌린다.

```rust
fn main() {
    let mut v = vec![1, 2, 3];

    // 불변 빌림: 여러 개 동시 가능
    let r1 = &v;
    let r2 = &v;
    println!("{:?} {:?}", r1, r2);

    // 가변 빌림: 단 하나만, 그동안 불변 빌림 불가
    let m = &mut v;
    m.push(4);

    // 핵심 규칙: "여러 reader OR 단 하나의 writer" (동시 불가)
    // 이것이 데이터 레이스를 컴파일 시점에 차단한다
}
```

이 규칙(불변 다수 XOR 가변 단일)은 멀티스레드의 데이터 레이스를 근본적으로 막는다. Day 3에서 이 보장이 동시성으로 그대로 확장된다.

## 3. Borrow Checker가 막는 실수

```rust
fn dangle() -> &String {       // ❌ 컴파일 에러
    let s = String::from("x");
    &s                          // s는 함수 끝에서 drop됨 → 댕글링 참조
}
```

C에서 지역 변수 주소를 반환하면 댕글링 포인터가 되어 런타임에 터진다. Rust는 "이 참조가 가리키는 값이 참조보다 먼저 사라진다"를 컴파일 시점에 잡는다.

## 4. 라이프타임: 참조가 사는 기간

대부분의 라이프타임은 컴파일러가 추론한다. 하지만 함수가 여러 참조를 받아 참조를 반환하면 관계를 명시해야 한다.

```rust
// 'a: 두 입력과 반환값이 같은 라이프타임을 공유함을 명시
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("short");
        result = longest(s1.as_str(), s2.as_str());
        println!("{}", result);   // ✅ s2가 살아있는 동안 사용
    }
    // println!("{}", result);    // ❌ s2가 drop됨 → result도 무효
}
```

`'a`는 "반환된 참조는 두 입력 중 짧은 쪽만큼만 유효하다"는 계약이다. 컴파일러는 이 계약을 어기는 사용을 거부한다.

## 5. 구조체에 참조를 담을 때

```rust
// 구조체가 참조를 가지면 라이프타임 파라미터가 필수
struct Parser<'a> {
    input: &'a str,    // 이 Parser는 input보다 오래 살 수 없다
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Parser { input, pos: 0 }
    }

    fn peek(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }
}
```

빌린 데이터를 들고 다니는 구조체는 시스템 프로그래밍에서 흔하다(파서, 슬라이스 뷰 등). 라이프타임이 "이 뷰는 원본 데이터보다 오래 못 산다"를 강제해 댕글링을 막는다.

## 6. 언제 클론하고 언제 빌릴까

```rust
fn process(data: &[u8]) -> usize {     // 빌림: 읽기만 하면 참조
    data.iter().filter(|&&b| b > 128).count()
}

fn take_owned(data: Vec<u8>) -> Vec<u8> {  // 소유: 변형해서 돌려줄 때
    data.into_iter().map(|b| b.wrapping_add(1)).collect()
}
```

원칙: **읽기만 하면 `&T`로 빌리고, 소유가 필요할 때만 받는다.** 빌림이 안 풀려 컴파일이 막힐 때 `.clone()`은 마지막 수단이다. 무심한 클론은 Rust의 성능 이점을 깎아먹는다.

## 7. Day 1 체크리스트

1. 소유권 3규칙(단일 소유자 · 스코프 종료 시 drop · 대입 시 move)을 이해했다.
2. 빌림 규칙(불변 다수 XOR 가변 단일)이 데이터 레이스를 막는 원리를 설명할 수 있다.
3. Borrow Checker가 댕글링 참조를 컴파일 시점에 거부함을 확인했다.
4. 함수·구조체에서 라이프타임 파라미터가 필요한 경우를 구분했다.
5. 빌림을 우선하고 클론을 남발하지 않는 습관을 잡았다.

## 다음 편 예고

소유권 다음으로 Rust를 떠받치는 기둥은 에러 처리다. Day 2에서는 `Result`·`Option`과 `?` 연산자, 그리고 `panic`을 언제 써야 하는지 — 예외 없이 에러를 타입으로 다루는 법을 살펴본다.
