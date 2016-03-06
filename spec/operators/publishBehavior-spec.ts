import * as Rx from '../../dist/cjs/Rx';
declare const {hot, cold, asDiagram, expectObservable, expectSubscriptions};
import {DoneSignature} from '../helpers/test-helper';

const Observable = Rx.Observable;

/** @test {publishBehavior} */
describe('Observable.prototype.publishBehavior', () => {
  asDiagram('publishBehavior(0)')('should mirror a simple source Observable', () => {
    const source = cold('--1-2---3-4--5-|');
    const sourceSubs =  '^              !';
    const published = source.publishBehavior('0');
    const expected =    '0-1-2---3-4--5-|';

    expectObservable(published).toBe(expected);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should follow the RxJS 4 behavior and NOT allow you to reconnect by subscribing again', (done: DoneSignature) => {
    const expected = [0, 1, 2, 3, 4];
    let i = 0;

    const source = Observable.of(1, 2, 3, 4).publishBehavior(0);

    source.subscribe(
      (x: number) => {
        expect(x).toBe(expected[i++]);
      },
      done.fail,
      () => {
        source.subscribe((x: any) => {
          done.fail('should not be called');
        }, done.fail, done);

        source.connect();
      });

    source.connect();
  });

  it('should return a ConnectableObservable', () => {
    const source = Observable.of(1).publishBehavior(1);
    expect(source instanceof Rx.ConnectableObservable).toBe(true);
  });

  it('should only emit default value if connect is not called, despite subscriptions', () => {
    const source = cold('--1-2---3-4--5-|');
    const sourceSubs = [];
    const published = source.publishBehavior('0');
    const expected =    '0';

    expectObservable(published).toBe(expected);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);
  });

  it('should multicast the same values to multiple observers', () => {
    const source =     cold('-1-2-3----4-|');
    const sourceSubs =      '^           !';
    const published = source.publishBehavior('0');
    const subscriber1 = hot('a|           ').mergeMapTo(published);
    const expected1   =     '01-2-3----4-|';
    const subscriber2 = hot('    b|       ').mergeMapTo(published);
    const expected2   =     '    23----4-|';
    const subscriber3 = hot('        c|   ').mergeMapTo(published);
    const expected3   =     '        3-4-|';

    expectObservable(subscriber1).toBe(expected1);
    expectObservable(subscriber2).toBe(expected2);
    expectObservable(subscriber3).toBe(expected3);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should multicast an error from the source to multiple observers', () => {
    const source =     cold('-1-2-3----4-#');
    const sourceSubs =      '^           !';
    const published = source.publishBehavior('0');
    const subscriber1 = hot('a|           ').mergeMapTo(published);
    const expected1   =     '01-2-3----4-#';
    const subscriber2 = hot('    b|       ').mergeMapTo(published);
    const expected2   =     '    23----4-#';
    const subscriber3 = hot('        c|   ').mergeMapTo(published);
    const expected3   =     '        3-4-#';

    expectObservable(subscriber1).toBe(expected1);
    expectObservable(subscriber2).toBe(expected2);
    expectObservable(subscriber3).toBe(expected3);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should multicast the same values to multiple observers, ' +
  'but is unsubscribed explicitly and early', () => {
    const source =     cold('-1-2-3----4-|');
    const sourceSubs =      '^        !   ';
    const published = source.publishBehavior('0');
    const unsub =           '         u   ';
    const subscriber1 = hot('a|           ').mergeMapTo(published);
    const expected1   =     '01-2-3----   ';
    const subscriber2 = hot('    b|       ').mergeMapTo(published);
    const expected2   =     '    23----   ';
    const subscriber3 = hot('        c|   ').mergeMapTo(published);
    const expected3   =     '        3-   ';

    expectObservable(subscriber1).toBe(expected1);
    expectObservable(subscriber2).toBe(expected2);
    expectObservable(subscriber3).toBe(expected3);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    // Set up unsubscription action
    let connection;
    expectObservable(hot(unsub).do(() => {
      connection.unsubscribe();
    })).toBe(unsub);

    connection = published.connect();
  });

  it('should not break unsubscription chains when result is unsubscribed explicitly', () => {
    const source =     cold('-1-2-3----4-|');
    const sourceSubs =      '^        !   ';
    const published = source
      .mergeMap((x: any) => Observable.of(x))
      .publishBehavior('0');
    const subscriber1 = hot('a|           ').mergeMapTo(published);
    const expected1   =     '01-2-3----   ';
    const subscriber2 = hot('    b|       ').mergeMapTo(published);
    const expected2   =     '    23----   ';
    const subscriber3 = hot('        c|   ').mergeMapTo(published);
    const expected3   =     '        3-   ';
    const unsub =           '         u   ';

    expectObservable(subscriber1).toBe(expected1);
    expectObservable(subscriber2).toBe(expected2);
    expectObservable(subscriber3).toBe(expected3);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    // Set up unsubscription action
    let connection;
    expectObservable(hot(unsub).do(() => {
      connection.unsubscribe();
    })).toBe(unsub);

    connection = published.connect();
  });

  describe('with refCount()', () => {
    it('should connect when first subscriber subscribes', () => {
      const source = cold(       '-1-2-3----4-|');
      const sourceSubs =      '   ^           !';
      const replayed = source.publishBehavior('0').refCount();
      const subscriber1 = hot('   a|           ').mergeMapTo(replayed);
      const expected1 =       '   01-2-3----4-|';
      const subscriber2 = hot('       b|       ').mergeMapTo(replayed);
      const expected2 =       '       23----4-|';
      const subscriber3 = hot('           c|   ').mergeMapTo(replayed);
      const expected3 =       '           3-4-|';

      expectObservable(subscriber1).toBe(expected1);
      expectObservable(subscriber2).toBe(expected2);
      expectObservable(subscriber3).toBe(expected3);
      expectSubscriptions(source.subscriptions).toBe(sourceSubs);
    });

    it('should disconnect when last subscriber unsubscribes', () => {
      const source =     cold(   '-1-2-3----4-|');
      const sourceSubs =      '   ^        !   ';
      const replayed = source.publishBehavior('0').refCount();
      const subscriber1 = hot('   a|           ').mergeMapTo(replayed);
      const unsub1 =          '          !     ';
      const expected1   =     '   01-2-3--     ';
      const subscriber2 = hot('       b|       ').mergeMapTo(replayed);
      const unsub2 =          '            !   ';
      const expected2   =     '       23----   ';

      expectObservable(subscriber1, unsub1).toBe(expected1);
      expectObservable(subscriber2, unsub2).toBe(expected2);
      expectSubscriptions(source.subscriptions).toBe(sourceSubs);
    });

    it('should NOT be retryable', () => {
      const source =     cold('-1-2-3----4-#');
      const sourceSubs =      '^           !';
      const published = source.publishBehavior('0').refCount().retry(3);
      const subscriber1 = hot('a|           ').mergeMapTo(published);
      const expected1   =     '01-2-3----4-#';
      const subscriber2 = hot('    b|       ').mergeMapTo(published);
      const expected2   =     '    23----4-#';
      const subscriber3 = hot('        c|   ').mergeMapTo(published);
      const expected3   =     '        3-4-#';

      expectObservable(subscriber1).toBe(expected1);
      expectObservable(subscriber2).toBe(expected2);
      expectObservable(subscriber3).toBe(expected3);
      expectSubscriptions(source.subscriptions).toBe(sourceSubs);
    });

    it('should NOT be repeatable', () => {
      const source =     cold('-1-2-3----4-|');
      const sourceSubs =      '^           !';
      const published = source.publishBehavior('0').refCount().repeat(3);
      const subscriber1 = hot('a|           ').mergeMapTo(published);
      const expected1   =     '01-2-3----4-|';
      const subscriber2 = hot('    b|       ').mergeMapTo(published);
      const expected2   =     '    23----4-|';
      const subscriber3 = hot('        c|   ').mergeMapTo(published);
      const expected3   =     '        3-4-|';

      expectObservable(subscriber1).toBe(expected1);
      expectObservable(subscriber2).toBe(expected2);
      expectObservable(subscriber3).toBe(expected3);
      expectSubscriptions(source.subscriptions).toBe(sourceSubs);
    });
  });

  it('should emit completed when subscribed after completed', (done: DoneSignature) => {
    const results1 = [];
    const results2 = [];
    let subscriptions = 0;

    const source = new Observable((observer: Rx.Observer<number>) => {
      subscriptions++;
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.next(4);
      observer.complete();
    });

    const connectable = source.publishBehavior(0);

    connectable.subscribe(function (x) {
      results1.push(x);
    });

    expect(results1).toEqual([0]);
    expect(results2).toEqual([]);

    connectable.connect();

    expect(results1).toEqual([0, 1, 2, 3, 4]);
    expect(results2).toEqual([]);
    expect(subscriptions).toBe(1);

    connectable.subscribe(function (x) {
      results2.push(x);
    }, done.fail, () => {
      expect(results2).toEqual([]);
      done();
    });
  });

  it('should multicast an empty source', () => {
    const source = cold('|');
    const sourceSubs =  '(^!)';
    const published = source.publishBehavior('0');
    const expected =    '(0|)';

    expectObservable(published).toBe(expected);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should multicast a never source', () => {
    const source = cold('-');
    const sourceSubs =  '^';
    const published = source.publishBehavior('0');
    const expected =    '0';

    expectObservable(published).toBe(expected);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should multicast a throw source', () => {
    const source = cold('#');
    const sourceSubs =  '(^!)';
    const published = source.publishBehavior('0');
    const expected =    '(0#)';

    expectObservable(published).toBe(expected);
    expectSubscriptions(source.subscriptions).toBe(sourceSubs);

    published.connect();
  });

  it('should multicast one observable to multiple observers', (done: DoneSignature) => {
    const results1 = [];
    const results2 = [];
    let subscriptions = 0;

    const source = new Observable((observer: Rx.Observer<number>) => {
      subscriptions++;
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.next(4);
    });

    const connectable = source.publishBehavior(0);

    connectable.subscribe((x: any) => {
      results1.push(x);
    });

    expect(results1).toEqual([0]);

    connectable.connect();

    expect(results2).toEqual([]);

    connectable.subscribe((x: any) => {
      results2.push(x);
    });

    expect(results1).toEqual([0, 1, 2, 3, 4]);
    expect(results2).toEqual([4]);
    expect(subscriptions).toBe(1);
    done();
  });

  it('should follow the RxJS 4 behavior and emit nothing to observer after completed', (done: DoneSignature) => {
    const results = [];

    const source = new Observable((observer: Rx.Observer<number>) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.next(4);
      observer.complete();
    });

    const connectable = source.publishBehavior(0);

    connectable.connect();

    connectable.subscribe((x: any) => {
      results.push(x);
    });

    expect(results).toEqual([]);
    done();
  });
});