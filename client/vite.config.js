var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = __assign(__assign({}, loadEnv(mode, __dirname, '')), process.env);
    var basePath = (env.VITE_BASE_PATH || '/').replace(/\/+$/, '');
    return {
        base: "".concat(basePath, "/"),
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            host: true,
            port: 7333,
            strictPort: true,
        },
    };
});
