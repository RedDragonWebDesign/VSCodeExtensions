const { execFile } = require( 'node:child_process' );
const vscode = require( 'vscode' );

const REFRESH_INTERVAL_MS = 2000;

function activate( context ) {
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100
	);
	statusBarItem.name = 'Git Global Username';
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
						`Global Git user.name: ${ username }` :
						'No global Git user.name is configured.';
					return;
				}

				if ( error.code === 1 && !stderr.trim() ) {
					statusBarItem.text = 'Git: (not set)';
					statusBarItem.tooltip = 'No global Git user.name is configured.';
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
