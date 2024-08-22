/**
 * 为 class 打补丁
 * HTML Attributes 和 DOM Properties：我们知道想要成功的进行各种属性的设置，那么需要 针对不同属性，通过不同方式 完成
 * className 和 setAttribute('class', '') ：因为 className 的性能更高，所以我们应该尽量使用 className 进行指定。
 */
export function patchClass(el: Element, value: string | null) {
  if (value == null) {
    // 移除
    el.removeAttribute('class')
  } else {
    // 赋值
    el.className = value
  }
}
