Defer = (function () {
    function empty_list(list) {
        list = list || {};
        list.next = null;
        list.tail = list;
        return list;
    }

    function append_node(list, node) {
        list.tail.next = node;
        list.tail = node;
    }

    var WAIT = 0,
        DONE = 1,
        FAIL = 2,
        last_pipe_state_id = 3,
        queued_thunks = empty_list();

    function run_queued() {
        var thunk = queued_thunks.next;
        empty_list(queued_thunks);

        while (thunk) {
            var state = thunk.state,
                value = thunk.value,
                then = thunk.thens,
                thunk = thunk.next;

            while (then) {
                var cfn = then[state],
                    next_value = value,
                    next_state = state;
                if (typeof cfn === "function") {
                    try {
                        next_value = cfn(next_value);
                        next_state = DONE;
                    } catch (error) {
                        next_value = error;
                        next_state = FAIL;
                    }
                }
                transit(then.deferred, next_state, next_value);
                then = then.next;
            }
        }
    }

    function defer() {
        var def = empty_list({
            state: WAIT,
            value: "",
            promise: {
                then: function (res, rej) {
                    return then(def, res, rej);
                }
            },
            resolve: function (value) {
                transit(def, DONE, value);
            },
            reject: function (value) {
                transit(def, FAIL, value);
            }
        });
        return def;
    }

    defer.all = function (promises) {
        var done = defer();
        var values = [];
        var count = promises.length;

        function handle(index, isSuccess) {
            return function (value) {
                count--;
                if (isSuccess) {
                    values[index] = value;
                    if (count === 0) done.resolve(values);
                } else done.reject(value);
            }
        }

        for (var i = 0; i < count; i++) {
            promises[i].then(handle(i, true), handle(i, false));
        }
        return done.promise;
    };

    function schedule(def) {
        var thunk = {state: def.state, value: def.value, thens: def.next, next: null};
        empty_list(def);
        append_node(queued_thunks, thunk);
        if (queued_thunks.next === thunk)
            Promistix.schedule(run_queued);
    }

    function then(def, done, fail) {
        var then = {1: done, 2: fail, deferred: defer(), next: null};
        append_node(def, then);
        if (def.state !== WAIT)
            schedule(def);
        return then.deferred.promise;
    }

    function pipe(def, id, state, value) {
        if (def.state === id) {
            def.state = WAIT;
            transit(def, state, value);
        }
    }

    function fill(def, state, value) {
        def.value = value;
        def.state = state;
        schedule(def);
    }

    function transit(def, state, value) {
        if (def.state !== WAIT)
            return;

        if (typeof value === "function" || (typeof value === "object" && value !== null)) {
            try {
                if (value === def.promise)
                    throw new TypeError("A promise cannot return itself");
                var then = value.then;
                if (state === DONE && typeof then === "function") {
                    def.promise.then = then.bind(value);
                    var id = def.state = last_pipe_state_id++;
                    try {
                        then.call(value,
                            function (next) {
                                pipe(def, id, DONE, next);
                            }, function (next) {
                                pipe(def, id, FAIL, next);
                            });
                    } catch (error1) {
                        if (def.state === id)
                            fill(def, FAIL, error1);
                    }
                    return;
                }
            } catch (error2) {
                value = error2;
                state = FAIL;
            }
        }
        fill(def, state, value);
    }

    var Promistix = {
        schedule: setImmediate
    };

    return defer;
})();
