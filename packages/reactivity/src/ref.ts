import { hasChanged } from '@vue/shared'
import { createDep, Dep } from './dep'
import { activeEffect, trackEffects, trigger, triggerEffects } from './effect'
import { toReactive } from './reactive'

export interface Ref<T = any> {
  value: T
}

/**
 * ref函数
 * 简单数据类型的响应性(其实并不具备响应性)，不是基于 proxy 或 Object.defineProperty 进行实现的，将老值保存到RefImpl实例中，触发setter，对比新老值是否一致
 * @param value unknown
 */
export function ref(value?: unknown) {
  return createRef(value, false)
}

/**
 * 创建RefImpl实例
 * @param rawValue 原始数据
 * @param shallow boolean形数据，表示《浅层的响应性（即：只有.value是响应性的）》
 * @returns
 */
function createRef(rawValue: unknown, shallow: boolean) {
  // 如果是被ref的数据了，直接返回，否则去创建ref实例
  if (isRef(rawValue)) {
    return rawValue
  }

  return new RefImpl(rawValue, shallow)
}

class RefImpl<T> {
  // 复杂类型proxy，简单类型是值本身
  private _value: T
  // 简单类型的原始数据（旧数据）
  private _rawValue: T

  // 收集effect生成的实例ReactiveEffect(.fn为用户传入的回调函数，里面基本包含触发)
  public dep?: Dep = undefined

  // 是否为ref类型数据的标记
  public readonly __v_isRef = true

  constructor(value: T, public readonly __v_isShallow: boolean) {
    // 如果 __v_isShallow 为 true，则 value 不会被转化为 reactive 数据，即如果当前 value 为复杂数据类型，
    // 则会失去响应性。对应官方文档 shallowRef ：https://cn.vuejs.org/api/reactivity-advanced.html#shallowref
    this._value = __v_isShallow ? value : toReactive(value)

    // 原始数据
    this._rawValue = value
  }

  /**
   * get语法将对象属性绑定到查询该属性时将被调用的函数。
   * 即：xxx.value 时触发该函数
   */
  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    /**
     * newVal为新数据
     * this._rawValue 为旧数据（原始数据）
     * 对比两个数据是否发生了变化
     */
    if (hasChanged(newVal, this._rawValue)) {
      // 更新原始数据
      this._rawValue = newVal
      // 更新_value的值
      this._value = toReactive(newVal)
      // 触发依赖
      triggerRefValue(this)
    }
  }
}

/**
 * 为 ref 的 value 进行依赖收集工作
 */
export function trackRefValue(ref) {
  if (activeEffect) {
    console.log('activeEffect111', activeEffect)
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

/**
 * 指定数据是否为RefImpl类型
 */
// r is Ref 是 TypeScript 的类型断言语法，表示函数返回的是一个布尔值，该布尔值用于断言 r 是否为 Ref 类型。
export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

/**
 * 为ref的value进行触发依赖环节
 */
export function triggerRefValue(ref) {
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}
