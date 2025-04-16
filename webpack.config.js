const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');

const ENVIRONMENT = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const ENVIRONMENT_VARS = {
    development: require('./env.development.json'),
    production: require('./env.production.json')
};
const BUILD_DIR = process.env.BUILD_DIR ? path.resolve(process.env.BUILD_DIR) : path.resolve(__dirname, './build');

module.exports = {
    entry: './src/Messenger.ts',
    output: {
        path: path.resolve(__dirname, process.env.BUILD_DIR || 'build'),
        filename: ENVIRONMENT === 'production' ? '[name].min.js' : '[name].js',
        libraryTarget: 'umd',
        chunkFilename: '[id].[chunkhash].js'
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [
        new CleanWebpackPlugin({
            root: BUILD_DIR,
            verbose: true
        }),
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    watchOptions: {
        ignored: [
            'dist/**',
            'example/**',
            'node_modules/**'
        ]
    }
};

if (ENVIRONMENT === 'development') {
    console.log('Mode: DEVELOPMENT');
    module.exports.devtool = 'eval-source-map';
} else if (ENVIRONMENT === 'production') {
    console.log('Mode: PRODUCTION');
    // module.exports.devtool = 'source-map';
    module.exports.plugins = (module.exports.plugins || []).concat([
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"'
            }
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: true
        }),
        new FileManagerPlugin({
            events: {
                onEnd: {
                    move: [
                        {
                            source: './dist/main.min.js',
                            destination: './dist/classify-administration.min.js'
                        }
                    ],
                    delete: ['./dist/main.min.js.map', './dist/vendors-bundle.min.js.map']
                }
            }
        })
    ]);
    module.exports.optimization = {
        splitChunks: {
            cacheGroups: {
                commons: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors-bundle',
                    chunks: 'all'
                }
            }
        },
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    sourceMap: false,
                    ie8: false
                }
            })
        ]
    };
}