var spawn = require('child_process').spawn;
var net = require('net');

//var child = spawn('bash', ['-c', 'python multi.py'] , {detached: true, cwd: require('os').homedir(), stdio: 'ignore'});


var child = spawn('bash', ['-c', 'node process_manager.js'], {detached: true, stdio: ['ignore','ignore','ipc']});

//child.stdout.on('data', console.log);
//child.stderr.on('data', console.log);

child.on("message", function(d){
	client.connect({path:'s'});
});


process.stdin.on('data', function(chunk) {
	child.disconnect();
	child.unref();
	console.log(child.pid);
	process.exit(0);
});


var client = new net.Socket();


client.on('data' ,function(data) {
	console.log(""+data);
});