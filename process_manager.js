//var id0 = process.argv[2];

//var root_dir = require('os').homedir();

//var pid_path = 

var fs = require('fs');
var net = require('net');
var spawn = require('child_process').spawn;

var path = require('path');
var root_dir = require('os').homedir();

var id0 = process.argv[2];
var project_dir = path.join(root_dir,".zild", id0);

var project_config = JSON.parse(fs.readFileSync(path.join(project_dir,"config.json")));
var sock_file = path.join(project_dir, "s.sock");

var server = net.createServer(function(sock) {
	sock_arr.push(sock);
}).listen(sock_file);

var sock_arr = [];

var print_out = function(data)
{
	//console.log(data);
	for (var i = 0, len = sock_arr.length; i < len; i++) {
		var sock0 = sock_arr[i];
		if(sock0 && !sock0.destroyed)
		{
			sock0.write(data);
		}		
	}
}




//make POST call, write to log, write to IPC
var write3 = function(data)
{

}

var add_cb = function(proc_curr)
{
	proc_curr.stdout.setEncoding('utf8');
	proc_curr.stderr.setEncoding('utf8');
	proc_curr.stdout.on('data', print_out);
	proc_curr.stderr.on('data', print_out); 
	//we need these listeners to close this manager when the process it manages closes
	//otherwise the server prevents natural closing
	proc_curr.on('error', function(e) { print_out(e); server.close(); process.exit(); });
	proc_curr.on('close', function(code, signal) { 
		if(code !== 0) {
			if(!signal)
			{
				print_out("Process closed with code "+code+"\n");	
			}
			else
			{
				print_out("Process closed with code "+code+" and signal "+signal+"\n");	
			}
		} 
		server.close(); 
		process.exit(); 
	})
}

//add_cb(spawn("bash",["-c","ping 8.8.8.8"]));
add_cb(spawn("bash",["-c",project_config.bash_cmd], {cwd: project_config.cwd } ));

var ON_DEATH = require('death');
ON_DEATH(function(signal, err) {
	server.close();
	process.exit();
});