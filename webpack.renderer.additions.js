const WorkboxPlugin = require('workbox-webpack-plugin')

module.exports = {
    plugins: [
        new WorkboxPlugin.GenerateSW({
            // Do not precache images
            exclude: [/\.(?:png|jpg|jpeg|svg)$/],

            // Define runtime caching rules.
            runtimeCaching: [{
                // Match any request that ends with .png, .jpg, .jpeg or .svg.
                urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
                // Apply a cache-first strategy.
                handler: 'CacheFirst',
                options: {
                    cacheName: 'images',
                    // Only cache 10 images.
                    expiration: {
                        maxEntries: 64,
                        maxAgeSeconds: 60 * 15
                    },
                },
            },
            // any LCLPNetwork URL regex: /https:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]+\.)?lclpnet\.work\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
            {
                // match any LCLPNetwork request
                urlPattern: /https:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]+\.)?lclpnet\.work\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'backend',
                    expiration: {
                        maxAgeSeconds: 60 * 15,
                        maxEntries: 1024
                    }
                }
            }],
        })
    ]
}