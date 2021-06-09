const webpackRenderer = require('electron-webpack/webpack.renderer.config.js')

module.exports = env => {
  return new Promise((resolve) => {

    webpackRenderer(env).then(rendererConfig => {

      /* add `raw-loader` */
      rendererConfig.module.rules.push({
        test: /\.(scss)$/,
        use: [{
            // inject CSS to page
            loader: 'style-loader'
          }, {
            // translates CSS into CommonJS modules
            loader: 'css-loader'
          }, {
            // Run postcss actions
            loader: 'postcss-loader',
            options: {
              // `postcssOptions` is needed for postcss 8.x;
              postcssOptions: {
                // postcss plugins, can be exported to postcss.config.js
                plugins: function () {
                  return [
                    require('autoprefixer')
                  ];
                }
              }
            }
          }, {
            // compiles Sass to CSS
            loader: 'sass-loader'
          }]
      })

      /* return modified config to webpack */
      resolve(rendererConfig)
    })
  })
}