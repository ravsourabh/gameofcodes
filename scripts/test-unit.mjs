// Discover Node unit tests consistently on Windows and Unix, including new waves.
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const files=(await readdir('tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
if(!files.length)throw Error('No unit tests found.');
const child=spawn(process.execPath,['--test','--test-concurrency=4',...files],{stdio:'inherit'});
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
