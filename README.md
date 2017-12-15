vue-vanilla
===============

This is a small plain JavaScript component loader for Vue.js components. No node, no webpack, no transpiling, no 
nonsense.

Usage
---------------

Include `vue.js` and `import-vue-component.js` scripts. Because we require the `fetch` and `defer` apis and IE11 still
doesn't conform to some of those standards, you will need polyfills to satisfy users who don't know how miserable their 
browser choice makes everyone.

    <script src="https://unpkg.com/vue"></script>
    <script src="vendor/import-vue-component.js"></script>
    <script>
        // Thanks IE11
        if (!window.Defer) document.writeln('<script src="vendor/defer.js"></' + 'script>');
        if (!window.fetch) document.writeln('<script src="vendor/fetch.js"></' + 'script>');
    </script>
    <div class="app">
        <!-- Report if loading -->
        {{importerIsLoading ? "Loading" : "Loaded"}}
        
        <!-- Import custom component -->
        <my-component></my-component>
    </div>
    <script>
        // Register component for import
        importVueComponent("my-component");
        // Create basic application
        new Vue({
            el: '.app',
            data: {
                importerIsLoading: false
            },
            mounted: function(){
                var self = this;
                importVueComponent.track(function(isLoading){
                    self.importerIsLoading = isLoading
                });
            }
        });
    </script>
    
This will cause the client to attempt to load the `my-component` component from `/vue/my-component.vue.html`.

The source of `/vue/my-component.vue.html` could be as simple as:

    <style>
        .my-component {
            height: 10px;
            width: 10px;
            background: black;
        }
    </style>
    <div class="my-component">
        My component!
    </div>
    <script>
        // Standard Vue.component definition
        window['my-component'] = {
            data: function(){
                return {};
            }
        }
    </script>
    
Common, require, AMD, modules?!
---------------

This is vanilla js, if you need modules and requiring, then your situation is already too complicated to save.

However, there is async loading for components and their libraries:

    <script>
        window['my-component'] = {
            require: {
                // This loads from the configured lib directory default is $basePath$/lib
                jQuery: "jquery.min.js",
                // If _ is already visible on the global scope, then it will not be loaded again
                _: "underscore.min.js"
            },
            then: function(){
                // Here jQuery and _ will be available, so return the module definition
                return {
                
                }
            }
        }
    </script>

File size
----------------

Size is important, nobody likes load times and heavy requests!

| File                          | Gziped | Uncompressed |
|-------------------------------|--------|--------------|
| `import-vue-component.js`     | 1.59KB | 6.33KB       |
| `import-vue-component.min.js` | 1.09KB | 2.3KB        |

Requirements
----------------

  1. fetch (https://caniuse.com/#search=fetch)
  2. defer (https://caniuse.com/#search=defer)
  3. VueJs
