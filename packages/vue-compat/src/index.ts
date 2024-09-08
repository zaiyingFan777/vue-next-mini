import { compile } from '@vue/compiler-dom'

/**
 * 将 code 字符串 转为 函数
 * @param template
 * @param options
 */
function compileToFunction(template, options?) {
  const { code } = compile(template, options)

  const render = new Function(code)()

  return render
}

export { compileToFunction as compile }
