// MIT License Copyright (c) 2017 Carl Taylor
var importVueComponent = (function () {
    var r = "importVueComponent requires ";
    if (!fetch) throw new Error(r + "fetch api polyfill (https://github.com/github/fetch)");
    if (!Promise) throw new Error(r + "Promise api or polyfill (https://github.com/Ziriax/Promistix)");
    if (!Vue) throw new Error(r + "Vue (https://unpkg.com/vue)");

    var active = 0;
    var statusListeners = [];

    function statusReport() {
        for (var i = 0; i < statusListeners.length; i++) {
            if (active === 1) {
                statusListeners[i](true);
            } else if (active === 0) {
                statusListeners[i](false);
            }
        }
    }

    function resolveLocation(type, location) {
        if (!location || location.constructor !== String) {
            console.error("Could not load:", type, location);
        } else if (ivc.locations[location]) {
            return ivc.locations[location];
        } else if (location.startsWith("//") || location.startsWith("http")) {
            return location;
        } else {
            if (ivc.prefixes[type] !== void 0) location = ivc.prefixes[type] + location;
            if (ivc.suffixes[type] !== void 0) location = location + ivc.suffixes[type];
            if (location.startsWith("$basePath")) {
                if (ivc.basePath === void 0) throw new Error("loadVueComponent.basePath or contextPath is not set. Cannot determine where to load components from.");
                location = ivc.basePath + location.substr("$basePath".length);
            }
        }
        return location;
    }

    function finalize(resolve, obj, template, name, jsName) {
        if (obj.processTemplate) template = obj.processTemplate(template);
        if (!obj.name) obj.name = name;
        obj.template = template;
        //console.log("finalizing", name);
        window[jsName] = obj;
        resolve(obj);
    }

    var jsDepPromises = {};

    function handleAsyncComponent(resolve, obj, template, name, jsName) {
        if (obj.require) {
            //console.log("loading deps for", name);
            var promises = [];
            for (var jsDepName in obj.require) {
                if (obj.require.hasOwnProperty(jsDepName)) {
                    var depJsLocation = obj.require[jsDepName];
                    if (window[jsDepName]) {
                        //console.log("already load ed", jsDepName);
                        promises.push(window[jsDepName]);
                    } else if (jsDepPromises[jsDepName] !== void 0) {
                        //console.log("reusing-loader", jsDepName);
                        promises.push(jsDepPromises[jsDepName]);
                    } else {
                        //console.log("loading", jsDepName);
                        jsDepPromises[jsDepName] = function (src) {
                            return new Promise(function (resolve, reject) {
                                if (src.lastIndexOf(".js") === src.length - 3) {
                                    var script = document.createElement('script');
                                    script.onload = resolve;
                                    script.onerror = reject;
                                    script.async = true;
                                    script.src = src;
                                    document.body.appendChild(script);
                                } else {
                                    var link = document.createElement('link');
                                    link.rel = 'stylesheet';
                                    link.type = 'text/css';
                                    link.href = src;
                                    link.media = 'all';
                                    document.body.appendChild(link);
                                    resolve();
                                }
                            });
                        }(resolveLocation("lib", depJsLocation));
                        promises.push(jsDepPromises[jsDepName]);
                    }
                }
            }
            Promise.all(promises).then(function () {
                //console.log("finished loading deps for", name);
                for (var jsDepName in obj.require) {
                    if (obj.require.hasOwnProperty(jsDepName)) {
                        delete jsDepPromises[jsDepName];
                    }
                }
                if (obj.then && obj.then.constructor === Function) {
                    finalize(resolve, obj.then(), template, name, jsName);
                } else {
                    finalize(resolve, obj, template, name, jsName);
                }
            });
        } else {
            finalize(resolve, obj, template, name, jsName);
        }
    }

    function ivc(name, location, jsName) {
        location = location || name;
        jsName = jsName || name;

        // We may have already loaded this
        if (window[jsName] && (window[jsName].constructor instanceof Function || window[jsName] instanceof Object)) {
            //console.log("Reusing loading definition", name);
            return window[jsName];
        }

        // console.log("Loading definition", name);
        var resolve;
        var reject;
        var promise = new Promise(function (_resolve, _reject) {
            resolve = _resolve;
            reject = _reject
        });

        function retrieve() {
            fetch(resolveLocation("vue", location)).then(function (rsp) {
                return rsp.text();
            }).then(function (content) {
                var div = document.createElement('div');
                div.innerHTML = content;
                var template = '';
                var children = Array.prototype.slice.call(div.children);
                var obj = null;
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (child.tagName === 'STYLE') {
                        document.head.appendChild(child);
                    } else if (child.tagName === 'SCRIPT') {
                        eval(child.innerText);
                        obj = window[jsName];
                        window[jsName] = promise;
                    } else if (child.outerHTML) {
                        if (template) console.error("Vue component " + name + " should wrap it's template in one element");
                        template = child.outerHTML;
                    }
                }
                if (!template) console.error("Vue component " + name + " should wrap it's template in one element");
                handleAsyncComponent(resolve, obj, template, name, jsName);
            });
        }

        if (ivc.eager) retrieve();

        Vue.component(name, window[jsName] = function (resolve) {
            if (!ivc.eager) retrieve();
            active++;
            statusReport();
            promise.then(resolve).then(function () {
                if (--active === 0) statusReport();
            });
        });
        return window[jsName];
    }

    ivc.eager = true;
    ivc.locations = {};
    ivc.prefixes = {
        vue: "$basePath/vue/",
        lib: "$basePath/vendor/"
    };
    ivc.suffixes = {
        vue: ".vue.html"
    };
    ivc.basePath = "";

    ivc.track = function (statusListener) {
        statusListeners.push(statusListener);
        statusListener(active !== 0);
    };

    return ivc;
})();
