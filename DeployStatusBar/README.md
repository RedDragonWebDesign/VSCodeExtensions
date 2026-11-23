# Deploy Status Bar

Click **Deploy** on the left side of the VS Code status bar to run
`npm run deploy` silently in the open workspace folder. While it runs, the
status is yellow and cannot be clicked. On success it turns green; on failure
it turns red and shows an error notification. The result remains for 60 seconds
or until clicked again. Run the command in a terminal to see its output.

In a multi-folder workspace, select the folder to deploy. Only one deploy can
run at a time. This extension requires a trusted, local workspace and Node.js
and npm available on the extension host.

## Install

1. Install Node.js if it is not already installed.
2. Open a terminal in this folder:

   ```powershell
   cd path\to\VSCodeExtensions\DeployStatusBar
   ```

3. Package the extension:

   ```powershell
   npx --yes @vscode/vsce package
   ```

4. In VS Code, run **Extensions: Install from VSIX...** from the Command
   Palette and select the generated `.vsix` file. Reload if prompted.
