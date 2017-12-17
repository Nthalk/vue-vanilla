// MIT License Copyright (c) 2017 Carl Taylor
var importVueComponent = (function () {
    var rf;
    if (!fetch) rf = "fetch api polyfill (https://github.com/github/fetch)";
    if (!Promise) rf = "Promise api or polyfill (https://github.com/Ziriax/Promistix)";
    if (!Vue) rf = "Vue (https://unpkg.com/vue)";
    if (rf) throw new Error("importVueComponent requires " + rf);

    var w = window;
    var d = document;

    var active = 0;
    var statusListeners = [];
    var loadedCss = [];
    var jsDepPromises = {};

    function statusReport() {
        var isActive = active === 1;
        if (isActive || active === 0) for (var i = 0; i < statusListeners.length; i++) statusListeners[i](isActive);
    }

    function finalize(resolve, obj, template, name, jsName) {
        if (obj.processTemplate) template = obj.processTemplate(template);
        if (!obj.name) obj.name = name;
        obj.template = template;
        //console.log("finalizing", name);
        w[jsName] = obj;
        resolve(obj);
    }

    function ivc(name, location, jsName) {
        location = location || name;
        jsName = jsName || name;

        // We may have already loaded this
        if (w[jsName] && (w[jsName].constructor === Function || w[jsName].constructor === Object)) {
            //console.log("Reusing loading definition", name);
            return w[jsName];
        }

        // console.log("Loading definition", name);
        var resolve, reject;
        var promise = new Promise(function (_resolve, _reject) {
            resolve = _resolve;
            reject = _reject
        });

        function retrieve() {
            fetch(ivc.location(location, "vue")).then(function (rsp) {
                return rsp.text();
            }).then(function (content) {
                var div = d.createElement('div');
                div.innerHTML = content;
                var template = '';
                var children = Array.prototype.slice.call(div.children);
                var obj = null;
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (child.tagName === 'STYLE') {
                        d.head.appendChild(child);
                    } else if (child.tagName === 'SCRIPT') {
                        eval(child.innerText);
                        obj = w[jsName];
                        w[jsName] = promise;
                    } else if (child.outerHTML) {
                        if (template) throw new Error("Vue component " + name + " should wrap it's template in one element");
                        template = child.outerHTML;
                    }
                }

                if (!template) throw new Error("Vue component " + name + " should wrap it's template in one element");
                if (!obj) throw new Error("loadVueComponent component" + jsName + " is not defined after loading component, did you forget to set the definition on the global scope? e.g. window['" + jsName + "'] = {}")

                if (obj.require) {
                    //console.log("loading deps for", name);
                    var promises = [];
                    for (var jsDepName in obj.require) {
                        if (!obj.require.hasOwnProperty(jsDepName)) continue;
                        var depJsLocation = obj.require[jsDepName];
                        if (w[jsDepName]) {
                            //console.log("already load ed", jsDepName);
                            promises.push(w[jsDepName]);
                        } else if (jsDepPromises[jsDepName] !== void 0) {
                            //console.log("reusing-loader", jsDepName);
                            promises.push(jsDepPromises[jsDepName]);
                        } else {
                            //console.log("loading", jsDepName);
                            jsDepPromises[jsDepName] = function (src) {
                                return new Promise(function (resolve, reject) {
                                    if (src.lastIndexOf(".js") === src.length - 3) {
                                        var script = d.createElement('script');
                                        script.onload = resolve;
                                        script.onerror = reject;
                                        script.async = true;
                                        script.src = src;
                                        d.head.appendChild(script);
                                    } else {
                                        if (loadedCss.indexOf(src) === -1) {
                                            loadedCss.push(src);
                                            var link = d.createElement('link');
                                            link.rel = 'stylesheet';
                                            link.type = 'text/css';
                                            link.href = src;
                                            link.media = 'all';
                                            d.head.appendChild(link);
                                        }
                                        // Auto resolve css
                                        resolve();
                                    }
                                });
                            }(ivc.location(depJsLocation, "lib"));
                            promises.push(jsDepPromises[jsDepName]);
                        }
                    }
                    Promise.all(promises).then(function () {
                        //console.log("finished loading deps for", name);
                        for (var jsDepName in obj.require) if (obj.require.hasOwnProperty(jsDepName)) delete jsDepPromises[jsDepName];
                        if (obj.then) obj = obj.then.constructor === Function ? obj.then() : obj.then;
                        finalize(resolve, obj, template, name, jsName);
                    });
                } else {
                    finalize(resolve, obj, template, name, jsName);
                }
            });
        }

        if (ivc.eager) retrieve();

        Vue.component(name, w[jsName] = function (resolve) {
            if (!ivc.eager) retrieve();
            active++;
            statusReport();
            promise.then(resolve).then(function () {
                if (--active === 0) statusReport();
            });
        });
        return w[jsName];
    }

    /**
     * Define how to resolve a location given a type
     */
    var r = ivc.location = function (location, type) {
        if (!location || location.constructor !== String) throw new Error("Could not load:" + type + " resource at " + location);
        if (r.overrides[location]) return r.overrides[location];
        if (location.indexOf("//") === 0 || location.indexOf("http") === 0) return location;
        if (r.prefixes[type] !== void 0) location = r.prefixes[type] + location;
        if (r.suffixes[type] !== void 0) location = location + r.suffixes[type];
        if (location.indexOf("$basePath") === 0) {
            if (r.basePath === void 0) throw new Error("loadVueComponent.basePath or contextPath is not set. Cannot determine where to load components from.");
            location = r.basePath + location.substr("$basePath".length);
        }
        return location;
    };
    r.overrides = {};
    r.prefixes = {
        vue: "$basePath/vue/",
        lib: "$basePath/vendor/"
    };
    r.suffixes = {
        vue: ".vue.html"
    };
    r.basePath = "";

    ivc.eager = false;

    ivc.track = function (statusListener) {
        statusListeners.push(statusListener);
        statusListener(active !== 0);
    };
    ivc.onceLoaded = function (cb) {
        if (active === 0) {
            cb();
            return;
        }
        var a;
        statusListeners.push(a = function (loaded) {
            if (!loaded) return;
            cb();
            statusListeners.splice(statusListeners.indexOf(a), 1);
        })
    };

    return ivc;
})();
