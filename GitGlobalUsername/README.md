# Git Global Username

A small VS Code extension that displays the global Git `user.name` in the
left side of the status bar. It checks Git every two seconds, so changes made
outside VS Code are picked up without reloading the window.

The extension reads `git config --global --get user.name`. It does not show
repository-local `user.name` values.

On Windows, click the status bar item to choose and run a shortcut named
`GitHub change to *.lnk` from your user profile's `Desktop` folder. PowerShell
must be available on the extension host. The shortcut runs with your normal
user permissions; the displayed name updates when Git's configuration changes.

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

   This creates `git-global-username-1.0.0.vsix` in this folder.

4. In VS Code, open the Command Palette (`Ctrl+Shift+P`), run
   **Extensions: Install from VSIX...**, and select that `.vsix` file.
5. Reload VS Code if prompted. The username appears in the status bar.
