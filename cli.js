var spawn = require('child_process').spawn;


//var child = spawn('bash', ['-c', 'python multi.py'] , {detached: true, cwd: require('os').homedir(), stdio: 'ignore'});

//stdio: ['ipc','pipe', 'pipe']

var child = spawn('bash', ['-c', 'node a2.js'], {detached: true, stdio: ['ignore','ipc','ignore'] });

//child.stdout.on('data', console.log);
//child.stderr.on('data', console.log);

child.on("message", function(d){
	console.log(d);
});


process.stdin.on('data', function(chunk) {
	console.log('hey');
	child.disconnect();
	child.unref();
	console.log(child.pid);
	//process.exit(0);
});


/*
setTimeout(
function(){
	console.log('hey');
	child.disconnect();
	child.unref();
},2000);
*/
