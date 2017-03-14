var print_out = function(msg)
{
	var can_send_msg = true;
	process.on('disconnect', function() {can_send_msg = false;});
	if(can_send_msg)
	{
		process.send(msg);
	}
}

print_out("a123");
print_out("sdfsd");
setInterval(
    function(){
    	print_out(JSON.stringify({m:"a"}));
	}, 200);
