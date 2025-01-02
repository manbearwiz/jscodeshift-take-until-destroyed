# jscodeshift-take-until-destroyed

[![npm](https://img.shields.io/npm/v/jscodeshift-take-until-destroyed?style=flat-square)](https://www.npmjs.com/package/jscodeshift-take-until-destroyed?activeTab=versions)
[![NPM](https://img.shields.io/npm/l/jscodeshift-take-until-destroyed?style=flat-square)](https://raw.githubusercontent.com/manbearwiz/jscodeshift-take-until-destroyed/master/LICENSE)
[![npm](https://img.shields.io/npm/dt/jscodeshift-take-until-destroyed?style=flat-square)](https://www.npmjs.com/package/jscodeshift-take-until-destroyed)
[![GitHub issues](https://img.shields.io/github/issues/manbearwiz/jscodeshift-take-until-destroyed?style=flat-square)](https://github.com/manbearwiz/jscodeshift-take-until-destroyed/issues)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release&style=flat-square)](https://github.com/semantic-release/semantic-release)

This codemod automates the migration to Angular's new `takeUntilDestroyed` operator. It replaces `takeUntil` with `takeUntilDestroyed`, removes the destroyed notifier argument, and adds a `DestroyRef` when required.

- [Installation](#installation)
- [Usage](#usage)
  - [Examples](#examples)
    - [`takeUntil(this.destroy$)` to `takeUntilDestroyed(this.destroyRef)`](#takeuntilthisdestroy-to-takeuntildestroyedthisdestroyref)
    - [`takeUntil(this.destroy$)` to `takeUntilDestroyed()`](#takeuntilthisdestroy-to-takeuntildestroyed)
- [Running Unit Tests](#running-unit-tests)
- [Contributing](#contributing)
- [License](#license)

## Installation

To install the codemod, use `npm` or `yarn`:

```bash
npm install --save-dev jscodeshift-take-until-destroyed
# or
yarn add --dev jscodeshift-take-until-destroyed
```

You'll also need [jscodeshift](https://github.com/facebook/jscodeshift), the framework powering this codemod:

```bash
npm install -g jscodeshift
```

## Usage

Run the codemod using the `jscodeshift` CLI and specify the path to the files you want to transform:

```bash
jscodeshift -t ./node_modules/jscodeshift-take-until-destroyed/src/take-until-destroyed.ts src
```

### Examples

#### `takeUntil(this.destroy$)` to `takeUntilDestroyed(this.destroyRef)`

When `takeUntil` is used with a `Subject` property, the codemod will replace it with `takeUntilDestroyed` and inject a `DestroyRef`.

**Before:**

```ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**After:**

```ts
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs/operators';

export class MyComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
  }
}
```

#### `takeUntil(this.destroy$)` to `takeUntilDestroyed()`

When `takeUntil` is called with a `Subject` property in a constructor or property initializer, the codemod replaces it with `takeUntilDestroyed` without injecting a `DestroyRef`.

**Before:**

```ts
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnDestroy {
  private destroy$ = new Subject<boolean>();
  private val$ = inject(ValService).obs$.pipe(takeUntil(this.destroy$));

  constructor() {
    obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**After:**

```ts
import { Component, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs/operators';

export class MyComponent {
  private val$ = inject(ValService).obs$.pipe(takeUntilDestroyed());

  constructor() {
    obs$.pipe(takeUntilDestroyed()).subscribe((x) => console.log(x));
  }
}
```

## Running Unit Tests

This repository includes a suite of unit tests to ensure consistent behavior across cases.

Run tests with:

```bash
npm install
npm test
```

## Contributing

Contributions are welcome! If you’d like to contribute, please fork the repository and submit a pull request.

1. Fork the project
2. Create a feature branch (`git checkout -b feature-name`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature-name`)
5. Open a pull request

Please make sure to update tests as appropriate.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
