import * as Rx from '../dist/cjs/Rx';
import {DoneSignature} from './helpers/test-helper';

const Subscriber = Rx.Subscriber;
const Observable = Rx.Observable;

declare const __root__: any;

function expectFullObserver(val) {
  expect(typeof val).toBe('object');
  expect(typeof val.next).toBe('function');
  expect(typeof val.error).toBe('function');
  expect(typeof val.complete).toBe('function');
  expect(typeof val.isUnsubscribed).toBe('boolean');
}

/** @test {Observable} */
describe('Observable', () => {
  it('should be constructed with a subscriber function', (done: DoneSignature) => {
    const source = new Observable(function (observer) {
      expectFullObserver(observer);
      observer.next(1);
      observer.complete();
    });

    source.subscribe(function (x) { expect(x).toBe(1); }, null, done);
  });

  describe('forEach', () => {
    it('should iterate and return a Promise', (done: DoneSignature) => {
      const expected = [1, 2, 3];
      const result = Observable.of(1, 2, 3).forEach(function (x) {
        expect(x).toBe(expected.shift());
      }, Promise)
      .then(done);

      expect(typeof result.then).toBe('function');
    });

    it('should reject promise when in error', (done: DoneSignature) => {
      Observable.throw('bad').forEach((x: any) => {
        done.fail('should not be called');
      }, Promise).then(() => {
        done.fail('should not complete');
      }, (err: any) => {
        expect(err).toBe('bad');
        done();
      });
    });

    it('should allow Promise to be globally configured', (done: DoneSignature) => {
      let wasCalled = false;

      __root__.Rx = {};
      __root__.Rx.config = {};
      __root__.Rx.config.Promise = function MyPromise(callback) {
        wasCalled = true;
        return new Promise(callback);
      };

      Observable.of(42).forEach((x: number) => {
        expect(x).toBe(42);
      }, null).then(() => {
        expect(wasCalled).toBe(true);
        done();
      });
    });

    it('should reject promise if nextHandler throws', (done: DoneSignature) => {
      const results = [];
      Observable.of(1, 2, 3).forEach((x: number) => {
        if (x === 3) {
          throw new Error('NO THREES!');
        }
        results.push(x);
      }, null)
      .then(<any>done.fail, function (err) {
        expect(err).toEqual(new Error('NO THREES!'));
        expect(results).toEqual([1, 2]);
      })
      .then(done);
    });
  });

  describe('subscribe', () => {
    it('should be synchronous', () => {
      let subscribed = false;
      let nexted;
      let completed;
      const source = new Observable((observer: Rx.Observer<string>) => {
        subscribed = true;
        observer.next('wee');
        expect(nexted).toBe('wee');
        observer.complete();
        expect(completed).toBe(true);
      });

      expect(subscribed).toBe(false);

      let mutatedByNext = false;
      let mutatedByComplete = false;

      source.subscribe((x: string) => {
        nexted = x;
        mutatedByNext = true;
      }, null, () => {
        completed = true;
        mutatedByComplete = true;
      });

      expect(mutatedByNext).toBe(true);
      expect(mutatedByComplete).toBe(true);
    });

    it('should work when subscribe is called with no arguments', () => {
      const source = new Observable((subscriber: Rx.Subscriber<string>) => {
        subscriber.next('foo');
        subscriber.complete();
      });

      source.subscribe();
    });

    it('should return a Subscription that calls the unsubscribe function returned by the subscriber', () => {
      let unsubscribeCalled = false;

      const source = new Observable(() => {
        return () => {
          unsubscribeCalled = true;
        };
      });

      const sub = source.subscribe(() => {
        //noop
       });
      expect(sub instanceof Rx.Subscription).toBe(true);
      expect(unsubscribeCalled).toBe(false);
      expect(typeof sub.unsubscribe).toBe('function');

      sub.unsubscribe();
      expect(unsubscribeCalled).toBe(true);
    });

    it('should run unsubscription logic when an error is thrown sending messages synchronously', () => {
      let messageError = false;
      let messageErrorValue = false;
      let unsubscribeCalled = false;

      let sub;
      const source = new Observable((observer: Rx.Observer<string>) => {
        observer.next('boo!');
        return () => {
          unsubscribeCalled = true;
        };
      });

      try {
        sub = source.subscribe((x: string) => { throw x; });
      } catch (e) {
        messageError = true;
        messageErrorValue = e;
      }

      expect(sub).toBe(undefined);
      expect(unsubscribeCalled).toBe(true);
      expect(messageError).toBe(true);
      expect(messageErrorValue).toBe('boo!');
    });

    it('should dispose of the subscriber when an error is thrown sending messages synchronously', () => {
      let messageError = false;
      let messageErrorValue = false;
      let unsubscribeCalled = false;

      let sub;
      const subscriber = new Subscriber((x: string) => { throw x; });
      const source = new Observable((observer: Rx.Observer<string>) => {
        observer.next('boo!');
        return () => {
          unsubscribeCalled = true;
        };
      });

      try {
        sub = source.subscribe(subscriber);
      } catch (e) {
        messageError = true;
        messageErrorValue = e;
      }

      expect(sub).toBe(undefined);
      expect(subscriber.isUnsubscribed).toBe(true);
      expect(unsubscribeCalled).toBe(true);
      expect(messageError).toBe(true);
      expect(messageErrorValue).toBe('boo!');
    });

    describe('when called with an anonymous observer', () => {
      it('should accept an anonymous observer with just a next function and call the next function in the context' +
        ' of the anonymous observer', (done: DoneSignature) => {
        //intentionally not using lambda to avoid typescript's this context capture
        const o = {
          next: function next(x) {
            expect(this).toBe(o);
            expect(x).toBe(1);
            done();
          }
        };

        Observable.of(1).subscribe(o);
      });

      it('should accept an anonymous observer with just an error function and call the error function in the context' +
        ' of the anonymous observer', (done: DoneSignature) => {
        //intentionally not using lambda to avoid typescript's this context capture
        const o = {
          error: function error(err) {
            expect(this).toBe(o);
            expect(err).toBe('bad');
            done();
          }
        };

        Observable.throw('bad').subscribe(o);
      });

      it('should accept an anonymous observer with just a complete function and call the complete function in the' +
        ' context of the anonymous observer', (done: DoneSignature) => {
        //intentionally not using lambda to avoid typescript's this context capture
         const o = {
          complete: function complete() {
            expect(this).toBe(o);
            done();
          }
        };

        Observable.empty().subscribe(o);
      });

      it('should accept an anonymous observer with no functions at all', () => {
        expect(() => {
          Observable.empty().subscribe(<any>{});
        }).not.toThrow();
      });

      it('should not run unsubscription logic when an error is thrown sending messages synchronously to an' +
        ' anonymous observer', () => {
        let messageError = false;
        let messageErrorValue = false;
        let unsubscribeCalled = false;

        //intentionally not using lambda to avoid typescript's this context capture
        const o = {
          next: function next(x) {
            expect(this).toBe(o);
            throw x;
          }
        };

        let sub;
        const source = new Observable((observer: Rx.Observer<string>) => {
          observer.next('boo!');
          return () => {
            unsubscribeCalled = true;
          };
        });

        try {
          sub = source.subscribe(o);
        } catch (e) {
          messageError = true;
          messageErrorValue = e;
        }

        expect(sub).toBe(undefined);
        expect(unsubscribeCalled).toBe(true);
        expect(messageError).toBe(true);
        expect(messageErrorValue).toBe('boo!');
      });
    });
  });
});

