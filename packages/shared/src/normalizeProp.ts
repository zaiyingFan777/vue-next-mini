import { isArray, isObject, isString } from '.'

/**
 * 规范化 class 类，处理 class 的增强
 */
export function normalizeClass(value: unknown): string {
  let res = ''
  // 判断是否为 string，如果是 string 就不需要专门处理
  if (isString(value)) {
    res = value
  }
  // 额外的数组增强，官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-to-arrays
  // const activeClass = ref('active')
  // const errorClass = ref('text-danger')
  // <div :class="[activeClass, errorClass]"></div>
  // 渲染结果: <div class="active text-danger"></div>
  else if (isArray(value)) {
    // 循环得到数组中的每个元素，通过 normalizeClass 方法进行迭代处理
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  }
  // 额外的对象增强。官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-html-classes
  // <div :class="{ active: isActive }"></div>
  // props: { class: { red: true } }
  else if (isObject(value)) {
    // for in 获取得到的所有的 key，这里的 key(name) 即为 类名。value为 boolean 值
    for (const name in value as object) {
      // 把 value 当作 boolean 来看，拼接 name
      if ((value as object)[name]) {
        // 为true才会拼接
        res += name + ' '
      }
    }
  }
  // 去左右空格
  return res.trim()
}
