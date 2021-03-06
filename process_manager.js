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
var nssocket = require('nssocket');
var uuid = require('uuid/v4');

var id0 = process.argv[2];

var pkg_file_name = path.join(__dirname,"package.json");
var version_raw = JSON.parse(fs.readFileSync(pkg_file_name)).version;
var version = "v"+version_raw.replace(/[^a-zA-z0-9]/g,"");

var project_dir = path.join(root_dir , ".zild" , version , id0);

var call_zild_api = function(str, data, cb)
{
	var port_no = 8000;
	request.post( "https://zild.io:"+port_no+"/"+str, data, cb );
}

function sToTime(duration_s) {
		var duration = duration_s * 1000;
        var milliseconds = parseInt((duration%1000)/100)
            , seconds = parseInt((duration/1000)%60)
            , minutes = parseInt((duration/(1000*60))%60)
            , hours = parseInt((duration/(1000*60*60))%24);

        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;

        return hours + "h:" + minutes + "m:" + seconds + "." + milliseconds+"s";
    }

function string_is_json(s)
{
	try{JSON.parse(s); return true;}
	catch(e){return false;}
}

var global_config_path = path.join(root_dir,".zild", version, "globals.json");
var project_config_path = path.join(project_dir,"config.json");
var project_log_path = path.join(project_dir, "current.log");
if(!fs.existsSync(project_config_path)) 
{
	console.log("Incorrect process ID, called with a process that doesn't exist");
	process.exit(1);
}

var project_config = JSON.parse(fs.readFileSync(project_config_path));
var global_config = JSON.parse(fs.readFileSync(global_config_path));

//https://nodejs.org/api/fs.html#fs_fs_createwritestream_path_options
//		'w' flag is default (fopen flags)
//		http://www.manpagez.com/man/3/fopen/ OR http://stackoverflow.com/a/1466036
//			"Truncate file to zero length or create text file for writing."
var fstream_log = fs.createWriteStream(project_log_path);

project_config.token = global_config.token;
project_config.hostname = global_config.hostname;
project_config.cmp_name = global_config.cmp_name;
var child_dead = false;
var close_code = " ";
var child;


var sock_file = path.join(project_dir, "s.sock");
var data_lines_count = 0;

//listeners
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


events_intersect("start_done", "process_closed", post_events, function(){
	console.log("about to call stop_process");
	call_zild_api( 'stop_process', {json: {token: project_config.token, close_code: close_code, process_id: project_config.process_id}}, 
		function(e,r,b){
			console.log("from stop_process result");
			if(e) {console.log(e); }
			console.log("stop_process result");
			console.log(b);
			console.log("would have killed procmon here");
			server.close(); 
			process.exit();
		});			
})


//death listener has to come before server so that it can close the server if process is dying
//TODO: is this right?
ON_DEATH(function(signal, err) {
	graceful_close("from procmon death");
});

//var sock_arr = [];
var server = nssocket.createServer(function(sock) {

	sock.data('ping', function(){
		sock.send('ping', { pong: (new Date()).toLocaleString() });
	});

	sock.data('pid', function(){
		sock.send('pid', project_config.pid);
	});

	sock.data('kill', function(){
		graceful_close("from UDS server");
	});

	sock.data('uptime', function(){
		sock.send('uptime', sToTime(process.uptime()));
	})

	var d_curr;
	sock.on('error', function(e) {console.log("from epipe"); console.log(e); console.log(d_curr);})


	post_events.on("print", function(d){
		d_curr = d;
		if(sock.connected)
		{
			sock.send('log', d);	
		}
	});		

}).listen(sock_file);


fs.watch(project_dir, (eventType, filename) => { 
	if(filename === "s.sock"){
		if(!fs.existsSync(sock_file)) {
			graceful_close("from socket file removal");
		}
		
	}
});





var print_out = function(data)
{
	var data = ""+data;
	post_events.emit("print", data);
	fstream_log.write(data);
	//log to STDOUT will be ignored by z, but if this is run directly, can be viewed for debugging purposes
	//console.log(data);
}


var write3_common = function(data, stderr)
{
	var data = ""+data;
	data_lines_count++;
	var send_obj = JSON.parse(JSON.stringify(project_config)); //need to make a deep copy of project_config
	send_obj.data = data;
	send_obj.data_chunk = data_lines_count;
	send_obj.stderr = stderr;
	//console.log(send_obj);
	call_zild_api( 'shell_data', {json: send_obj}, 
		function(e,r,b){
			if(e) { console.log("shell_data error"); console.log(e); }
			//console.log("shell_data result");
			//console.log(b);
		});
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

	console.log(proc_curr.pty.columns); //80
	console.log(proc_curr.pty.rows); //24

	console.log("start_process project_config");
	console.log(project_config);
	call_zild_api( 'start_process', {json: project_config}, 
		function(e,r,b){
			if(e) {console.log(e); }
			console.log("start_process result");
			console.log(b);
			post_events.emit("start_done");
		});

	proc_curr.stderr.on('data', write3_stderr); 
	proc_curr.stdout.on('data', write3_stdout);
	//we need these listeners to close this manager when the process it manages closes
	//otherwise the server prevents natural closing
	proc_curr.on('error', function(e) { print_out(e); graceful_close("from process error"); });
	proc_curr.on('close', function(code, signal) { 
		console.log("inside close cb");
		child_dead = true;
		if(code) close_code = close_code + " " +code;
		if(signal) close_code = close_code + " " +signal;
		if(close_code && close_code !== " ") {
			print_out("Process closed with code "+code+" and signal "+signal+"\n");	
		} 
		post_events.emit("process_closed");

	})
}

function graceful_close(msg)
{
	//process has never started and since post calls are made after pid is set, we also know no post calls are made
	//TODO: try to trigger this, is this right?
	if(!project_config.pid) { console.log(msg+": found process was never started killing self immediately"); server.close(); process.exit(); }
	//process has been started but not killed
	if(project_config.pid && !child_dead) { console.log(msg+": found process is not dead yet, so killing it"); process.kill(project_config.pid, 'SIGKILL'); }
	//process has been killed
	else console.log(msg+": found process is dead, so doing nothing");
}

//add_cb(spawn("bash",["-c","ping 8.8.8.8"]));
child = spawn2( process.env.SHELL || "bash",["-c",project_config.bash_cmd], {cwd: project_config.cwd } );
add_cb(child);
