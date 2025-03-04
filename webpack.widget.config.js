const path = require('path');

module.exports = {
  entry: './src/widget/index.tsx',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    filename: 'widget.js',
    path: path.resolve(__dirname, 'public/widget'),
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};
