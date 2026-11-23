const assert = require( 'node:assert/strict' );
const childProcess = require( 'node:child_process' );
const fs = require( 'node:fs' );
const Module = require( 'node:module' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { test } = require( 'node:test' );

function setup( responses, selection ) {
	const calls = [];
	const commands = {};
	const status = { show() {}, dispose() {} };
	const errors = [];
	const messages = [];
	let items;
	const vscode = {
		StatusBarAlignment: { Left: 1 },
		window: {
			createStatusBarItem: () => status,
			showErrorMessage: ( message ) => errors.push( message ),
			showInformationMessage: ( message ) => messages.push( message ),
			showQuickPick: async ( choices ) => {
				items = choices;
				return selection === undefined ? undefined : choices[ selection ];
			}
		},
		commands: {
			registerCommand: ( name, callback ) => {
				commands[ name ] = callback;
				return { dispose() {} };
			}
		}
	};
	const originalLoad = Module._load;
	Module._load = function ( request, ...args ) {
		if ( request === 'vscode' ) {
			return vscode;
		}
		if ( request === 'node:child_process' ) {
			return { execFile: ( command, args, options, callback ) => {
				if ( command === 'git' ) {
					callback( null, 'Current Name\n', '' );
					return;
				}
				calls.push( { command, args, options } );
				const response = responses.shift();
				callback( response.error || null, response.stdout || '', response.stderr || '' );
			} };
		}
		return originalLoad.call( this, request, ...args );
	};
	delete require.cache[ require.resolve( '../extension' ) ];
	const context = { subscriptions: [] };
	require( '../extension' ).activate( context );
	return {
		status, calls, errors, messages,
		items: () => items,
		run: () => commands[ status.command ](),
		restore: () => {
			context.subscriptions.forEach( ( item ) => item.dispose() );
			Module._load = originalLoad;
			delete require.cache[ require.resolve( '../extension' ) ];
		}
	};
}

test( 'lists matching shortcuts and runs the selected path without interpolating it into PowerShell', async ( t ) => {
	const path = "C:\\Users\\Me\\Desktop\\GitHub change to O'Brien & Co.lnk";
	const app = setup( [
		{ stdout: JSON.stringify( [
			{ BaseName: 'GitHub change to First', FullName: 'first.lnk' },
			{ BaseName: "GitHub change to O'Brien & Co", FullName: path }
		] ) },
		{}
	], 1 );
	t.after( app.restore );
	assert.equal( app.status.text, 'Git: Current Name' );
	assert.equal( app.status.command, 'gitGlobalUser.chooseShortcut' );
	await app.run();
	assert.deepEqual( app.items().map( ( item ) => item.label ), [
		'GitHub change to First', "GitHub change to O'Brien & Co"
	] );
	assert.equal( app.calls.length, 2 );
	assert.equal( app.calls[ 0 ].command, 'powershell.exe' );
	assert.match( app.calls[ 0 ].args.at( -1 ), /GitHub change to \*\.lnk/ );
	assert.equal( app.calls[ 1 ].options.env.GIT_GLOBAL_USERNAME_SHORTCUT, path );
	assert.ok( !app.calls[ 1 ].args.at( -1 ).includes( path ) );
	assert.deepEqual( app.errors, [] );
} );

test( 'reports no shortcuts and does not launch anything', async ( t ) => {
	const app = setup( [ { stdout: '[]' } ] );
	t.after( app.restore );
	await app.run();
	assert.match( app.messages[ 0 ], /No GitHub name-change shortcuts/ );
	assert.equal( app.calls.length, 1 );
} );

test( 'does nothing when the picker is cancelled', async ( t ) => {
	const app = setup( [ { stdout: '[{"BaseName":"GitHub change to One","FullName":"one.lnk"}]' } ] );
	t.after( app.restore );
	await app.run();
	assert.equal( app.calls.length, 1 );
	assert.deepEqual( app.errors, [] );
} );

test( 'reports search and launch failures', async ( t ) => {
	const app = setup( [
		{ error: new Error( 'search failed' ), stderr: 'Desktop unavailable' },
		{ stdout: '[{"BaseName":"GitHub change to One","FullName":"one.lnk"}]' },
		{ error: new Error( 'launch failed' ), stderr: 'Shortcut unavailable' }
	], 0 );
	t.after( app.restore );
	await app.run();
	await app.run();
	assert.match( app.errors[ 0 ], /Desktop unavailable/ );
	assert.match( app.errors[ 1 ], /Shortcut unavailable/ );
} );

test( 'finds and launches a real Windows shortcut', { skip: process.platform !== 'win32' }, async ( t ) => {
	const profile = fs.mkdtempSync( path.join( os.tmpdir(), 'git-username-test-' ) );
	const desktop = path.join( profile, 'Desktop' );
	const shortcut = path.join( desktop, 'GitHub change to Test.lnk' );
	const ignored = path.join( desktop, 'Other.lnk' );
	const script = path.join( profile, 'marker.ps1' );
	const marker = path.join( profile, 'marker.txt' );
	fs.mkdirSync( desktop );
	fs.writeFileSync( script, `Set-Content -LiteralPath '${ marker.replaceAll( "'", "''" ) }' -Value 'ok'` );
	fs.writeFileSync( ignored, '' );
	childProcess.execFileSync( 'powershell.exe', [
		'-NoProfile', '-NonInteractive', '-Command',
		'$shell = New-Object -ComObject WScript.Shell; ' +
		'$link = $shell.CreateShortcut($env:GIT_USERNAME_TEST_LINK); ' +
		'$link.TargetPath = (Get-Command powershell.exe).Source; ' +
		'$link.Arguments = \'-NoProfile -ExecutionPolicy Bypass -File "\' + $env:GIT_USERNAME_TEST_SCRIPT + \'"\'; ' +
		'$link.WindowStyle = 7; $link.Save()'
	], {
		env: { ...process.env, GIT_USERNAME_TEST_LINK: shortcut, GIT_USERNAME_TEST_SCRIPT: script },
		windowsHide: true
	} );
	const originalProfile = process.env.USERPROFILE;
	process.env.USERPROFILE = profile;
	const originalLoad = Module._load;
	const commands = {};
	const errors = [];
	let choices;
	const status = { show() {}, dispose() {} };
	Module._load = function ( request, ...args ) {
		if ( request === 'vscode' ) {
			return {
				StatusBarAlignment: { Left: 1 },
				window: {
					createStatusBarItem: () => status,
					showQuickPick: async ( items ) => { choices = items; return items[ 0 ]; },
					showErrorMessage: ( message ) => errors.push( message )
				},
				commands: { registerCommand: ( name, callback ) => {
					commands[ name ] = callback;
					return { dispose() {} };
				} }
			};
		}
		return originalLoad.call( this, request, ...args );
	};
	const context = { subscriptions: [] };
	delete require.cache[ require.resolve( '../extension' ) ];
	require( '../extension' ).activate( context );
	t.after( () => {
		context.subscriptions.forEach( ( item ) => item.dispose() );
		Module._load = originalLoad;
		delete require.cache[ require.resolve( '../extension' ) ];
		process.env.USERPROFILE = originalProfile;
		for ( const file of [ shortcut, ignored, script, marker ] ) {
			if ( fs.existsSync( file ) ) {
				fs.unlinkSync( file );
			}
		}
		fs.rmdirSync( desktop );
		const roaming = path.join( profile, 'AppData', 'Roaming' );
		if ( fs.existsSync( roaming ) ) {
			fs.rmdirSync( roaming );
			fs.rmdirSync( path.dirname( roaming ) );
		}
		fs.rmdirSync( profile );
	} );
	await commands[ status.command ]();
	assert.deepEqual( errors, [] );
	assert.deepEqual( choices.map( ( item ) => item.label ), [ 'GitHub change to Test' ] );
	for ( let i = 0; i < 100 && !fs.existsSync( marker ); i++ ) {
		await new Promise( ( resolve ) => setTimeout( resolve, 100 ) );
	}
	assert.equal( fs.readFileSync( marker, 'utf8' ).trim(), 'ok' );
} );
