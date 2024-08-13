import { isFunction } from '@vue/shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue, triggerRefValue } from './ref'

/**
 * 计算属性类
 */
export class ComputedRefImpl<T> {
  // 收集effect(fn)
  public dep?: Dep = undefined
  private _value!: T
  // 被targetMap收集
  public readonly effect: ReactiveEffect<T>
  public readonly __v_isRef = true

  /**
   * 脏：为 false 时，表示需要触发依赖。为 true 时表示需要重新执行 run 方法，获取数据。即：数据脏了(true)
   */
  public _dirty = true

  constructor(getter) {
    this.effect = new ReactiveEffect(getter, () => {
      // 判断当前脏的状态，如果为false，表示需要《触发依赖》
      if (!this._dirty) {
        this._dirty = true
        triggerRefValue(this)
      }
    })
    this.effect.computed = this
  }

  get value() {
    // 触发依赖，将activeEffect(ReactiveEffect)收集到this.dep中
    // 1. effect(fn) 被收集到 computedRefImpl.dep里，2. 执行this.effect(computed(fn)).run 触发reactive的getter，然后this.effect被收集到targetMap里
    trackRefValue(this)
    // 判断当前脏的状态，如果为true，则表示需要重新执行run，获取最新数据
    // 缓存 求值
    if (this._dirty) {
      // this._dirty为true，数据脏了，才去重新获取数据
      this._dirty = false
      // 执行run函数
      this._value = this.effect.run()!
    }
    // 返回计算之后的真实值
    return this._value
  }
}

/**
 * 计算属性: 会基于其响应式依赖被「缓存」，并且在以来的响应式数据发生变化时重新计算
 * const computedObj = computed(() => {return '姓名：' + obj.name})
 */
export function computed(getterOrOptions) {
  let getter

  // 判断传入的参数是否为一个函数
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    // 如果是函数，则赋值给getter
    getter = getterOrOptions
  }

  const cRef = new ComputedRefImpl(getter)

  return cRef as any
}
