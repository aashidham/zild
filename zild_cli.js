#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var root_dir = process.env.ZILD_ROOT || require('os').homedir();

var pkg_file_name = path.join(__dirname,"package.json");
var version_raw = JSON.parse(fs.readFileSync(pkg_file_name)).version;
var version = "v"+version_raw.replace(/[^a-zA-z0-9]/g,"");

var project_dir = path.join(root_dir,".zild", version);
var net = require('net');

var program = require('commander');
var Table = require('easy-table');
var colors = require('colors/safe');
var prompt = require('prompt');
var request = require('request');
var uuid = require('uuid/v4');
var nssocket = require('nssocket');
var utile = require('utile');
//var Table = require('cli-table');

function write_token(token)
{
	var config_file = path.join(project_dir, "globals.json");
	if(fs.existsSync(config_file)){
		var global_config = JSON.parse(fs.readFileSync(config_file));
		global_config.token = token;
		fs.writeFileSync(config_file, JSON.stringify(global_config));
	}
	else
	{
		var cmp_name = uuid();
		var hostname = require('os').hostname();
		utile.mkdirp(project_dir, function(err){
			if(err) { console.error(err); process.exit(); }
			fs.writeFileSync(config_file, JSON.stringify({token: token, cmp_name: cmp_name, hostname: hostname}));
		});
	}
}

program.version(version_raw)

//TODO: once you are logged out, your computer will get a new id, on new login is this OK?
//probably not. renmove before publish.
/*
program.command('logout')
	.action(function(s){
		var config_file = path.join(project_dir, "globals.json");
		if(fs.existsSync(config_file)) fs.unlinkSync(config_file);
	})
*/

program
	.command('dev')
	.action(function(){
		//console.log(process.cwd());
		console.log(version);
	})

program
	.command('whoami')
	.action(function(){
		var config_file = path.join(project_dir, "globals.json");
		if(fs.existsSync(config_file)){
			var global_config = JSON.parse(fs.readFileSync(config_file));
			if(global_config.token)
			{
				request.post( 'https://zild.io/whoami', {timeout: 1500, json: {token: global_config.token}}, function(e,r,b){
					if(!e) console.log(b.msg);
					else {
						if(e.code === 'ETIMEDOUT') console.log("Zild server down or taking a while to respond.");
			  			else console.log(e);
			  		}
				});	
			}
		}
	});

program
	.command('register')
	.action(function (s){
		prompt.message = '';
		prompt.delimiter = colors.white(":");	
		prompt.get([{
    		name: 'username',
    		required: true,
    		description: colors.white('username (8+ letters)')
  		}, { 
  			name: 'password',
    		hidden: true,
    		description: colors.white('password (9+ letters)'),
    		required: true
  		}, {
  			name: 'password2',
  			hidden: true, 
  			description: colors.white('password (repeat)'),
  			required: true
  		}, {
  			name: 'email',
  			description: colors.white('email'),
  			required: true
  		}], function (err, result) {
			  request.post( 'https://zild.io/register', 
			  	{timeout: 1000, json: {username: result.username, pw1: result.password, pw2: result.password2, email: result.email}},
			  	function(error, response, body)
			  	{
			  		if(!error){
			  			console.log(body.msg);
			  			if(body.token) write_token(body.token);
			  		}
			  		else {
			  			if(error.code === 'ETIMEDOUT') console.log("Zild server down or taking a while to respond.");
			  			else console.log(error);
			  		}
			  	});
  		});
  		prompt.start();
	});



program
	.command('login')
	.action(function (s){
		prompt.message = '';
		prompt.delimiter = colors.white(":");	
		prompt.get([{
    		name: 'username',
    		required: true,
    		description: colors.white('username')
  		}, { 
  			name: 'password',
    		hidden: true,
    		description: colors.white('password'),
    		required: true
  		}], function (err, result) {
			  request.post( 'https://zild.io/login',
			  	{timeout: 1000, json: {username: result.username, pw: result.password}},
			  	function(error, response, body)
			  	{
			  		if(!error) {
			  			console.log(body.msg);
			  			if(body.token) write_token(body.token);
			  		}
			  		else {
			  			if(error.code === 'ETIMEDOUT') console.log("Zild server down or taking a while to respond.");
			  			else console.log(error);
			  		}
			  	});
  		});
  		prompt.start();
	});

