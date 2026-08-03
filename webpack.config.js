const path = require('path');
const webpack = require('webpack');

const TerserPlugin = require('terser-webpack-plugin');

const ENVIRONMENT = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const BUILD_DIR = process.env.BUILD_DIR ? path.resolve(process.env.BUILD_DIR) : path.resolve(__dirname, './build');

const ENTRY = './src/Messenger.ts';

const resolve = {
    extensions: ['.ts', '.js'],
    alias: {
        '@': path.resolve(__dirname, 'src')
    },
    symlinks: false
};

// Declarations are emitted once by `npm run build:types`. Without this the three
// production compilers would each race to write the same .d.ts files.
const tsRule = {
    test: /\.ts$/,
    exclude: /node_modules/,
    loader: 'esbuild-loader',
    options: {
        loader: 'ts',
        // Keep in step with `target` in tsconfig.json and the config targets below.
        target: 'es2020'
    }
};

// Amplify owns a process-wide singleton: `Amplify.configure()` writes to it and
// `events.connect()` reads from it. Two copies of the library in one app means
// the copy this bundle configured is not the copy that connects. So the module
// builds leave aws-amplify to the host app, which is what the peerDependency
// declares. The UMD build is the deliberate exception — see below.
const EXTERNAL_AMPLIFY = ['aws-amplify', 'aws-amplify/data'];

const baseConfig = {
    entry: ENTRY,
    mode: ENVIRONMENT,
    devtool: 'source-map',
    resolve,
    module: { rules: [tsRule] },
    watchOptions: {
        ignored: ['dist/**', 'example/**', 'node_modules/**']
    }
};

const productionPlugins = () => [
    new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production')
    })
];

/**
 * UMD bundle — the <script src> / unpkg entry point, and what the demo page
 * loads. This is the one build that bundles Amplify: a script tag has no module
 * resolution, so a self-contained file is the only thing that works. Exposes
 * `FrontendMessenger` as a browser global.
 */
const umdConfig = {
    ...baseConfig,
    name: 'umd',
    target: ['web', 'es2020'],
    output: {
        path: BUILD_DIR,
        library: {
            name: 'FrontendMessenger',
            type: 'umd'
        },
        globalObject: 'this',
        filename: ENVIRONMENT === 'production' ? 'frontend-messenger.min.js' : 'frontend-messenger.js'
    },
    plugins: ENVIRONMENT === 'production' ? productionPlugins() : [],
    optimization:
        ENVIRONMENT === 'production'
            ? {
                  minimize: true,
                  minimizer: [new TerserPlugin({ extractComments: false })]
              }
            : { minimize: false }
};

/**
 * ESM bundle — what bundlers resolve via the "import" condition. Left
 * unminified so downstream tooling can tree-shake and minify it in context.
 */
const esmConfig = {
    ...baseConfig,
    name: 'esm',
    target: 'web',
    experiments: { outputModule: true },
    externals: EXTERNAL_AMPLIFY,
    externalsType: 'module',
    output: {
        path: BUILD_DIR,
        filename: 'frontend-messenger.mjs',
        library: { type: 'module' },
        environment: { module: true, dynamicImport: true }
    },
    plugins: productionPlugins(),
    optimization: { minimize: false }
};

/**
 * CommonJS bundle — the "require" condition, for Node-based consumers and
 * older bundler setups.
 */
const cjsConfig = {
    ...baseConfig,
    name: 'cjs',
    target: ['web', 'es2020'],
    externals: EXTERNAL_AMPLIFY,
    externalsType: 'commonjs',
    output: {
        path: BUILD_DIR,
        filename: 'frontend-messenger.cjs',
        library: { type: 'commonjs2' }
    },
    plugins: productionPlugins(),
    optimization: { minimize: false }
};

if (ENVIRONMENT === 'production') {
    console.log('Mode: PRODUCTION');
    module.exports = [umdConfig, esmConfig, cjsConfig];
} else {
    console.log('Mode: DEVELOPMENT');
    module.exports = umdConfig;
}
