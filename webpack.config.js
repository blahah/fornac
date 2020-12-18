const path = require('path')
const webpack = require('webpack')
console.log('process.env.NODE_PATH:', process.env.NODE_PATH)

module.exports = {
  mode: 'development',
  context: __dirname + '/app',
  entry: {
    fornac: './scripts/fornac.js',
    rnaplot: ['./scripts/rnaplot.js'],
    rnatreemap: './scripts/rnatreemap.js'
  },
  output: {
    path: __dirname + '/build',
    filename: '[name].js',
    libraryTarget: 'umd',
    library: '[name]'
  },
  resolve: {
    modules: [process.env.NODE_PATH || 'node_modules'],
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['@babel/preset-env']
        }
      }, {
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      }
    ]
  }
}