program
 	.command('list')
 	.alias('ls')
 	.option("-a,  --all", "Include closed / stopped processes in list")
 	.action(function(is_all){
 		//console.log("ID\tCWD\tCMD")
 		//console.log("begin");
 		var t = new Table
 		var ret = fs.readdirSync(project_dir)
 		.filter(file => fs.existsSync(path.join(project_dir, file, "config.json")))
 		//.filter(file => fs.existsSync(path.join(project_dir, file, "s.sock")))
 		.sort(function compare(a, b){
 			var config_a = get_json_config(a);
 			var config_b = get_json_config(b);
 			var ret_val = config_b.start_time - config_a.start_time;
 			//console.log(ret_val);
 			return ret_val;
 		})
 		if(!is_all.all) 
 		{
 			ret = ret.filter(file => fs.existsSync(path.join(project_dir, file, "s.sock")));
 		}
 		ret = ret.map(file => get_json_config(file));
 		/*ret.forEach(function(product) {
		});*/
 		writeRow(ret);
 		//console.log("got ret");

		function writeRow(products)
		{
		  if(products.length) {
		  	  var product = products.shift();
			  t.cell('zild id', colors.green(product.id0));
			  //t.cell('CMD', colors.red("["+product.cwd+"]$ "+ product.bash_cmd));
			  t.cell('shell command', colors.red(product.bash_cmd));
			  //(new Date(product.start_time)).toLocaleString()
			  t.cell('start time ▼', (new Date(product.start_time)).toLocaleString());
			  //t.newRow();
			  //writeRow(products);
			  var sock_file = path.join(project_dir, product.id0, "s.sock");
			  create_client(sock_file, 'pid', true, function(e,d){
			  	if(e) t.cell('pid', '--')
			  	else t.cell('pid', d)

			  	create_client(sock_file, 'uptime', true, function(e,d){
			  		if(e) t.cell('uptime', '--')
			  		else  t.cell('uptime', d)

			  		t.newRow();
			  		writeRow(products);

			  	});
			  	//if(e) console.log("-");
			  	//else console.log(d);

				//t.newRow();
				//console.log(t);
				//console.log(products);
			  	//writeRow(products);
			  });
		  }
		  else console.log(t.toString());
		}
 		//.map(j => console.log(j.id0+"\t"+j.cwd+"\t"+j.bash_cmd))
 		//console.log(t.print())

 		//console.table(['ID', 'CWD', 'CMD'],ret);
 		//console.log(ret);
 		//t.push(ret); 
 	});


program
	.command('pid <process_id>')
	.action(function(s){
		var sock_file = path.join(project_dir, s, "s.sock");
		create_client(sock_file, 'pid', true, function(e,d){
			console.log(d);
		});
	});


program
	.command('uptime <process_id>')
	.action(function(s){
		var sock_file = path.join(project_dir, s, "s.sock");
		create_client(sock_file, 'uptime', true, function(e,d){
			console.log(d);
		});
	});



program
	.command('kill <process_id>')
	.action(function(s){
		var sock_file = path.join(project_dir, s, "s.sock");
		create_client(sock_file, 'kill', true, function(e,d){
			console.log(d);
		});
	});

program
	.command('ping <process_id>')
	.action(function(s){
		var sock_file = path.join(project_dir, s, "s.sock");
		/*var client = new net.Socket();
		client.connect({path: sock_file});
		client.on('data' ,function(data) {console.log(""+data);});
		client.write(JSON.stringify({ping:true})); */
		create_client(sock_file, 'ping', true, function(e,d){
			console.log(d);
		})
	});

program
	.command('log <process_id>')
	.action(function(s){
		var log_file = path.join(project_dir, s, "current.log");
		fs.createReadStream(log_file).pipe(process.stdout);
	});

//put the send before the listen because we want to activate the log printout as soon as possible
program
	.command('attach <process_id>')
	.action(function(s){
		var sock_file = path.join(project_dir, s, "s.sock");

		var client = new nssocket.NsSocket();
		client.connect(sock_file, function(){
			console.log(colors.green("[[Reattached to "+s+"! Press any key to detach again.]]"));
		});
		client.on('error', function(err) {
			//console.log("caught "+err);
			console.log("Can't attach to this process: "+err.code);
			process.exit();
		});

		client.data('log' ,function(data) {
			process.stdout.write(data);
		});

		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.on('data', function(chunk) {
			console.log(colors.green("\r\n[[ ✓ Detached from "+s+".]]"));
			process.exit(0);
		});
	});

//put the listen before the send because we want to capture the first bytes of data
function create_client(sock_file, key0, val0 , cb )
{
	var client = new nssocket.NsSocket();
	client.on('error', function(err) {
		cb(err, "Can't attach to this process, maybe it has finished?");
		//console.log(err);
	});

	client.connect(sock_file);
	client.data( key0 ,function(data){
		cb(null,data);
		client.destroy();
	});
	client.send(key0,val0); //invoke the request AFTER the listener
}

program
  .command('*')
  .action(function(env){
    program.help();
  });


if(!process.argv.slice(2).length)
{
  program.help();
}

program.parse(process.argv);

function get_json_config(id0)
{
	return JSON.parse(fs.readFileSync(path.join(project_dir, id0, "config.json")))
}
