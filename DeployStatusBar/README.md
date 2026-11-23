# Deploy Status Bar

Click **Deploy** on the left side of the VS Code status bar to run a deploy
command in the open workspace folder. While it runs, the
status is yellow and cannot be clicked. On success it turns green; on failure
it turns red and shows an error notification. The result remains for 60 seconds
or until clicked again.

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

Configured commands run in an interactive VS Code task terminal in the
selected folder, using the configured task shell. Output and prompts are visible
there. Configure the terminal's default or automation profile if a particular
shell is required. If `deploy.json` is absent, the extension runs
`npm run deploy` silently as before, requiring Node.js and npm on the extension
host. Run that command in a terminal to see its output. Invalid or unreadable
configuration is reported as an error.

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
