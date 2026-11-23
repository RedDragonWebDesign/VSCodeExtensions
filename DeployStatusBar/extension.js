const { spawn } = require( 'node:child_process' );
const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );
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
	statusBarItem.tooltip = 'Deploy workspace';
	statusBarItem.command = DEPLOY_COMMAND;
	statusBarItem.show();
	context.subscriptions.push( statusBarItem );

	let running = false;
	let resultTimer;
	let taskId = 0;

	function resetStatus() {
		statusBarItem.text = 'Deploy';
		statusBarItem.color = undefined;
		statusBarItem.tooltip = 'Deploy workspace';
		statusBarItem.command = DEPLOY_COMMAND;
	}

	function finishDeploy( success ) {
		running = false;
		statusBarItem.text = success ? 'Deploy successful' : 'Deploy failed';
		statusBarItem.color = success ? '#00c853' : '#f14c4c';
		statusBarItem.tooltip = 'Deploy workspace';
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

			let config;
			try {
				config = await fs.readFile( path.join( folder.uri.fsPath, 'deploy.json' ), 'utf8' );
			} catch ( error ) {
				if ( error.code !== 'ENOENT' ) {
					finishDeploy( false );
					vscode.window.showErrorMessage( `Could not read deploy.json: ${ error.message }` );
					return;
				}
			}

			if ( config !== undefined ) {
				let entries;
				try {
					const parsed = JSON.parse( config );
					if ( !parsed || typeof parsed !== 'object' || Array.isArray( parsed ) ||
						Object.keys( parsed ).length === 0 ||
						Object.entries( parsed ).some( ( [ name, value ] ) =>
							!name.trim() || typeof value !== 'string' || !value.trim() ) ) {
						throw new Error( 'Expected a non-empty object of names and PowerShell commands.' );
					}
					entries = Object.entries( parsed ).map( ( [ label, value ] ) => ( { label, command: value } ) );
				} catch ( error ) {
					finishDeploy( false );
					vscode.window.showErrorMessage( `Invalid deploy.json: ${ error.message }` );
					return;
				}

				const selected = await vscode.window.showQuickPick( entries, { placeHolder: 'Select a deploy command' } );
				if ( !selected ) {
					running = false;
					resetStatus();
					return;
				}
				const definition = { type: 'deployStatusBar', id: ++taskId };
				const task = new vscode.Task(
					definition, folder, `Deploy "${ selected.label }"`, 'Deploy Status Bar',
					new vscode.ShellExecution( selected.command, { cwd: folder.uri.fsPath } )
				);
				task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, focus: true };

				let finished = false;
				const isDeployTask = ( event ) =>
					event.execution.task.definition.type === definition.type &&
					event.execution.task.definition.id === definition.id;
				const complete = ( code ) => {
					if ( finished ) {
						return;
					}
					finished = true;
					processListener.dispose();
					endListener.dispose();
					finishDeploy( code === 0 );
					if ( code !== 0 ) {
						const detail = code === undefined ? 'no exit code' : `exit code ${ code }`;
						vscode.window.showErrorMessage( `Deploy "${ selected.label }" failed (${ detail }). See the task terminal for details.` );
					}
				};
				const processListener = vscode.tasks.onDidEndTaskProcess( ( event ) => {
					if ( isDeployTask( event ) ) {
						complete( event.exitCode );
					}
				} );
				const endListener = vscode.tasks.onDidEndTask( ( event ) => {
					if ( isDeployTask( event ) ) {
						complete( undefined );
					}
				} );
				context.subscriptions.push( processListener, endListener );
				try {
					await vscode.tasks.executeTask( task );
				} catch ( error ) {
					if ( !finished ) {
						finished = true;
						processListener.dispose();
						endListener.dispose();
						finishDeploy( false );
						vscode.window.showErrorMessage( `Could not start Deploy "${ selected.label }": ${ error.message }` );
					}
				}
				return;
			}
			const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
			const args = process.platform === 'win32' ? [ '/d', '/s', '/c', 'npm run deploy' ] : [ 'run', 'deploy' ];
			const description = 'npm run deploy';
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
					vscode.window.showErrorMessage( `Could not start ${ description }: ${ startError.message }` );
				} else if ( code === 0 ) {
					finishDeploy( true );
				} else {
					finishDeploy( false );
					const detail = signal ? `signal ${ signal }` : `exit code ${ code }`;
					vscode.window.showErrorMessage( `${ description } failed (${ detail }). Run it in a terminal for details.` );
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
