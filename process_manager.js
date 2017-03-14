//var id0 = process.argv[2];

//var root_dir = require('os').homedir();

//var pid_path = 

var fs = require('fs');
var net = require('net');
var spawn = require('child_process').spawn;
var buf = "";
var sock0;

var print_out = function(data)
{
	//console.log(data);
	if(sock0)
	{
		if(buf.length) 
		{
			sock0.write(buf);
			buf = "";
		}
		sock0.write(data);
	}
	else
	{
		buf = buf + data;
	}
}



//make POST call, write to log, write to IPC
var write3 = function(data)
{

}

var server = net.createServer(function(sock) {
	sock0 = sock;
}).listen('s');

process.send("ready");

var add_cb = function(proc_curr)
{
	proc_curr.on('error', print_out);
	proc_curr.on('close', print_out);
	proc_curr.stdout.setEncoding('utf8');
	proc_curr.stderr.setEncoding('utf8');
	proc_curr.stdout.on('data', print_out);
	proc_curr.stderr.on('data', print_out); 
}

//add_cb(spawn("bash",["-c","ping 8.8.8.8"]));
add_cb(spawn("bash",["-c","node a2.js"]));
