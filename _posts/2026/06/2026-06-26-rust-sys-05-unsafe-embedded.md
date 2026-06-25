---
title: "[Rust 시스템] Day 5: unsafe, FFI, no_std - 추상화의 밑바닥으로 내려가기"
date: 2026-06-26 00:00:00 +0900
categories: [Systems, Rust]
tags: ["Rust", "unsafe", "FFI", "no_std", "임베디드", "C 연동", "시스템 프로그래밍"]
---

## 서론: 안전한 추상화의 안쪽

Day 1~4에서 본 Rust의 안전 보장은 결국 어딘가에서 하드웨어·OS·C 라이브러리와 만나야 한다. 그 경계가 `unsafe`다. unsafe는 "Rust를 끄는 것"이 아니라 "컴파일러가 검증할 수 없는 불변식을 내가 책임진다"는 선언이다. 마지막 편은 이 밑바닥 — unsafe, C 연동(FFI), 그리고 OS도 힙도 없는 임베디드 환경을 다룬다.

## 1. unsafe가 실제로 푸는 것

unsafe 블록에서도 빌림 검사와 타입 검사는 그대로 작동한다. unsafe가 추가로 허용하는 것은 딱 다섯 가지다.

```
1. 원시 포인터(*const T, *mut T) 역참조
2. unsafe 함수·메서드 호출 (FFI 포함)
3. 가변 static 변수 접근·수정
4. unsafe 트레이트 구현
5. union 필드 접근
```

```rust
let mut num = 5;
let r1 = &num as *const i32;       // 원시 포인터 생성은 안전
let r2 = &mut num as *mut i32;

unsafe {
    // 역참조만 unsafe — 유효성은 내가 보장
    println!("{}", *r1);
    *r2 = 10;
}
```

원칙: **unsafe 블록은 최소 범위로 좁히고, 그 위에 안전한 인터페이스를 씌운다.** unsafe를 호출자에게 노출하지 않는 것이 좋은 추상화다.

## 2. 안전한 추상화로 감싸기

표준 라이브러리의 `Vec`·`String`도 내부는 unsafe다. 핵심은 그것을 안전한 API로 감싸는 것이다.

```rust
/// 슬라이스를 두 가변 참조로 나눈다 (표준 split_at_mut의 단순화)
fn split_at_mut(slice: &mut [i32], mid: usize) -> (&mut [i32], &mut [i32]) {
    let len = slice.len();
    let ptr = slice.as_mut_ptr();
    assert!(mid <= len);   // 불변식을 런타임에 확인

    unsafe {
        // 컴파일러는 "한 슬라이스를 두 번 가변 빌림"으로 보지만,
        // 두 영역이 겹치지 않음을 mid 검사로 우리가 보장한다
        (
            std::slice::from_raw_parts_mut(ptr, mid),
            std::slice::from_raw_parts_mut(ptr.add(mid), len - mid),
        )
    }
}
// 호출자는 unsafe를 전혀 모른 채 안전하게 쓴다
```

`assert!`로 불변식을 지키고, unsafe를 함수 안에 가두어 외부에는 안전한 시그니처만 보인다.

## 3. FFI: C 함수 호출하기

C 라이브러리를 부르려면 `extern "C"`로 시그니처를 선언한다.

```rust
use std::os::raw::c_int;

// C 표준 라이브러리의 abs 선언
extern "C" {
    fn abs(input: c_int) -> c_int;
}

fn main() {
    // 외부 함수 호출은 항상 unsafe (C 측 계약을 컴파일러가 못 봄)
    let result = unsafe { abs(-42) };
    println!("{}", result);
}
```

복잡한 C 헤더는 손으로 쓰지 않고 `bindgen`으로 자동 생성한다.

```bash
# C 헤더 → Rust FFI 바인딩 자동 생성
bindgen wrapper.h -o bindings.rs
```

## 4. FFI: Rust 함수를 C에 노출하기

반대로 Rust를 C(또는 파이썬·Go 등)에서 부르게 할 수도 있다.