/** @test {Observable} */
describe('Observable.create', () => {
  it('should create an Observable', () => {
    const result = Observable.create(() => {
      //noop
     });
    expect(result instanceof Observable).toBe(true);
  });

  it('should provide an observer to the function', () => {
    let called = false;
    const result = Observable.create((observer: Rx.Observer<any>) => {
      called = true;
      expectFullObserver(observer);
      observer.complete();
    });

    expect(called).toBe(false);
    result.subscribe(() => {
      //noop
    });
    expect(called).toBe(true);
  });
});

/** @test {Observable} */
describe('Observable.lift', () => {
  it('should be overrideable in a custom Observable type that composes', (done: DoneSignature) => {
    class MyCustomObservable<T> extends Rx.Observable<T> {
      lift<R>(operator: Rx.Operator<T, R>): Rx.Observable<R> {
        const observable = new MyCustomObservable<R>();
        (<any>observable).source = this;
        (<any>observable).operator = operator;
        return observable;
      }
    }

    const result = new MyCustomObservable((observer: Rx.Observer<number>) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
    }).map((x: number) => { return 10 * x; });

    expect(result instanceof MyCustomObservable).toBe(true);

    const expected = [10, 20, 30];

    result.subscribe(
      function (x) {
        expect(x).toBe(expected.shift());
      },
      done.fail,
      done);
  });

  it('should allow injecting behaviors into all subscribers in an operator ' +
  'chain when overridden', (done: DoneSignature) => {
    // The custom Subscriber
    const log: Array<string> = [];

    class LogSubscriber<T> extends Rx.Subscriber<T> {
      next(value?: T): void {
        log.push('next ' + value);
        if (!this.isStopped) {
          this._next(value);
        }
      }
    }

    // The custom Operator
    class LogOperator<T, R> extends Rx.Operator<T, R> {
      constructor(private childOperator: Rx.Operator<T, R>) {
        super();
      }

      call(subscriber: Rx.Subscriber<R>): Rx.Subscriber<T> {
        return this.childOperator.call(new LogSubscriber<R>(subscriber));
      }
    }

    // The custom Observable
    class LogObservable<T> extends Observable<T> {
      lift<R>(operator: Rx.Operator<T, R>): Rx.Observable<R> {
        const observable = new LogObservable<R>();
        (<any>observable).source = this;
        (<any>observable).operator = new LogOperator(operator);
        return observable;
      }
    }

    // Use the LogObservable
    const result = new LogObservable((observer: Rx.Observer<number>) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
    })
    .map((x: number) => { return 10 * x; })
    .filter((x: number) => { return x > 15; })
    .count();

    expect(result instanceof LogObservable).toBe(true);

    const expected = [2];

    result.subscribe(
      function (x) {
        expect(x).toBe(expected.shift());
      },
      done.fail,
      () => {
        expect(log).toEqual([
          'next 10', // map
          'next 20', // map
          'next 20', // filter
          'next 30', // map
          'next 30', // filter
          'next 2' // count
        ]);
        done();
      });
  });
});
