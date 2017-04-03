#!/usr/bin/env node

var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');
var path = require('path');
var root_dir = process.env.ZILD_ROOT || require('os').homedir();

var utile = require('utile');
var dockerNames = require('docker-names');
var colors = require('colors/safe');
var request = require('request');
var nssocket = require('nssocket');

var call_zild_api = function(str, data, cb)
{
	var port_no = 8000;
	request.post( "https://zild.io:"+port_no+"/"+str, data, cb );
}


var pkg_file_name = path.join(__dirname,"package.json");
var version_raw = JSON.parse(fs.readFileSync(pkg_file_name)).version;
var version = "v"+version_raw.replace(/[^a-zA-z0-9]/g,"");

var curr_time = new Date().getTime();
var bash_cmd = process.argv.slice(2).join(" ");
var id1 = bash_cmd.replace(/[^a-zA-z0-9]/g,"").substr(0,20);
if(!id1) id1 = dockerNames.getRandomName();
var id1_base = id1;
var id1_ctr = 0;
var project_dir;
while(true)
{
	project_dir = path.join(root_dir,".zild", version, id1);
	if(fs.existsSync(project_dir))
	{
		id1 = id1_base + "_" + id1_ctr;
		id1_ctr = id1_ctr + 1;
	}
	else 
	{
		id1_ctr = id1_ctr - 1;
		break;
	}
}

var project_config = {bash_cmd: bash_cmd, cwd: process.cwd(), id0: id1, start_time: curr_time};
var sock_file = path.join(project_dir, "s.sock");

var proc_mon_path = path.join(__dirname, "process_manager.js");

var child;

var global_config_path = path.join(root_dir,".zild", version, "globals.json");
if(!fs.existsSync(global_config_path)) 
{
	console.log("It doesn't look like you have logged in yet.");
	console.log("Run 'zild login' to login to an account or 'zild register' to create a new one.");
	process.exit();
}
var global_config = JSON.parse(fs.readFileSync(global_config_path));

call_zild_api( 'check_token', {json: {token: global_config.token }, timeout: 2000}, 
function(e,r,b){
	if(e) 
	{
		console.log("Error with checking token. Zild service may be down, or your token may have expired.");
		process.exit();
	}
	if(b.err)
	{
		console.log(b.msg);
		process.exit();
	}

	utile.mkdirp(project_dir, function(err){
		if(err) { console.error(err); process.exit(); }
		else 
		{
			setup_and_go();
		}
	});

});


var setup_and_go = function()
{
	fs.writeFileSync(path.join(project_dir, "config.json"), JSON.stringify(project_config));
	var proc_mon_log = path.join(project_dir, "proc_mon.log");
	var outFD = fs.openSync(proc_mon_log, 'a');
	var errFD = fs.openSync(proc_mon_log, 'a');

	var invok = 'node '+ proc_mon_path + ' ' + project_config.id0;
	child = spawn('bash', ['-c', invok], {detached: true, stdio: ['ignore', outFD, errFD]});
	child.unref();

	
	if(process.env.ZILD_IMMEDIATE_DETACH) {
		console.log(colors.green("[['"+project_config.bash_cmd+"' (PID: "+(parseInt(child.pid)+1)+") in progress. It has zild id '"+project_config.id0+"'. Run 'zild attach "+project_config.id0+"' to reattach to it.]]"));
		process.exit();
	}

	

	//we shouldnt need this listeners below, but process.stdin prevents natural exit.
	child.on('error', function(e) { 
		console.log(colors.red("There is some error with zild. Please file an issue."));
		console.log(e); process.exit(); 
	});
	child.on('close', function(code,signal) { 
		if(code !== 0) {
			console.log(colors.red("There is some error with zild. Please file an issue."));
			if(!signal)
			{
				console.log(colors.red("Zild closed with code "+code+"\n"));	
			}
			else
			{
				console.log(colors.red("Zild closed with code "+code+" and signal "+signal+"\n"));
			}
		} 
		console.log(colors.green("[[Process '"+project_config.bash_cmd+"' completed.]]"));
		process.exit(); 
	});

	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on('data', function(chunk) {
		console.log(colors.green("\r\n[[ ✓ Process "+(parseInt(child.pid)+1)+" detached! Run 'zild attach "+project_config.id0+"' to reattach to it.]]"));
		process.exit(0);
	});

}

if(!process.env.ZILD_IMMEDIATE_DETACH) {
	var client = new nssocket.NsSocket();
	client.connect(sock_file, function(){
		console.log(colors.green("[['"+project_config.bash_cmd+"' (PID: "+(parseInt(child.pid)+1)+") in progress. It has zild id '"+project_config.id0+"'. Press any key to detach.]]"));
	});
	client.on('error', function(err) {
		client.connect(sock_file);
	});
	client.data('log' ,function(data) {
		process.stdout.write(data);
	});
}