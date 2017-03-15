var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');

//var child = spawn('bash', ['-c', 'python multi.py'] , {detached: true, cwd: require('os').homedir(), stdio: 'ignore'});


var child = spawn('bash', ['-c', 'node process_manager.js'], {detached: true, stdio: 'ignore'});

//child.stdout.on('data', console.log);
//child.stderr.on('data', console.log);

child.unref();

process.stdin.on('data', function(chunk) {
	//child.disconnect();
	console.log(child.pid);
	process.exit(0);
});

 var client = new net.Socket();
 client.connect({path:'s'});

 client.on('error', function(err) {
  //console.log("caught "+err);
  client.connect({path:'s'});
});

client.on('data' ,function(data) {
    process.stdout.write(""+data);
});
