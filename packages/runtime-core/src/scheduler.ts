// 调度系统完成： 执行顺序（异步） 和 执行规则（批处理）

// 对应promise的Pending状态
let isFlushPending = false

/**
 * promise.resolve()
 */
const resolvePromise = Promise.resolve() as Promise<any>

/**
 * 当前执行的任务
 */
let currentFlushPromise: Promise<void> | null = null

/**
 * 待执行的任务队列
 */
// const pendingPreFlushCbs: Array<Function> = []
const pendingPreFlushCbs: Function[] = []

/**
 * 队列预处理函数
 */
export function queuePreFlushCb(cb: Function) {
  // cb进入任务队列pendingPreFlushCbs
  queueCb(cb, pendingPreFlushCbs)
}

/**
 * 队列处理函数
 */
function queueCb(cb: Function, pendingQueue: Function[]) {
  // 将所有的回调函数，放入队列中
  pendingQueue.push(cb)
  queueFlush()
}

/**
 * 依次处理队列中执行函数
 */
function queueFlush() {
  // 像scheduler-2.html里面，obj.count = 2; obj.count = 3; 第一次obj.count = 2(isFlushPending为false)，进入if逻辑，将flushJobs提交给promise，
  // 第二次同步代码 obj.count = 3（isFlushPending为true），进不会进入if逻辑里，因此只会把cb push到pendingPreFlushCbs中。
  // 同步代码执行完，清空微任务队列resolvePromise.then(flushJobs)执行flushJobs函数(批处理)
  if (!isFlushPending) {
    isFlushPending = true
    // 同步代码执行完，再走Promise.resolve().then(flushJobs)
    currentFlushPromise = resolvePromise.then(flushJobs)
  }
}

/**
 * 处理队列
 */
function flushJobs() {
  isFlushPending = false
  flushPreFlushCbs()
}

/**
 * 依次处理队列中的任务
 */
export function flushPreFlushCbs() {
  if (pendingPreFlushCbs.length) {
    // 去重
    let activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    // 这里也是防止重复进入此函数，所以清空队列
    // var a = [1,2,3] a.length = 0 a => []
    pendingPreFlushCbs.length = 0
    for (let i = 0; i < activePreFlushCbs.length; i++) {
      activePreFlushCbs[i]()
    }
  }
}
