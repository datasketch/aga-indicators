const common = require('./webpack.common')
const merge = require('webpack-merge')
const path = require('path')

function resolve (dir) {
  return path.resolve(__dirname, '..', dir)
}

module.exports = merge(common, {
  mode: 'development',
  output: {
    filename: 'js/[name].js'
  },
  devServer: {
    contentBase: resolve('docs'),
    port: 8080,
    stats: 'errors-only'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
})
