import { track, trigger } from './effect'

/**
 * getter回调方法
 */
const get = createGetter()

/**
 * 创建getter回调方法
 */
function createGetter() {
  return function get(target: object, key: string | symbol, receiver: object) {
    // target 被代理的对象 {name: 张三}
    // receiver proxy实例 proxy {name: 张三}
    // 利用Reflect.get得到返回值
    const res = Reflect.get(target, key, receiver)
    // 依赖收集
    track(target, key)
    return res
  }
}

/**
 * setter回调方法
 */
const set = createSetter()

/**
 * 创建setter回调方法
 */
function createSetter() {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ) {
    // 利用Reflect.set设置新值
    const result = Reflect.set(target, key, value, receiver)
    // 触发依赖收集
    trigger(target, key, value)
    return result
  }
}

/**
 * 响应性的handler
 */
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}
