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
    // 如果target对象中指定了getter，receiver则为getter调用时的this值。
    // const p1 = {
    //   lastName: '张',
    //   firstName: '三',
    //   // 通过 get 标识符标记，可以让方法的调用像属性的调用一样
    //   get fullName() {
    //     return this.lastName + this.firstName
    //   }
    // }
    // const proxy = new Proxy(p1, {
    //   // target：被代理对象
    //   // receiver：代理对象
    //   get(target, key, receiver) {
    //     console.log('触发了 getter');
    //     return Reflect.get(target, key, receiver) // target[key]如果是这样子的，只能触发一次getter因为，p1的fullName的this为p1不是Proxy
    //   }
    // })
    // console.log(proxy.fullName);
    // 这样proxy.fullName就会触发getter三次，因为Reflect.get(target, key, receiver)为被代理的对象。
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
    // 触发依赖
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
