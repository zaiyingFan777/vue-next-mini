import { isObject } from '@vue/shared'
import { mutableHandlers } from './baseHandlers'

// vue的响应式核心：依赖收集、依赖触发

/**
 * 响应性Map缓存对象 ps: 对于 WeakMap 而言，它存在两个比较重要的特性：1.key 必须是对象 2.key 是弱引用的
 * key: target
 * val: proxy
 */
export const reactiveMap = new WeakMap<object, any>()

/**
 * 为复杂数据类型，创建响应性对象
 * 局限：1.只支持对象类型（proxy只能代理对象，不能代理简单类型数据），不支持简单类型数据
 * 局限：2.解构之后的属性，不具备响应性（只有proxy类型的代理对象才可以被监听getter和setter，解构后，对应的属性将不再是proxy类型的对象）
 * @param target 被代理对象
 * @returns 代理对象
 */
export function reactive(target: object) {
  return createReactiveObject(target, mutableHandlers, reactiveMap)
}

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive'
}

/**
 * 创建响应性对象
 * @param target 被代理对象
 * @param baseHandlers handle
 */
function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  // 如果该实例已经被代理，则直接读取即可
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 未被代理则生成proxy实例
  const proxy = new Proxy(target, baseHandlers)
  // 为Reactive增加标记
  proxy[ReactiveFlags.IS_REACTIVE] = true

  // 缓存被代理对象
  proxyMap.set(target, proxy)
  // 返回生成的proxy实例
  return proxy
}

/**
 * 将指定数据变为reactive数据，否则返回原始数据
 */
export const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value as object) : value

/**
 * 判断一个数据是否为Reactive
 */
export function isReactive(value): boolean {
  return !!(value && value[ReactiveFlags.IS_REACTIVE])
}
