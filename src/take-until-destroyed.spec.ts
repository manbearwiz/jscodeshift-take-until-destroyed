import { applyTransform } from 'jscodeshift/src/testUtils';
import { describe, expect, it } from 'vitest';
import * as transform from './take-until-destroyed';

const t = (source: string) => applyTransform(transform, {}, { source }, {});

describe('take-until-destroyed transformation', () => {
  it('should transform takeUntil(this.destroy$) to takeUntilDestroyed(this.destroyRef)', () => {
    expect(
      t(`
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
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, inject, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';

      export class MyComponent implements OnInit {
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit(): void {
         this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }
      }"
    `);
  });

  it('should handle multiple destroy properties with different names', () => {
    expect(
      t(`
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnInit, OnDestroy {
  destroy1$ = new Subject<void>();
  public someOtherDestroy$ = new Subject<boolean>();
  private val$ = inject(ValService).obs$.pipe(takeUntil(this.destroy1$));

  ngOnInit(): void {
   this.obs2$.pipe(takeUntil(this.someOtherDestroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy1$.next();
    this.destroy1$.complete();
    this.someOtherDestroy$.next();
    this.someOtherDestroy$.complete();
  }
}
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, inject, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';

      export class MyComponent implements OnInit {
        private readonly destroyRef = inject(DestroyRef);
        private val$ = inject(ValService).obs$.pipe(takeUntilDestroyed());

        ngOnInit(): void {
         this.obs2$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }
      }"
    `);
  });

  it('should not add a destroyRef property if takeUntilDestroyed is only used in the constructor and property initializer', () => {
    expect(
      t(`
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnDestroy {
  private _X$ = new Subject<boolean>();
  private val$ = inject(ValService).obs$.pipe(takeUntil(this._X$));

  constructor() {
    obs$.pipe(takeUntil(this._X$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this._X$.next();
    this._X$.complete();
  }
}
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, inject, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';

      export class MyComponent {
        private val$ = inject(ValService).obs$.pipe(takeUntilDestroyed());

        constructor() {
          obs$.pipe(takeUntilDestroyed()).subscribe((x) => console.log(x));
        }
      }"
    `);
  });

  it('should handle multiple classes in the same file', () => {
    expect(
      t(`
import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
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

export class MyOtherComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();

  ngOnInit(): void {
   this.obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, inject, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

      export class MyComponent implements OnInit {
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit(): void {
         this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }
      }

      export class MyOtherComponent implements OnInit {
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit(): void {
         this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }
      }"
    `);
  });

  it('should handle multiple takeUntil calls in the multiple methods', () => {
    expect(
      t(`
import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnDestroy {
  destroy$ = new Subject<void>();

  method1(): void {
   this.obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  method2(): void {
   this.obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
      }`),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, inject, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';

      export class MyComponent {
       private readonly destroyRef = inject(DestroyRef);

       method1(): void {
        this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
       }

       method2(): void {
        this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
       }
      }"
    `);
  });

  it('should not remove ngOnDestroy method if it is not empty', () => {
    expect(
      t(`
import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();

  ngOnInit(): void {
   this.obs$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    console.log('destroying');
    this.destroy$.next();
    this.destroy$.complete();
  }
}
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';

      export class MyComponent implements OnInit, OnDestroy {
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit(): void {
         this.obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }

        ngOnDestroy(): void {
          console.log('destroying');
        }
      }"
    `);
  });

  it('should handle a mix of takeUntil and takeUntilDestroyed calls', () => {
    expect(
      t(`
import { Component, OnDestroy, OnInit } from '@angular/core';
import { takeUntil, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';

export class MyComponent implements OnInit, OnDestroy {
  destroy$ = new Subject<void>();
  someUnrelated$ = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.someUnrelated$.subscribe(() => console.log('unrelated'));
    this.obs1$.pipe(takeUntil(this.destroy$)).subscribe((x) => console.log(x));
    this.obs2$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
      `),
    ).toMatchInlineSnapshot(`
      "import { Component, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs/operators';
      import { Subject } from 'rxjs';

      export class MyComponent implements OnInit {
        someUnrelated$ = new Subject<void>();
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit(): void {
          this.someUnrelated$.subscribe(() => console.log('unrelated'));
          this.obs1$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
          this.obs2$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((x) => console.log(x));
        }
      }"
    `);
  });

  it('should handle destroy property initialized in the constructor', () => {
    expect(
      t(`
import { Component, Input, OnDestroy, OnInit, forwardRef } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { Subject, tap } from 'rxjs';

@Component()
export class MyComponent implements OnInit, OnDestroy {
  private readonly unsubscribe$: Subject<void>;

  constructor() {
    this.unsubscribe$ = new Subject<void>();
  }

  ngOnInit() {
    this.trigger$?.pipe(tap(x => console.log(x)), takeUntil(this.unsubscribe$)).subscribe(() => doSomething());
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
`),
    ).toMatchInlineSnapshot(`
      "import { Component, DestroyRef, forwardRef, inject, Input, OnInit } from '@angular/core';
      import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
      import { tap } from 'rxjs';

      @Component()
      export class MyComponent implements OnInit {
        private readonly destroyRef = inject(DestroyRef);

        ngOnInit() {
          this.trigger$?.pipe(tap(x => console.log(x)), takeUntilDestroyed(this.destroyRef)).subscribe(() => doSomething());
        }
      }"
    `);
  });
});
