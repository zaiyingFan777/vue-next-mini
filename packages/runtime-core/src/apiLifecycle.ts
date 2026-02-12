import { LifecycleHooks } from './component'

/**
 * 注册 hook
 */
export function injectHook(
  type: LifecycleHooks,
  hook: Function,
  target
): Function | undefined {
  // 将 hook 注册到 组件实例中
  if (target) {
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
  // * 这里的target是instance实例
  // * 这里的hook是绑定了instance.data的hook函数(onMounted(){})
  return (hook, target) => injectHook(lifecycle, hook, target)
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
