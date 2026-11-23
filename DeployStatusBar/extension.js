const { spawn } = require( 'node:child_process' );
const vscode = require( 'vscode' );

const RESULT_DURATION_MS = 60000;
const DEPLOY_COMMAND = 'deployStatusBar.deploy';

function activate( context ) {
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);
	statusBarItem.name = 'Deploy';
	statusBarItem.text = 'Deploy';
	statusBarItem.tooltip = 'Run npm run deploy';
	statusBarItem.command = DEPLOY_COMMAND;
	statusBarItem.show();
	context.subscriptions.push( statusBarItem );

	let running = false;
	let resultTimer;

	function resetStatus() {
		statusBarItem.text = 'Deploy';
		statusBarItem.color = undefined;
		statusBarItem.tooltip = 'Run npm run deploy';
		statusBarItem.command = DEPLOY_COMMAND;
	}

	function finishDeploy( success ) {
		running = false;
		statusBarItem.text = success ? 'Deploy successful' : 'Deploy failed';
		statusBarItem.color = success ? '#00c853' : '#f14c4c';
		statusBarItem.tooltip = 'Run npm run deploy';
		statusBarItem.command = DEPLOY_COMMAND;
		resultTimer = setTimeout( resetStatus, RESULT_DURATION_MS );
	}

	context.subscriptions.push( {
		dispose: () => clearTimeout( resultTimer )
	} );

	context.subscriptions.push( vscode.commands.registerCommand(
		DEPLOY_COMMAND,
		async () => {
			if ( running ) {
				return;
			}
			running = true;
			clearTimeout( resultTimer );
			statusBarItem.text = 'Deploy in progress';
			statusBarItem.color = '#ffcc00';
			statusBarItem.tooltip = 'Deploying...';
			statusBarItem.command = undefined;

			const folders = vscode.workspace.workspaceFolders || [];
			if ( folders.length === 0 ) {
				finishDeploy( false );
				vscode.window.showErrorMessage( 'Deploy requires an open workspace folder.' );
				return;
			}

			const folder = folders.length === 1 ?
				folders[ 0 ] :
				await vscode.window.showWorkspaceFolderPick( { placeHolder: 'Select a folder to deploy' } );
			if ( !folder ) {
				running = false;
				resetStatus();
				return;
			}
			if ( folder.uri.scheme !== 'file' ) {
				finishDeploy( false );
				vscode.window.showErrorMessage( 'Deploy requires a local workspace folder.' );
				return;
			}

			const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
			const args = process.platform === 'win32' ? [ '/d', '/s', '/c', 'npm run deploy' ] : [ 'run', 'deploy' ];
			const child = spawn( command, args, {
				cwd: folder.uri.fsPath,
				stdio: 'ignore',
				windowsHide: true
			} );

			let startError;
			child.on( 'error', ( error ) => {
				startError = error;
			} );
			child.on( 'close', ( code, signal ) => {
				if ( startError ) {
					finishDeploy( false );
					vscode.window.showErrorMessage( `Could not start npm deploy: ${ startError.message }` );
				} else if ( code === 0 ) {
					finishDeploy( true );
				} else {
					finishDeploy( false );
					const detail = signal ? `signal ${ signal }` : `exit code ${ code }`;
					vscode.window.showErrorMessage( `npm run deploy failed (${ detail }). Run it in a terminal for details.` );
				}
			} );
		}
	) );
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};
