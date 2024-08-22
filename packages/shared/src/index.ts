/**
 * 判断是否为一个数组
 */
export const isArray = Array.isArray

/**
 * 判断是否为一个对象
 */
export const isObject = (val: unknown) =>
  val !== null && typeof val === 'object'

/**
 * 对比两个数据是否发生了变化，false无变化，true发生了变化
 */
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)

/**
 * 是否为一个function
 */
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

/**
 * Object.assign
 */
export const extend = Object.assign

/**
 * 只读的空对象
 */
export const EMPTY_OBJ: { readonly [key: string]: any } = {}

/**
 * 判断是否为一个 string
 */
export const isString = (val: unknown): val is string => typeof val === 'string'

/**
 * 匹配任何以 "on" 开头，并且 "on" 后面紧跟的字符不是小写字母的字符串。比如onClick
 * onclick匹配不到
 */
const onRE = /^on[^a-z]/

/**
 * 是否 on 开头
 */
export const isOn = (key: string) => onRE.test(key)
