"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBackupFilePath = exports.restoreBackup = exports.getBackupUuid = exports.createBackup = exports.deleteBackupFiles = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("node:fs/promises");
const messages_1 = require("./messages");
const extension_1 = require("./extension");
/**
 * Deletes backup files matching UUID
 *
 * @param {*} htmlFile
 */
async function deleteBackupFiles(htmlFile) {
    const htmlDir = path.dirname(htmlFile);
    const htmlDirItems = await fs.readdir(htmlDir);
    for (const item of htmlDirItems) {
        if (item.includes('bak-fui')) {
            await fs.unlink(path.join(htmlDir, item));
        }
    }
}
exports.deleteBackupFiles = deleteBackupFiles;
function clearExistingPatches(html) {
    html = html.replace(/^.*(<!-- Fluent UI --><script src="fluent.js"><\/script><!-- Fluent UI -->).*\n?/gm, '');
    html = html.replace(/<!-- FUI -->[\s\S]*?<!-- FUI -->\n*/, '');
    html = html.replace(/<!-- FUI-ID [\w-]+ -->\n*/g, '');
    return html;
}
/**
 * Creates a backup file from the current workspace.html
 */
async function createBackup(base, htmlFile) {
    try {
        let html = await fs.readFile(htmlFile, 'utf-8');
        await fs.writeFile((0, exports.buildBackupFilePath)(base), html, 'utf-8');
    }
    catch (e) {
        vscode.window.showInformationMessage(messages_1.messages.admin);
        throw e;
    }
}
exports.createBackup = createBackup;
async function getBackupUuid(htmlFilePath) {
    try {
        const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
        const match = htmlContent.match(/<!-- FUI-ID -->/);
        if (!match) {
            return null;
        }
        else {
            return match[0];
        }
    }
    catch (e) {
        vscode.window.showInformationMessage(`${messages_1.messages.genericError}${e}`);
    }
}
exports.getBackupUuid = getBackupUuid;
/**
 * Restores the backed up workbench.html file
 */
async function restoreBackup(backupFilePath, htmlFile) {
    try {
        const stat = await fs.stat(backupFilePath);
        if (stat.isFile()) {
            await fs.unlink(htmlFile);
            await fs.copyFile(backupFilePath, htmlFile);
        }
    }
    catch (e) {
        vscode.window.showInformationMessage(messages_1.messages.admin);
        throw e;
    }
}
exports.restoreBackup = restoreBackup;
/**
 * Generates the path for the backup file we're creating
 */
const buildBackupFilePath = (base) => path.join(base, extension_1.CONTAINER, 'workbench', `workbench.bak-fui`);
exports.buildBackupFilePath = buildBackupFilePath;
//# sourceMappingURL=backup-helper.js.map