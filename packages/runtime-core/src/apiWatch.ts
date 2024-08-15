import { ReactiveEffect } from 'packages/reactivity/src/effect'
import { queuePreFlushCb } from './scheduler'
import { EMPTY_OBJ, hasChanged, isObject } from '@vue/shared'
import { isReactive } from 'packages/reactivity/src/reactive'

/**
 * watch 配置项属性
 */
export interface WatchOptions<immediate = boolean> {
  /**
   * 是否立即执行
   */
  immediate?: boolean
  /**
   * 是否深度监听
   */
  deep?: boolean
}

/**
 * 指定的watch函数(watch 内部本质上也是通过：ReactiveEffect + scheduler 进行实现的。)
 * @param source 监听的响应性数据
 * @param cb 回调函数
 * @param options 配置对象
 * @returns
 */
export function watch(source, cb: Function, options?: WatchOptions) {
  return doWatch(source, cb, options)
}

function doWatch(
  source,
  cb: Function,
  { immediate, deep }: WatchOptions = EMPTY_OBJ
) {
  // 触发getter的指定函数
  let getter: () => any

  // 判断source的数据类型
  if (isReactive(source)) {
    // 响应式数据，指定getter
    getter = () => source
    // 深度
    deep = true
  } else {
    // 非响应式数据
    getter = () => {}
  }

  // 存在回调函数和deep
  if (cb && deep) {
    const baseGetter = getter
    // 依次执行getter，从而触发依赖收集
    getter = () => traverse(baseGetter())
  }

  // 旧值
  let oldValue = {}
  // job执行方法
  const job = () => {
    if (cb) {
      // watch(source, cb)
      // 拿到新值
      const newValue = effect.run()
      // 对于同一个proxy他其实是没变化的，effect.run()返回的是同一个proxy
      if (deep || hasChanged(newValue, oldValue)) {
        // 新老数据不一致
        cb(newValue, oldValue)
        oldValue = newValue
      }
    }
  }

  // 调度器(把job推到任务队列)
  let scheduler = () => queuePreFlushCb(job)

  // 本质
  const effect = new ReactiveEffect(getter, scheduler)

  if (cb) {
    if (immediate) {
      // 立即执行
      job()
    } else {
      // 收集依赖
      oldValue = effect.run()
    }
  } else {
    // 收集依赖
    effect.run()
  }
  return () => {
    effect.stop()
  }
}

/**
 * 依次执行getter，从而触发依赖收集
 */
export function traverse(value: unknown) {
  if (!isObject(value)) {
    return value
  }

  for (const key in value as Object) {
    // (value as any)[key]触发getter
    // 递归（deep = true）
    traverse((value as any)[key])
  }

  return value
}
