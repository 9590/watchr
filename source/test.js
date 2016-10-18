/* eslint no-console:0 no-sync:0 */

// Requires
const pathUtil = require('path')
const fsUtil = require('fs')
const balUtil = require('bal-util')
const rimraf = require('rimraf')
const extendr = require('extendr')
const {equal} = require('assert-helpers')
const {ok} = require('assert')
const joe = require('joe')
const {watch} = require('./index')

// =====================================
// Configuration

// Helpers
function wait (delay, fn) {
	console.log(`completed, waiting for ${delay}ms delay...`)
	return setTimeout(fn, delay)
}

// Test Data
const batchDelay = 10 * 1000
const fixturesPath = pathUtil.join(__dirname, '../test-output')
const writetree = {
	'a': 'a content',
	'b': {
		'b-a': 'b-a content',
		'b-b': 'b-b content'
	},
	'.c': {
		'c-a': 'c-a content'
	},
	'blah': 'blah content'
}


// =====================================
// Tests

function runTests (opts, describe, test) {
	// Prepare
	let watcher = null

	// Change detection
	let changes = []
	function checkChanges (expectedChanges, extraTest, next) {
		if ( !next ) {
			next = extraTest
			extraTest = null
		}
		wait(batchDelay, function () {
			if ( changes.length !== expectedChanges ) {
				console.log(changes)
			}
			equal(changes.length, expectedChanges, `${changes.length} changes ran out of ${expectedChanges} changes`)
			if ( extraTest ) {
				extraTest(changes)
			}
			changes = []
			next()
		})
	}
	function changeHappened (...args) {
		changes.push(args)
		console.log(`a watch event occured: ${changes.length}`, args)
	}

	// Files changes
	function writeFile (fileRelativePath) {
		const fileFullPath = pathUtil.join(fixturesPath, fileRelativePath)
		fsUtil.writeFileSync(fileFullPath, `${fileRelativePath} now has the random number ${Math.random()}`)
	}
	function deleteFile (fileRelativePath) {
		const fileFullPath = pathUtil.join(fixturesPath, fileRelativePath)
		fsUtil.unlinkSync(fileFullPath)
	}
	function makeDir (fileRelativePath) {
		const fileFullPath = pathUtil.join(fixturesPath, fileRelativePath)
		fsUtil.mkdirSync(fileFullPath, '700')
	}
	function renameFile (fileRelativePath1, fileRelativePath2) {
		const fileFullPath1 = pathUtil.join(fixturesPath, fileRelativePath1)
		const fileFullPath2 = pathUtil.join(fixturesPath, fileRelativePath2)
		fsUtil.renameSync(fileFullPath1, fileFullPath2)
	}

	// Tests
	test('remove old test files', function (done) {
		rimraf(fixturesPath, function (err) {
			done(err)
		})
	})

	test('write new test files', function (done) {
		balUtil.writetree(fixturesPath, writetree, function (err) {
			done(err)
		})
	})

	test('start watching', function (done) {
		const config = extendr.extend({
			path: fixturesPath,
			ignorePaths: [pathUtil.join(fixturesPath, 'blah')],
			ignoreHiddenFiles: true,
			on: {
				change: changeHappened,
				log: console.log
			},
			next (err, _watcher) {
				watcher = _watcher
				wait(batchDelay, function () {
					done(err)
				})
			}
		}, opts)
		watch(config)
	})

	test('detect write', function (done) {
		writeFile('a')
		writeFile('b/b-a')
		checkChanges(2, done)
	})

	test('detect write ignored on hidden files', function (done) {
		writeFile('.c/c-a')
		checkChanges(0, done)
	})

	test('detect write ignored on ignored files', function (done) {
		writeFile('blah')
		checkChanges(0, done)
	})

	test('detect delete', function (done) {
		deleteFile('b/b-b')
		checkChanges(
			1,
			function (changes) {
				// make sure previous stat is given
				if ( !changes[0][3] ) {
					console.log(changes[0])
				}
				ok(changes[0][3], 'previous stat not given to delete')
			},
			done
		)
	})

	test('detect delete ignored on hidden files', function (done) {
		deleteFile('.c/c-a')
		checkChanges(0, done)
	})

	test('detect delete ignored on ignored files', function (done) {
		deleteFile('blah')
		checkChanges(0, done)
	})

	test('detect mkdir', function (done) {
		makeDir('someNewDir1')
		checkChanges(1, done)
	})

	test('detect mkdir and write', function (done) {
		writeFile('someNewfile1')
		writeFile('someNewfile2')
		writeFile('someNewfile3')
		makeDir('someNewDir2')
		checkChanges(4, done)
	})

	test('detect rename', function (done) {
		renameFile('someNewfile1', 'someNewfilea')  // unlink, new
		checkChanges(2, done)
	})

	test('detect subdir file write', function (done) {
		writeFile('someNewDir1/someNewfile1')
		writeFile('someNewDir1/someNewfile2')
		checkChanges(2, done)
	})

	test('detect subdir file delete', function (done) {
		deleteFile('someNewDir1/someNewfile2')
		checkChanges(1, done)
	})

	test('stop watching', function () {
		watcher.close()
	})
}

// Run tests for each method
joe.describe('watchr', function (describe) {
	describe('watch', function (describe, test) {
		runTests({preferredMethods: ['watch', 'watchFile']}, describe, test)
	})
	describe('watchFile', function (describe, test) {
		runTests({preferredMethods: ['watchFile', 'watch']}, describe, test)
	})
})
