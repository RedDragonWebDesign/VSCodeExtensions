const assert = require( 'node:assert/strict' );
const { EventEmitter } = require( 'node:events' );
const fs = require( 'node:fs' );
const Module = require( 'node:module' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const childProcess = require( 'node:child_process' );
const { test } = require( 'node:test' );

function setup( folders, useRealSpawn = false ) {
	const status = { show() {}, dispose() {} };
	const errors = [];
	const children = [];
	const calls = [];
	const timers = [];
	let command;
	let selectedFolder;
	const vscode = {
		StatusBarAlignment: { Left: 1 },
		window: {
			createStatusBarItem: () => status,
			showErrorMessage: ( message ) => errors.push( message ),
			showWorkspaceFolderPick: async () => selectedFolder
		},
		workspace: { workspaceFolders: folders },
		commands: {
			registerCommand: ( name, callback ) => {
				command = callback;
				return { dispose() {} };
			}
		}
	};
	const originalLoad = Module._load;
	const originalSpawn = childProcess.spawn;
	const originalSetTimeout = global.setTimeout;
	const originalClearTimeout = global.clearTimeout;
	Module._load = function ( request, ...args ) {
		return request === 'vscode' ? vscode : originalLoad.call( this, request, ...args );
	};
	childProcess.spawn = ( ...args ) => {
		calls.push( args );
		const child = useRealSpawn ? originalSpawn( ...args ) : new EventEmitter();
		children.push( child );
		return child;
	};
	global.setTimeout = ( callback, delay ) => {
		const timer = { callback, delay, cleared: false };
		timers.push( timer );
		return timer;
	};
	global.clearTimeout = ( timer ) => {
		if ( timer ) {
			timer.cleared = true;
		}
	};

	const context = { subscriptions: [] };
	delete require.cache[ require.resolve( '../extension' ) ];
	require( '../extension' ).activate( context );

	return {
		status, errors, children, calls, timers, context,
		run: () => command(),
		select: ( folder ) => { selectedFolder = folder; },
		restore: () => {
			Module._load = originalLoad;
			childProcess.spawn = originalSpawn;
			global.setTimeout = originalSetTimeout;
			global.clearTimeout = originalClearTimeout;
			delete require.cache[ require.resolve( '../extension' ) ];
		}
	};
}

const folder = { uri: { scheme: 'file', fsPath: 'workspace-folder' } };

test( 'disables clicking during deploy and shows success for one minute', async ( t ) => {
	const app = setup( [ folder ] );
	t.after( app.restore );
	assert.equal( app.status.text, 'Deploy' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );

	await app.run();
	assert.equal( app.status.text, 'Deploy in progress' );
	assert.equal( app.status.color, '#ffcc00' );
	assert.equal( app.status.command, undefined );
	await app.run();
	assert.equal( app.calls.length, 1 );
	const [ command, args, options ] = app.calls[ 0 ];
	if ( process.platform === 'win32' ) {
		assert.equal( command, process.env.ComSpec || 'cmd.exe' );
		assert.deepEqual( args, [ '/d', '/s', '/c', 'npm run deploy' ] );
	} else {
		assert.equal( command, 'npm' );
		assert.deepEqual( args, [ 'run', 'deploy' ] );
	}
	assert.equal( options.cwd, folder.uri.fsPath );
	assert.equal( options.stdio, 'ignore' );
	assert.equal( options.windowsHide, true );
	app.children[ 0 ].emit( 'close', 0, null );
	assert.equal( app.status.color, '#00c853' );
	assert.equal( app.status.text, 'Deploy successful' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );
	assert.equal( app.timers[ 0 ].delay, 60000 );
	app.timers[ 0 ].callback();
	assert.equal( app.status.color, undefined );
	assert.equal( app.status.text, 'Deploy' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );
	assert.deepEqual( app.errors, [] );
} );

test( 'clears prior success and reports failed and unstartable deploys', async ( t ) => {
	const app = setup( [ folder ] );
	t.after( app.restore );
	await app.run();
	app.children[ 0 ].emit( 'close', 0, null );
	await app.run();
	assert.equal( app.timers[ 0 ].cleared, true );
	assert.equal( app.status.color, '#ffcc00' );
	assert.equal( app.status.text, 'Deploy in progress' );
	app.children[ 1 ].emit( 'close', 1, null );
	assert.match( app.errors[ 0 ], /exit code 1/ );
	assert.equal( app.status.text, 'Deploy failed' );
	assert.equal( app.status.color, '#f14c4c' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );
	assert.equal( app.timers[ 1 ].delay, 60000 );
	await app.run();
	assert.equal( app.timers[ 1 ].cleared, true );
	assert.equal( app.status.text, 'Deploy in progress' );
	assert.equal( app.status.color, '#ffcc00' );
	app.children[ 2 ].emit( 'error', new Error( 'npm not found' ) );
	app.children[ 2 ].emit( 'close', -2, null );
	assert.match( app.errors[ 1 ], /npm not found/ );
	assert.equal( app.status.text, 'Deploy failed' );
	assert.equal( app.status.color, '#f14c4c' );
	assert.equal( app.timers[ 2 ].delay, 60000 );
	app.timers[ 2 ].callback();
	assert.equal( app.status.color, undefined );
	assert.equal( app.status.text, 'Deploy' );
} );

test( 'requires a local folder and uses the selected multi-root folder', async ( t ) => {
	const app = setup( [] );
	t.after( app.restore );
	await app.run();
	assert.match( app.errors[ 0 ], /open workspace folder/ );
	assert.equal( app.status.text, 'Deploy failed' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );
	const remoteFolder = { uri: { scheme: 'other', fsPath: 'remote' } };
	const vscode = require( 'vscode' );
	vscode.workspace.workspaceFolders = [ folder, remoteFolder ];
	app.select( undefined );
	const selection = app.run();
	assert.equal( app.status.text, 'Deploy in progress' );
	assert.equal( app.status.command, undefined );
	await selection;
	assert.equal( app.calls.length, 0 );
	assert.equal( app.status.text, 'Deploy' );
	assert.equal( app.status.command, 'deployStatusBar.deploy' );
	assert.equal( app.timers[ 0 ].cleared, true );
	app.select( remoteFolder );
	await app.run();
	assert.match( app.errors[ 1 ], /local workspace folder/ );
	assert.equal( app.status.text, 'Deploy failed' );
	app.select( folder );
	await app.run();
	assert.equal( app.calls[ 0 ][ 2 ].cwd, folder.uri.fsPath );
} );

test( 'runs an actual npm deploy script', async ( t ) => {
	const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'deploy-status-test-' ) );
	const manifest = path.join( directory, 'package.json' );
	fs.writeFileSync( manifest, JSON.stringify( {
		scripts: { deploy: 'node -e "process.exit(0)"' }
	} ) );
	const app = setup( [ { uri: { scheme: 'file', fsPath: directory } } ], true );
	t.after( () => {
		app.restore();
		fs.unlinkSync( manifest );
		fs.rmdirSync( directory );
	} );
	await app.run();
	await new Promise( ( resolve ) => app.children[ 0 ].once( 'close', resolve ) );
	assert.deepEqual( app.errors, [] );
	assert.equal( app.status.color, '#00c853' );
	assert.equal( app.status.text, 'Deploy successful' );
	assert.equal( app.timers[ 0 ].delay, 60000 );
} );
