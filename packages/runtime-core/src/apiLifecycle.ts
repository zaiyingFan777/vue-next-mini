// 生命周期相关api

import { LifecycleHooks } from './component'

/**
 * 注册 Hook，beforeMount、mounted，需要先注册到组件instance后，在合适时机再执行
 */
export function injectHook(
  type: LifecycleHooks, // bm、m
  hook: Function, // 钩子函数
  target // 组件 instance
): Function | undefined {
  // 将 hook 注册到 组件实例中
  if (target) {
    // 源码是数组，我们这里简化处理，直接instance.m = 钩子函数
    target[type] = hook
    return hook
  }
}

/**
 * 创建一个指定的 hook
 * @param lifecycle 指定的 hook enum
 * @returns 注册 hook 的方法
 */
export const createHook = (lifecycle: LifecycleHooks) => {
  // hook 用户传进来的 beforeMount、mounted
  // target 组件 instance
  return (hook: Function, target?: any) => injectHook(lifecycle, hook, target)
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
