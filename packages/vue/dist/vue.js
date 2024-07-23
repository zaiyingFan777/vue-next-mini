var Vue = (function (exports) {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    /**
     * 判断是否为一个数组
     */
    var isArray = Array.isArray;

    /**
     * 依据effects生成dep实例
     */
    var createDep = function (effects) {
        var dep = new Set(effects);
        return dep;
    };

    /**
     * 收集所有依赖的WeakMap实例：
     * 1. `key`: 响应性对象
     * 2. `value`: `Map`对象
     *      1. `key`: 响应性对象的指定属性
     *      2. `value`: 指定对象的指定属性的 执行函数的set集合
     */
    var targetMap = new WeakMap();
    /**
     * 用于收集依赖的方法
     * @param target WeakMap 的 key
     * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
     */
    function track(target, key) {
        // 如果当前不存在执行函数，则直接return
        // 1.定义reactive对象 2.执行effect，给全局变量赋值activeEffect为ReactiveEffect实例(类似于栈顶元素，每次执行effect，activeEffect都是最新的effect) 3.执行effect里的fn，get的时候收集依赖
        if (!activeEffect)
            return;
        // 尝试从targetMap中，根据target获取map
        var depsMap = targetMap.get(target);
        // 如果获取到的map不存在，则生成新的map对象，并把该对象赋值给对应的value
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        // 获取指定key的dep
        var dep = depsMap.get(key);
        // 如果dep不存在，则生成一个新的dep，并放入到depsMap中
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        trackEffects(dep);
        // 临时打印
        console.log('track: 收集依赖', targetMap);
    }
    /**
     * 利用dep依次跟踪指定key的所有effect
     * @param dep
     */
    function trackEffects(dep) {
        // !代表非空断言操作符，它告诉编译器 activeEffect 在这里一定会被定义，即使在某些情况下 TypeScript 可能无法确定它的类型或存在性。
        dep.add(activeEffect);
    }
    /**
     * 触发依赖的方法
     * @param target WeakMap 的 key
     * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
     * @param newValue 指定 key 的最新值
     * @param oldValue 指定 key 的旧值
     */
    function trigger(target, key, newValue) {
        // 根据target获取存储的map实例
        var depsMap = targetMap.get(target);
        // 如果map不存在，则直接return
        if (!depsMap) {
            return;
        }
        // 依据指定的key，获取dep实例
        var dep = depsMap.get(key);
        // dep不存在则直接return
        if (!dep) {
            return;
        }
        triggerEffects(dep);
    }
    /**
     * 依次触发dep中保存的依赖
     */
    function triggerEffects(dep) {
        var e_1, _a;
        console.log('trigger: 触发依赖');
        // 把dep构建为一个数组(Array.isArray(new Set())) => false
        var effects = isArray(dep) ? dep : __spreadArray([], __read(dep), false);
        try {
            // 依次触发
            for (var effects_1 = __values(effects), effects_1_1 = effects_1.next(); !effects_1_1.done; effects_1_1 = effects_1.next()) {
                var effect_1 = effects_1_1.value;
                triggerEffect(effect_1);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (effects_1_1 && !effects_1_1.done && (_a = effects_1.return)) _a.call(effects_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    /**
     * 触发置顶的依赖
     */
    function triggerEffect(effect) {
        // 这里又会执行一次依赖收集
        // 比如：effect(() => {document.querySelector('#p1').innerText = obj.name})触发getter
        // 但是key: set<ReactiveEffect>结构会去重
        effect.run();
    }
    /**
     * effect函数
     * @param fn 执行方法
     * @returns 以ReactiveEffect实例为this的执行函数
     */
    // 调用 effect 方法
    // effect(() => {
    //   document.querySelector('#app').innerText = obj.name
    // })
    function effect(fn) {
        // 生成ReactiveEffect实例
        var _effect = new ReactiveEffect(fn);
        // 执行run函数
        _effect.run();
    }
    /**
     * 单例的，当前的effect
     */
    var activeEffect;
    /**
     * 响应性触发依赖时的执行类
     */
    var ReactiveEffect = /** @class */ (function () {
        // fnStr: string
        // constructor: 这是类的构造函数，用于初始化类的新实例。
        // public fn: 这是一个公共（public）属性 fn 的声明，它直接在构造函数的参数列表中被初始化。这意味着 fn 将成为类的一个公共属性，可以通过类的实例直接访问。
        // () => T: 这定义了 fn 的类型。fn 必须是一个无参数的函数，并且它的返回类型是由泛型 T 指定的。泛型 T 可以在类的使用过程中被指定为任何具体的类型。
        // 整体来说，这段代码的作用是在创建类的新实例时，需要传入一个无参数的函数，该函数的返回值类型是泛型 T。这个函数会被保存为类实例的 fn 属性，可以在后续的代码中调用。
        function ReactiveEffect(fn) {
            this.fn = fn;
            // this.fnStr = fn.toString()
        }
        ReactiveEffect.prototype.run = function () {
            // 为activeEffect赋值
            activeEffect = this;
            // 执行fn函数
            return this.fn();
        };
        return ReactiveEffect;
    }());

    /**
     * getter回调方法
     */
    var get = createGetter();
    /**
     * 创建getter回调方法
     */
    function createGetter() {
        return function get(target, key, receiver) {
            // target 被代理的对象 {name: 张三}
            // receiver proxy实例 proxy {name: 张三}
            // 利用Reflect.get得到返回值
            var res = Reflect.get(target, key, receiver);
            // 依赖收集
            track(target, key);
            return res;
        };
    }
    /**
     * setter回调方法
     */
    var set = createSetter();
    /**
     * 创建setter回调方法
     */
    function createSetter() {
        return function set(target, key, value, receiver) {
            // 利用Reflect.set设置新值
            var result = Reflect.set(target, key, value, receiver);
            // 触发依赖收集
            trigger(target, key);
            return result;
        };
    }
    /**
     * 响应性的handler
     */
    var mutableHandlers = {
        get: get,
        set: set
    };

    /**
     * 响应性Map缓存对象 ps: 对于 WeakMap 而言，它存在两个比较重要的特性：1.key 必须是对象 2.key 是弱引用的
     * key: target
     * val: proxy
     */
    var reactiveMap = new WeakMap();
    /**
     * 为复杂数据类型，创建响应性对象
     * @param target 被代理对象
     * @returns 代理对象
     */
    function reactive(target) {
        return createReactiveObject(target, mutableHandlers, reactiveMap);
    }
    /**
     * 创建响应性对象
     * @param target 被代理对象
     * @param baseHandlers handle
     */
    function createReactiveObject(target, baseHandlers, proxyMap) {
        // 如果该实例已经被代理，则直接读取即可
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        // 未被代理则生成proxy实例
        var proxy = new Proxy(target, baseHandlers);
        // 缓存被代理对象
        proxyMap.set(target, proxy);
        // 返回生成的proxy实例
        return proxy;
    }

    exports.effect = effect;
    exports.reactive = reactive;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
