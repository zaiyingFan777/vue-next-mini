import { isArray } from '@vue/shared'
import { createDep, Dep } from './dep'
import { ComputedRefImpl } from './computed'

type KeyToDepMap = Map<any, Dep>
/**
 * 收集所有依赖的WeakMap实例：
 * 1. `key`: 响应性对象
 * 2. `value`: `Map`对象
 *      1. `key`: 响应性对象的指定属性
 *      2. `value`: 指定对象的指定属性的 执行函数的set集合
 */
const targetMap = new WeakMap<any, KeyToDepMap>()

/**
 * 用于收集依赖的方法
 * @param target WeakMap 的 key
 * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
 */
export function track(target: object, key: unknown) {
  // 如果当前不存在执行函数，则直接return
  // 1.定义reactive对象 2.执行effect，给全局变量赋值activeEffect为ReactiveEffect实例(类似于栈顶元素，每次执行effect，activeEffect都是最新的effect) 3.执行effect里的fn，get的时候收集依赖
  if (!activeEffect) return
  // 尝试从targetMap中，根据target获取map
  let depsMap = targetMap.get(target)
  // 如果获取到的map不存在，则生成新的map对象，并把该对象赋值给对应的value
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 获取指定key的dep
  let dep = depsMap.get(key)
  // 如果dep不存在，则生成一个新的dep，并放入到depsMap中
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }
  trackEffects(dep)
  // 临时打印
  console.log('track: 收集依赖', targetMap)
}

/**
 * 利用dep依次跟踪指定key的所有effect
 * @param dep
 */
export function trackEffects(dep: Dep) {
  // !代表非空断言操作符，它告诉编译器 activeEffect 在这里一定会被定义，即使在某些情况下 TypeScript 可能无法确定它的类型或存在性。
  dep.add(activeEffect!)
}

/**
 * 触发依赖的方法
 * @param target WeakMap 的 key
 * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
 * @param newValue 指定 key 的最新值
 * @param oldValue 指定 key 的旧值
 */
export function trigger(target: object, key?: unknown, newValue?: unknown) {
  // 根据target获取存储的map实例
  const depsMap = targetMap.get(target)
  // 如果map不存在，则直接return
  if (!depsMap) {
    return
  }
  // 依据指定的key，获取dep实例
  let dep: Dep | undefined = depsMap.get(key)
  // dep不存在则直接return
  if (!dep) {
    return
  }
  triggerEffects(dep)
}

/**
 * 依次触发dep中保存的依赖
 */
export function triggerEffects(dep: Dep) {
  console.log('trigger: 触发依赖')
  // 把dep构建为一个数组(Array.isArray(new Set())) => false
  const effects = isArray(dep) ? dep : [...dep]
  // 依次触发
  // for (const effect of effects) {
  //   triggerEffect(effect)
  // }

  // 不在依次触发，而是先触发所有的计算依赖属性，再触发所有的非计算属性依赖
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect)
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect)
    }
  }
}

/**
 * 触发置顶的依赖
 */
export function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    // 存在调度器就执行调度函数
    effect.scheduler()
  } else {
    // 这里又会执行一次依赖收集
    // 比如：effect(() => {document.querySelector('#p1').innerText = obj.name})触发getter
    // 但是key: set<ReactiveEffect>结构会去重

    // 否则直接执行run函数即可
    effect.run()
  }
}

/**
 * effect函数
 * @param fn 执行方法
 * @returns 以ReactiveEffect实例为this的执行函数
 */
// 调用 effect 方法
// effect(() => {
//   document.querySelector('#app').innerText = obj.name
// })
export function effect<T = any>(fn: () => T) {
  // 生成ReactiveEffect实例
  const _effect = new ReactiveEffect(fn)
  // 执行run函数
  _effect.run()
}

/**
 * 单例的，当前的effect
 */
export let activeEffect: ReactiveEffect | undefined

export type EffectScheduler = (...args: any[]) => any

/**
 * 响应性触发依赖时的执行类
 */
export class ReactiveEffect<T = any> {
  /**
   * 存在该属性，则表示当前的effect为计算属性的effect
   */
  computed?: ComputedRefImpl<T>

  fnStr: string

  // constructor: 这是类的构造函数，用于初始化类的新实例。
  // public fn: 这是一个公共（public）属性 fn 的声明，它直接在构造函数的参数列表中被初始化。这意味着 fn 将成为类的一个公共属性，可以通过类的实例直接访问。
  // () => T: 这定义了 fn 的类型。fn 必须是一个无参数的函数，并且它的返回类型是由泛型 T 指定的。泛型 T 可以在类的使用过程中被指定为任何具体的类型。
  // 整体来说，这段代码的作用是在创建类的新实例时，需要传入一个无参数的函数，该函数的返回值类型是泛型 T。这个函数会被保存为类实例的 fn 属性，可以在后续的代码中调用。
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  ) {
    this.fnStr = fn.toString()
  }

  run() {
    // 保留上一个activeEffect
    const prevEffect = activeEffect
    // 为activeEffect赋值（当前的ReactiveEffect）
    activeEffect = this

    try {
      // 执行fn函数
      return this.fn()
    } finally {
      // 恢复activeEffect为之前的值
      // 这里执行完try结构体的代码块，最后执行这里
      activeEffect = prevEffect
    }
  }
}