```rust
/// C ABI로 노출 — 이름 맹글링을 끄고 C가 부를 수 있게 한다
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

// 문자열·포인터를 주고받을 땐 메모리 소유권 규약을 명시해야 한다
use std::ffi::CStr;
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn greet_len(name: *const c_char) -> usize {
    if name.is_null() { return 0; }
    // C 문자열의 수명·유효성은 호출자가 보장한다는 계약
    let s = unsafe { CStr::from_ptr(name) };
    s.to_bytes().len()
}
```

```toml
# Cargo.toml — C에서 링크할 정적/동적 라이브러리 빌드
[lib]
crate-type = ["cdylib", "staticlib"]
```

FFI 경계에서는 누가 메모리를 할당하고 해제하는지(소유권 규약)를 문서로 못박는 것이 가장 중요하다. 여기서 실수하면 Rust 측 안전 보장이 무의미해진다.

## 5. no_std: OS도 힙도 없는 세계

마이크로컨트롤러에는 OS도, 동적 메모리 할당도 없다. `#![no_std]`로 표준 라이브러리를 빼고 `core`만 쓴다.

```rust
#![no_std]    // std 제거 — 힙·OS·스레드 없음
#![no_main]   // OS의 main 진입점 없음

use core::panic::PanicInfo;

// panic 시 동작을 직접 정의해야 한다 (std가 없으므로)
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}   // 무한 루프로 정지 (실제론 리셋·로그 등)
}

// 임베디드 진입점 (예: cortex-m-rt)
#[cortex_m_rt::entry]
fn main() -> ! {
    let mut x: u32 = 0;
    loop {
        x = x.wrapping_add(1);   // 오버플로우를 명시적으로 처리
    }
}
```

`no_std`에서도 소유권·빌림·`Result`는 그대로다. `Vec`·`String`처럼 힙이 필요한 타입만 사라진다(필요하면 `alloc` 크레이트로 일부 복원).

## 6. 임베디드 HAL: 레지스터를 타입으로

베어메탈에서도 Rust는 하드웨어 레지스터 접근을 타입 안전하게 감싼다.

```rust
use embedded_hal::digital::OutputPin;

// HAL이 GPIO 레지스터 조작을 안전한 메서드로 추상화
fn blink<P: OutputPin>(led: &mut P, delay: &mut impl DelayMs<u32>) {
    loop {
        led.set_high().ok();   // 레지스터 직접 조작은 HAL 내부 unsafe
        delay.delay_ms(500);
        led.set_low().ok();
        delay.delay_ms(500);
    }
}
```

레지스터 비트를 직접 만지는 unsafe는 HAL 라이브러리 안에 갇히고, 애플리케이션은 `set_high()` 같은 안전한 메서드만 쓴다. Day 2의 "unsafe를 안전 인터페이스로 감싼다"가 임베디드에서도 그대로 적용된다.

## 7. 시리즈 종합 체크리스트

1. 소유권·빌림·라이프타임으로 GC 없이 메모리 안전을 얻었다. (Day 1)
2. `Result`/`Option`/`?`로 에러를 타입으로 다루고 panic의 경계를 정했다. (Day 2)
3. `Send`/`Sync`·`Arc`/`Mutex`·채널로 데이터 레이스 없는 동시성을 구현했다. (Day 3)
4. `async`/`await`·Tokio로 소수 스레드 위에 수만 작업을 올렸다. (Day 4)
5. unsafe·FFI·no_std로 추상화 밑바닥에서 C·하드웨어와 안전하게 연동했다. (Day 5)

## 시리즈 마무리

Rust의 핵심 통찰은 하나다. **안전성과 성능은 트레이드오프가 아니라, 컴파일러에게 더 많은 정보를 주면 둘 다 얻을 수 있다.** 소유권은 그 정보의 언어다. 고수준 async 서버부터 베어메탈 펌웨어까지, 같은 규칙이 일관되게 작동한다.

기초(소유권)→견고함(에러)→동시성→비동기→밑바닥(unsafe·임베디드) 다섯 단계를 거치면, "빠르면서 동시에 안전한" 시스템 소프트웨어를 두려움 없이 작성하는 토대를 갖추게 된다.
