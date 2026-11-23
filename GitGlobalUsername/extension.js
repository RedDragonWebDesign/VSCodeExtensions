const { execFile } = require( 'node:child_process' );
const vscode = require( 'vscode' );

const REFRESH_INTERVAL_MS = 2000;

function runPowerShell( script, env = process.env ) {
	return new Promise( ( resolve, reject ) => {
		execFile(
			'powershell.exe',
			[ '-NoProfile', '-NonInteractive', '-Command', script ],
			{ encoding: 'utf8', windowsHide: true, env },
			( error, stdout, stderr ) => {
				if ( error ) {
					reject( new Error( stderr.trim() || error.message ) );
					return;
				}
				resolve( stdout );
			}
		);
	} );
}

async function chooseUsernameShortcut() {
	try {
		const output = await runPowerShell(
			"$ErrorActionPreference = 'Stop'; " +
			'[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); ' +
			"$desktop = Join-Path $env:USERPROFILE 'Desktop'; " +
			"$shortcuts = @(Get-ChildItem -LiteralPath $desktop -Filter 'GitHub change to *.lnk' -File | " +
			'Select-Object BaseName, FullName); ' +
			'ConvertTo-Json -InputObject $shortcuts -Compress'
		);
		const shortcuts = JSON.parse( output );
		if ( shortcuts.length === 0 ) {
			vscode.window.showInformationMessage( 'No GitHub name-change shortcuts were found on your desktop.' );
			return;
		}

		const selected = await vscode.window.showQuickPick(
			shortcuts.map( ( shortcut ) => ( {
				label: shortcut.BaseName,
				path: shortcut.FullName
			} ) ),
			{ placeHolder: 'Choose a GitHub name-change shortcut to run' }
		);
		if ( selected ) {
			await runPowerShell(
				"$ErrorActionPreference = 'Stop'; Start-Process -FilePath $env:GIT_GLOBAL_USERNAME_SHORTCUT",
				{ ...process.env, GIT_GLOBAL_USERNAME_SHORTCUT: selected.path }
			);
		}
	} catch ( error ) {
		vscode.window.showErrorMessage( `Could not run GitHub name-change shortcut: ${ error.message }` );
	}
}

function activate( context ) {
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	statusBarItem.name = 'Git Global Username';
	statusBarItem.command = 'gitGlobalUser.chooseShortcut';
	statusBarItem.text = 'Git: checking...';
	statusBarItem.tooltip = 'Reading global Git user.name';
	statusBarItem.show();
	context.subscriptions.push( statusBarItem );

	let refreshInProgress = false;

	function refreshUsername() {
		if ( refreshInProgress ) {
			return;
		}

		refreshInProgress = true;
		execFile(
			'git',
			[ 'config', '--global', '--get', 'user.name' ],
			{ encoding: 'utf8', windowsHide: true },
			( error, stdout, stderr ) => {
				refreshInProgress = false;

				if ( !error ) {
					const username = stdout.trim();
					statusBarItem.text = username ? `Git: ${ username }` : 'Git: (not set)';
					statusBarItem.tooltip = username ?
						`Global Git user.name: ${ username }. Click to run a name-change shortcut.` :
						'No global Git user.name is configured. Click to run a name-change shortcut.';
					return;
				}

				if ( error.code === 1 && !stderr.trim() ) {
					statusBarItem.text = 'Git: (not set)';
					statusBarItem.tooltip = 'No global Git user.name is configured. Click to run a name-change shortcut.';
					return;
				}

				const detail = stderr.trim() || error.message;
				statusBarItem.text = '$(warning) Git name unavailable';
				statusBarItem.tooltip = `Could not read global Git user.name: ${ detail }`;
			}
		);
	}

	const refreshCommand = vscode.commands.registerCommand(
		'gitGlobalUser.refresh',
		refreshUsername
	);
	context.subscriptions.push( refreshCommand );
	context.subscriptions.push( vscode.commands.registerCommand(
		'gitGlobalUser.chooseShortcut',
		chooseUsernameShortcut
	) );

	const pollingTimer = setInterval( refreshUsername, REFRESH_INTERVAL_MS );
	context.subscriptions.push( {
		dispose: () => clearInterval( pollingTimer )
	} );

	refreshUsername();
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
