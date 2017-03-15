#!/usr/bin/env node

var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');
var path = require('path');
var root_dir = require('os').homedir();
var utile = require('utile');
var dockerNames = require('docker-names');


//var child = spawn('bash', ['-c', 'python multi.py'] , {detached: true, cwd: require('os').homedir(), stdio: 'ignore'});
var curr_time = new Date().getTime();
var id0 = dockerNames.getRandomName() + "_" + curr_time;
var project_dir = path.join(root_dir,".zild", id0);
var bash_cmd = process.argv.slice(2).join(" ");
var project_config = {bash_cmd: bash_cmd, cwd: process.cwd(), id0: id0};
var sock_file = path.join(project_dir, "s.sock");
console.log(project_config);

var proc_mon_path = path.join(__dirname, "process_manager.js");

var child;

utile.mkdirp(project_dir, function(err){
	if(err) { console.error(err); process.exit(); }
	else 
	{
		setup_and_go();
	}
})



//child.stdout.on('data', console.log);
//child.stderr.on('data', console.log);

var setup_and_go = function()
{
	fs.writeFileSync(path.join(project_dir, "config.json"), JSON.stringify(project_config));
	var invok = 'node '+ proc_mon_path + ' ' + id0;
	console.log("about to call "+ invok );
	child = spawn('bash', ['-c', invok], {detached: true, stdio: 'ignore'});
	child.unref();

	//we shouldnt need this listeners below, but process.stdin prevents natural exit.
	child.on('error', function(e) { 
		console.log(e); process.exit(); 
	});
	child.on('close', function(code,signal) { 
		if(code !== 0) {
			console.log("There is some error with zild. Please file an issue.");
			if(!signal)
			{
				console.log("Zild closed with code "+code+"\n");	
			}
			else
			{
				console.log("Zild closed with code "+code+" and signal "+signal+"\n");	
			}
		} 
		process.exit(); 
	});
}

process.stdin.on('data', function(chunk) {
	//child.disconnect();
	console.log(child.pid);
	process.exit(0);
});

 var client = new net.Socket();
 client.connect({path: sock_file});

 client.on('error', function(err) {
  //console.log("caught "+err);
  client.connect({path: sock_file});
});

client.on('data' ,function(data) {
    process.stdout.write(""+data);
});
