# Git Global Username

A small VS Code extension that displays the global Git `user.name` in the
status bar. It checks Git every two seconds, so changes made outside VS Code
are picked up without reloading the window.

The extension reads `git config --global --get user.name`. It does not show
repository-local `user.name` values.

## Install

1. Install Node.js if it is not already installed.
2. Open a terminal in this folder:

   ```powershell
   cd path\to\VSCodeExtensions\GitGlobalUsername
   ```

3. Package the extension:

   ```powershell
   npx --yes @vscode/vsce package
   ```

   This creates `git-global-username.vsix` in this folder.

4. In VS Code, open the Command Palette (`Ctrl+Shift+P`), run
   **Extensions: Install from VSIX...**, and select that `.vsix` file.
5. Reload VS Code if prompted. The username appears in the status bar.
