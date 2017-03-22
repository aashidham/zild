//var id0 = process.argv[2];

//var root_dir = require('os').homedir();

//var pid_path = 

var fs = require('fs');
var net = require('net');
var spawn = require('child_process').spawn;
var path = require('path');
var events = require('events')
var post_events = new events();

var root_dir = require('os').homedir();

var spawn2 = require('child_pty').spawn;
var ON_DEATH = require('death');
var request = require('request');
var uuid = require('uuid/v4');

var id0 = process.argv[2];
var project_dir = path.join(root_dir,".zild", id0);

var global_config_path = path.join(root_dir,".zild", "globals.json");
var project_config_path = path.join(project_dir,"config.json");
if(!fs.existsSync(project_config_path)) 
{
	console.log("Incorrect process ID, called with a process that doesn't exist");
	process.exit(1);
}

var project_config = JSON.parse(fs.readFileSync(project_config_path));
var global_config = JSON.parse(fs.readFileSync(global_config_path));

project_config.token = global_config.token;
project_config.hostname = global_config.hostname;
project_config.cmp_name = global_config.cmp_name;


var sock_file = path.join(project_dir, "s.sock");
var quit_ref_count = 0;
var data_lines_count = 0;



var server = net.createServer(function(sock) {
	//sock.write("\n");
	sock_arr.push(sock);
}).listen(sock_file);

//TODO: figure out why this won't detect rm s.sock
//inside eager_fermat_1490043212442
//after figuring this out, we have to disable this because server.close() invokes this and 
//doesnt wait for POST calls
server.on("close", function(){
	//console.log("detected close");
	//process.exit();
})

server.on("end", function(){
	//console.log("detected end");
	//process.exit();
})

fs.watch(project_dir, (eventType, filename) => { 
	if(filename === "s.sock"){
		console.log([eventType, filename]);
		console.log(fs.existsSync(sock_file));
		console.log("[[socket file deleted?]]");
	}
});


var sock_arr = [];


var print_out = function(data)
{
	console.log("B");
	var data = ""+data;
	//log to STDOUT will be ignored by z, but if this is run directly, can be viewed for debugging purposes
	console.log(data);
	for (var i = 0, len = sock_arr.length; i < len; i++) {
		var sock0 = sock_arr[i];
		if(sock0 && !sock0.destroyed)
		{
			sock0.write(data);
		}		
	}
}


var write3_common = function(data, stderr)
{
	var data = ""+data;
	data_lines_count++;
	var send_obj = JSON.parse(JSON.stringify(project_config));
	send_obj.data = data;
	send_obj.data_chunk = data_lines_count;
	send_obj.stderr = ""+stderr;
	console.log(send_obj);
	quit_ref_count++;
	console.log("A");
	request.post( 'https://zild.io/shell_data', {json: send_obj}, 
		function(e,r,b){
			if(e) {console.log(e); }
			quit_ref_count--;
			console.log("shell_data result");
			console.log(b);
			post_events.emit("post_response_done");
		});
	print_out(data);
}



//make POST call, write to log, write to IPC
var write3_stdout = function(data){write3_common(data, false);}

var write3_stderr = function(data){write3_common(data, true);}


var add_cb = function(proc_curr)
{
	console.log("Z");
	console.log(proc_curr.pid);
	project_config.pid = proc_curr.pid;
	project_config.process_id = uuid();

	//TODO: figure out why setEncoding becomes undefined inside spawn2
	//proc_curr.stdout.setEncoding('utf8');
	//proc_curr.stderr.setEncoding('utf8');
	//TODO: figure out why these arent printing out
	print_out(proc_curr.pty.columns); //80
	print_out(proc_curr.pty.rows); //24

	quit_ref_count++;
	console.log("start_process project_config");
	console.log(project_config);
	request.post( 'https://zild.io/start_process', {json: project_config}, 
		function(e,r,b){
			if(e) {console.log(e); }
			quit_ref_count--;
			console.log("start_process result");
			console.log(b);
			post_events.emit("post_response_done");
		});

	proc_curr.stdout.on('data', write3_stdout);
	proc_curr.stderr.on('data', write3_stderr); 
	//we need these listeners to close this manager when the process it manages closes
	//otherwise the server prevents natural closing
	proc_curr.on('error', function(e) { print_out(e); server.close(); process.exit(); });
	proc_curr.on('close', function(code, signal) { 
		var close_code = ""+code;
		if(signal) close_code = close_code + " " +signal;
		quit_ref_count++;
		request.post( 'https://zild.io/stop_process', {json: {token: project_config.token, close_code: close_code, process_id: project_config.process_id}}, 
			function(e,r,b){
				if(e) {console.log(e); }
				quit_ref_count--;
				console.log("stop_process result");
				console.log(b);
				post_events.emit("post_response_done");
			});
		if(code !== 0) {
			if(!signal) print_out("Process closed with code "+code+"\n");	
			else print_out("Process closed with code "+code+" and signal "+signal+"\n");	
		} 
		server.close(); 
		//TODO: this may not be the correct solution, since it is possible to emit before anybody is listening
		//then what if this event never gets emitted later? practically this hasnt happened but it is weird
		post_events.on("post_response_done", function() {if(quit_ref_count < 1) process.exit()});
	})
}

//add_cb(spawn("bash",["-c","ping 8.8.8.8"]));
add_cb(spawn2( process.env.SHELL || "bash",["-c",project_config.bash_cmd], {cwd: project_config.cwd } ));

ON_DEATH(function(signal, err) {
	server.close();
	process.exit();
});