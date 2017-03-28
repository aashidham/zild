//var id0 = process.argv[2];

//var root_dir = require('os').homedir();

//var pid_path = 

var fs = require('fs');
var net = require('net');
var spawn = require('child_process').spawn;
var path = require('path');
var events = require('events')
var post_events = new events();

var root_dir = process.env.ZILD_ROOT || require('os').homedir();

var spawn2 = require('child_pty').spawn;
var ON_DEATH = require('death');
var request = require('request');
var uuid = require('uuid/v4');

var id0 = process.argv[2];
var project_dir = path.join(root_dir,".zild", id0);

function msToTime(duration_s) {
		var duration = duration_s * 1000;
        var milliseconds = parseInt((duration%1000)/100)
            , seconds = parseInt((duration/1000)%60)
            , minutes = parseInt((duration/(1000*60))%60)
            , hours = parseInt((duration/(1000*60*60))%24);

        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;

        return hours + "h:" + minutes + "m:" + seconds + "." + milliseconds;
    }

function string_is_json(s)
{
	try{JSON.parse(s); return true;}
	catch(e){return false;}
}

var global_config_path = path.join(root_dir,".zild", "globals.json");
var project_config_path = path.join(project_dir,"config.json");
var project_log_path = path.join(project_dir, "current.log");
if(!fs.existsSync(project_config_path)) 
{
	console.log("Incorrect process ID, called with a process that doesn't exist");
	process.exit(1);
}

var project_config = JSON.parse(fs.readFileSync(project_config_path));
var global_config = JSON.parse(fs.readFileSync(global_config_path));
var fd_log = fs.openSync(project_log_path,'w');
fs.closeSync(fd_log);

project_config.token = global_config.token;
project_config.hostname = global_config.hostname;
project_config.cmp_name = global_config.cmp_name;
var child_dead = false;
var child;


var sock_file = path.join(project_dir, "s.sock");
var quit_ref_count = 0;
var data_lines_count = 0;

//listeners
events_intersect("post_response_done", "self_done", post_events, function() {
	//console.log("PRD "+quit_ref_count); 
	if(quit_ref_count < 1) process.exit();
})

//death listener has to come before server so that it can close the server if process is dying
//TODO: is this right?
ON_DEATH(function(signal, err) {
	graceful_close("from procmon death");
});

//var sock_arr = [];
var server = net.createServer(function(sock) {
	//sock.write("\n");
	var sock_log = true;
	var sock_interactive = false;
	sock.on('data', function(d){
		sock_log = false;
		if(string_is_json(d))
		{
			if((JSON.parse(d)).ping) sock.write(JSON.stringify({ping:true}));
			else if((JSON.parse(d)).pid) sock.write(JSON.stringify({pid:project_config.pid}));
			else if((JSON.parse(d)).kill) graceful_close("from UDS server");
		}
	});

	post_events.on("print", function(d){
		if(sock_log && sock.writable) sock.write(JSON.stringify({data:d}));
	});		


	//sock_arr.push(sock);
}).listen(sock_file);


fs.watch(project_dir, (eventType, filename) => { 
	if(filename === "s.sock"){
		//console.log([eventType, filename]);
		if(!fs.existsSync(sock_file)) {
			graceful_close("from socket file removal");
		}
		//server.close(function(e){console.log(e);}); 
		// above releases an error because server already closed when this is invoked from server.close(), but this is still needed when file 
		// is manually removed
		
	}
});





var print_out = function(data)
{
	var data = ""+data;
	post_events.emit("print", data);
	//log to STDOUT will be ignored by z, but if this is run directly, can be viewed for debugging purposes
	console.log(data);
	

	/*
	for (var i = 0, len = sock_arr.length; i < len; i++) {
		var sock0 = sock_arr[i];
		//TODO: figure out if I need sock0.writable if I can catch the error in the if block, uncomment epipe.d for this
		if(sock0 && sock0.writable)
		{
			sock0.write(data);
			sock0.on('error', function(e) {console.log(e); fs.writeFileSync("epipe.d", e);})
		}		
	}
	*/
}


var write3_common = function(data, stderr)
{
	var data = ""+data;
	data_lines_count++;
	var send_obj = JSON.parse(JSON.stringify(project_config)); //need to make a deep copy of project_config
	send_obj.data = data;
	send_obj.data_chunk = data_lines_count;
	send_obj.stderr = stderr;
	console.log(send_obj);
	quit_ref_count++;
	request.post( 'https://zild.io/shell_data', {json: send_obj}, 
		function(e,r,b){
			if(e) {console.log(e); }
			quit_ref_count--;
			//console.log("shell_data result");
			//console.log(b);
			post_events.emit("post_response_done");
		});
	fs.appendFileSync(project_log_path, data);
	print_out(data);
}



//make POST call, write to log, write to IPC
var write3_stdout = function(data){write3_common(data, "false");}

var write3_stderr = function(data){write3_common(data, "true");}


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

	proc_curr.stderr.on('data', write3_stderr); 
	proc_curr.stdout.on('data', write3_stdout);
	//we need these listeners to close this manager when the process it manages closes
	//otherwise the server prevents natural closing
	proc_curr.on('error', function(e) { print_out(e); graceful_close("from process error"); });
	proc_curr.on('close', function(code, signal) { 
		var close_code = " ";
		child_dead = true;
		if(code) close_code = close_code + " " +code;
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
		post_events.emit("self_done");
	})
}

function graceful_close(msg)
{
	//process has never started and since post calls are made after pid is set, we also know no post calls are made
	//TODO: try to trigger this, is emitting self_done right? or must kill self immediately?
	if(!project_config.pid) { console.log(msg+": found process was never started killing self immediately"); post_events.emit("self_done"); }
	//process has been started but not killed
	if(project_config.pid && !child_dead) { console.log(msg+": found process is not dead yet, so killing it"); process.kill(project_config.pid, 'SIGKILL'); }
	//process has been killed
	else console.log(msg+": found process is dead, so doing nothing");
}

function events_intersect(ev1, ev2, ee, f0)
{
	ee.on(ev1, function() { 
		ee.on(ev2, function() { 
			//console.log(ev1 +" then "+ev2); 
			f0(); 
		}); 
	});

	ee.on(ev2, function() { 
		ee.on(ev1, function() { 
			//console.log(ev2 +" then "+ev1); 
			f0(); 
		}); 
	});
}

//add_cb(spawn("bash",["-c","ping 8.8.8.8"]));
child = spawn2( process.env.SHELL || "bash",["-c",project_config.bash_cmd], {cwd: project_config.cwd } );
add_cb(child);
