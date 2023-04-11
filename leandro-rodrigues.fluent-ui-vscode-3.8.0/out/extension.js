"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = exports.getBase64Image = exports.CONTAINER = void 0;
// eslint-disable-next-line @typescript-eslint/naming-convention
const UglifyJS = require('uglify-js');
const cssnano = require("cssnano");
const fs = require("fs/promises");
const path = require("path");
const postcss_1 = require("postcss");
const vscode = require("vscode");
const sharp = require('sharp');
const backup_helper_1 = require("./backup-helper");
const wallpaper = require('wallpaper');
const messages_1 = require("./messages");
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// const path = require('path');
// import fetch from 'node-fetch';
const fetch = (url, init) => Promise.resolve().then(() => require('node-fetch')).then(({ default: fetch }) => fetch(url, init));
exports.CONTAINER = 'electron-sandbox';
function enabledRestart() {
    vscode.window
        .showInformationMessage(messages_1.messages.enabled, { title: messages_1.messages.restartIde })
        .then(reloadWindow);
}
function restart() {
    vscode.window
        .showInformationMessage(messages_1.messages.disabled, { title: messages_1.messages.restartIde })
        .then(reloadWindow);
}
function reloadWindow() {
    // reload vscode-window
    vscode.commands.executeCommand('workbench.action.reloadWindow');
}
const minifyCss = async (css) => {
    const output = await (0, postcss_1.default)([cssnano]).process(css);
    return output.css;
};
/**
 * Removes injected files from workbench.html file
 * @param  {} html
 */
function clearHTML(html) {
    html = html.replace(/<!-- FUI-CSS-START -->[\s\S]*?<!-- FUI-CSS-END -->\n*/, '');
    html = html.replace(/<!-- FUI-ID -->\n*/g, '');
    return html;
}
async function buildCSSTag(url, useThemeColors) {
    try {
        const fileName = path.join(__dirname, url);
        const fetched = await fs.readFile(fileName);
        const miniCSS = await minifyCss(fetched);
        return `<style>${miniCSS}</style>\n`;
    }
    catch (e) {
        console.error(e);
        vscode.window.showWarningMessage(messages_1.messages.cannotLoad + url);
        return '';
    }
}
async function getBase64Image() {
    try {
        const wallPath = await wallpaper.get();
        if (wallPath) {
            const blurredImage = await sharp(wallPath).blur(100).toBuffer();
            return `data:image/png;base64,${blurredImage.toString('base64')}`;
        }
        return false;
    }
    catch (e) {
        vscode.window.showInformationMessage(messages_1.messages.admin);
        throw e;
    }
}
exports.getBase64Image = getBase64Image;
async function getTags(target, compact, lite) {
    const config = vscode.workspace.getConfiguration('fluent-ui-vscode');
    const activeTheme = vscode.window.activeColorTheme;
    const isDark = activeTheme.kind === 2;
    const isCompact = config.get('compact');
    const enableBg = config.get('enableWallpaper');
    const accent = `${config.get('accent')}`;
    const darkBgColor = `${config.get('darkBackground')}b3`;
    const lightBgColor = `${config.get('lightBackground')}b3`;
    let encodedImage = false;
    if (enableBg) {
        encodedImage = await getBase64Image();
    }
    if (target === 'styles') {
        let res = '';
        const styles = ['/css/editor_chrome.css', isDark ? '/css/dark_vars.css' : ''];
        for (const url of styles) {
            let imp = await buildCSSTag(url);
            if (imp) {
                if (url.includes('dark')) {
                    imp = imp.replace('CARD_DARK_BG_COLOR', darkBgColor);
                }
                else {
                    imp = imp.replace('CARD_LIGHT_BG_COLOR', lightBgColor);
                    imp = imp.replace('ACCENT_COLOR', accent);
                }
                if (!enableBg) {
                    imp = imp.replace('APP_BG', 'transparent');
                }
                else {
                    imp = imp.replace('APP_BG', 'var(--card-bg)');
                }
                res += imp;
            }
        }
        if (encodedImage) {
            // Replace --app-bg value on res
            res = res.replace('dummy', encodedImage);
        }
        return res;
    }
    if (target === 'javascript') {
        let res = '';
        const url = '/js/theme_template.js';
        const jsTemplate = await fs.readFile(__dirname + url);
        let buffer = jsTemplate.toString();
        buffer = buffer.replace(/\[IS_COMPACT\]/g, String(isCompact));
        buffer = buffer.replace(/\[LIGHT_BG\]/g, `"${lightBgColor}"`);
        buffer = buffer.replace(/\[DARK_BG\]/g, `"${darkBgColor}"`);
        buffer = buffer.replace(/\[ACCENT\]/g, `"${accent}"`);
        const uglyJS = UglifyJS.minify(buffer);
        const tag = `<script type="application/javascript">${uglyJS.code}</script>\n`;
        if (tag) {
            res += tag;
        }
        return res;
    }
}
async function patch({ htmlFile, bypassMessage }) {
    let html = await fs.readFile(htmlFile, 'utf-8');
    html = clearHTML(html);
    html = html.replace(/<meta.*http-equiv="Content-Security-Policy".*>/, '');
    const styleTags = await getTags('styles');
    // Inject style tag into <head>
    html = html.replace(/(<\/head>)/, '<!-- FUI-CSS-START -->\n' + styleTags + '\n<!-- FUI-CSS-END -->\n</head>');
    const jsTags = await getTags('javascript');
    // Injext JS tag into <body>
    html = html.replace(/(<\/html>)/, `<!-- FUI-ID -->\n` + '<!-- FUI-JS-START -->\n' + jsTags + '\n<!-- FUI-JS-END -->\n</html>');
    try {
        await fs.writeFile(htmlFile, html, 'utf-8');
        if (bypassMessage) {
            reloadWindow();
        }
        else {
            enabledRestart();
        }
    }
    catch (e) {
        vscode.window.showInformationMessage(messages_1.messages.admin);
    }
}
function activate(context) {
    const appDir = path.dirname(require.main.filename);
    const base = path.join(appDir, 'vs', 'code');
    const htmlFile = path.join(base, exports.CONTAINER, 'workbench', 'workbench.html');
    /**
     * Installs full version
     */
    async function install(bypassMessage) {
        if (!bypassMessage) {
            const backupUuid = await (0, backup_helper_1.getBackupUuid)(htmlFile);
            if (backupUuid) {
                vscode.window.showInformationMessage(messages_1.messages.alreadySet);
                return;
            }
        }
        await (0, backup_helper_1.createBackup)(base, htmlFile);
        await patch({ htmlFile, bypassMessage });
    }
    async function uninstall() {
        await clearPatch();
        restart();
    }
    async function clearPatch() {
        const backupUuid = await (0, backup_helper_1.getBackupUuid)(htmlFile);
        if (!backupUuid) {
            return;
        }
        const backupPath = (0, backup_helper_1.buildBackupFilePath)(base);
        await (0, backup_helper_1.restoreBackup)(backupPath, htmlFile);
        await (0, backup_helper_1.deleteBackupFiles)(htmlFile);
    }
    const installFUI = vscode.commands.registerCommand('fluent-ui-vscode.enableEffects', install);
    const reloadFUI = vscode.commands.registerCommand('fluent-ui-vscode.reloadEffects', async () => {
        await clearPatch();
        install(true);
    });
    const uninstallFUI = vscode.commands.registerCommand('fluent-ui-vscode.disableEffects', uninstall);
    context.subscriptions.push(installFUI);
    context.subscriptions.push(reloadFUI);
    context.subscriptions.push(uninstallFUI);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map