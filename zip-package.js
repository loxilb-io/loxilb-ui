const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const glob = require('glob');

const OUTPUT_NAME = 'release.zip';
const IGNORE_LIST = ['**/node_modules/**', '**/.git/**', '**/.DS_Store', '**/Thumbs.db', '**/*.log', 'dist/**', 'build/**', 'docs/**', '.idea/**'];

const cwd = process.cwd();
console.log('Working directory:', cwd);

const files = glob.sync('**/*', {
	cwd,
	dot: true,
	nodir: true,
	ignore: IGNORE_LIST,
});

console.log(`Files to archive: ${files.length}`);
files.slice(0, 10).forEach(f => console.log(' -', f));
if (files.length > 10) console.log(' ...');

const output = fs.createWriteStream(OUTPUT_NAME);
const archive = archiver('zip', {zlib: {level: 3}});

output.on('close', () => {
	const sizeKB = (archive.pointer() / 1024).toFixed(1);
	console.log(`Done. ${OUTPUT_NAME} (${sizeKB} KB)`);
});

archive.pipe(output);

files.forEach(file => {
	archive.file(path.join(cwd, file), {name: file});
});

archive.finalize();
