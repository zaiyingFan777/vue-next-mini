import { isString } from '@vue/shared'

/**
 * 为 style 属性进行打补丁
 */
export function patchStyle(el: Element, prev, next) {
  // 获取 style 对象
  const style = (el as HTMLElement).style
  // 判断新的样式是否为纯字符串
  const isCssString = isString(next)
  // 1.先对新属性进行赋值操作
  // next有值，且为对象
  if (next && !isCssString) {
    // 赋值新样式
    // {color: 'red'}
    for (const key in next) {
      setStyle(style, key, next[key])
    }
    // 2.再清理旧样式
    // prev有值，且为对象
    // prev: { color: 'red' }
    // next: { fontSize: '32px' }
    if (prev && !isString(prev)) {
      for (const key in prev) {
        // 比如上面的例子，color 没有在 next 中，则清空
        if (next[key] == null) {
          setStyle(style, key, '')
        }
      }
    }
  }
}

/**
 * 赋值新样式
 */
function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[]
) {
  // const el = document.querySelector('#__nuxt')
  // el.style.color = 'red'
  style[name] = val
}
