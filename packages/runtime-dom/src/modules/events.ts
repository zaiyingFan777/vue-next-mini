/**
 * 为 event 事件进行打补丁
 * vei = vue event invokers ，即：VUE事件调用者
 * 频繁的删除、新增事件是非常消耗性能的
 * el: Element & { _vei?: object }，这行代码定义了一个类型为 Element 的变量 el，并且通过 & 符号添加了一个额外的属性 _vei，这个属性的类型是 object
 */
export function patchEvent(
  el: Element & { _vei?: object },
  rawName: string,
  prevValue,
  nextValue
) {
  // vei = vue event invokers，拿不到就赋值._vei（mount的时候会创建）
  const invokers = el._vei || (el._vei = {})
  // 是否存在缓存事件
  const existingInvoker = invokers[rawName]
  // 如果当前事件存在缓存，并且存在新的事件行为，则判定为更新操作。直接更新 invoker 的 value 即可
  if (nextValue && existingInvoker) {
    // patch（频繁的删除、新增事件是非常消耗性能的，因此我们替换对象的属性）
    existingInvoker.value = nextValue
  } else {
    // 获取用于 addEventListener || removeEventListener 的事件名
    const name = parseName(rawName)
    if (nextValue) {
      // 没有缓存，存在nextValue，代表新增（add）
      // invoker为函数，他的value就是@click="()=>{}"用户传入的函数
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      // 事件监听
      el.addEventListener(name, invoker)
    } else if (existingInvoker) {
      // 没有nextValue，但是有缓存，代表移除（remove）
      el.removeEventListener(name, existingInvoker)
      // 删除缓存
      invokers[rawName] = undefined
    }
  }
}

/**
 * 直接返回剔除 on，其余转化为小写的事件名即可
 * ps: onClick => click
 */
function parseName(name: string) {
  return name.slice(2).toLowerCase()
}

/**
 * 生成 invoker 函数
 */
function createInvoker(initialValue) {
  const invoker = (e: Event) => {
    invoker.value && invoker.value()
  }
  // value 为真实的事件行为
  invoker.value = initialValue
  return invoker
}
