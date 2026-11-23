# Deploy Status Bar

Click **Deploy** on the left side of the VS Code status bar to run a deploy
command silently in the open workspace folder. While it runs, the
status is yellow and cannot be clicked. On success it turns green; on failure
it turns red and shows an error notification. The result remains for 60 seconds
or until clicked again. Run the command in a terminal to see its output.

In a multi-folder workspace, select the folder to deploy. Only one deploy can
run at a time. This extension requires a trusted, local workspace.

If the selected workspace folder has a `deploy.json` file at its root, choose
a command by name instead of running `npm run deploy`:

```json
{
  "Deploy staging": "npm run deploy:staging",
  "Deploy production": "npm run deploy:production"
}
```

Commands run in the selected folder using Windows PowerShell on Windows or
PowerShell (`pwsh`) on other platforms. PowerShell must be installed on the
extension host. If `deploy.json` is absent, the extension runs
`npm run deploy` as before, requiring Node.js and npm on the extension host.
Invalid or unreadable configuration is reported as an error. Deploy commands
run without terminal output.

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
