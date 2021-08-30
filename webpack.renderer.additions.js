const WorkboxPlugin = require('workbox-webpack-plugin')

module.exports = {
    plugins: [
        new WorkboxPlugin.GenerateSW({
            // Do not precache anything (service worker will fail fetching file protocol which electron uses in production)
            exclude: [/[\s\S]*/],
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
            {
                // match any LCLPNetwork request and cache it
                urlPattern: /https:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]+\.)?lclpnet\.work\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'backend',
                    expiration: {
                        maxAgeSeconds: 30,
                        maxEntries: 1024
                    }
                }
            }],
        }),
    ]
}