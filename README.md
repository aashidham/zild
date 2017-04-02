# Zild 

Zild is a command-line tool that enables developers to detach their terminal from processes that are running in the shell, and keep track of these processes over time. Kind of like `forever` except for one-off jobs that don't need repetition. Zild also lets you review launched shell processes with a web interface at <a href="https://www.zild.io">https://www.zild.io</a>.

## Links

Github: <a href="https://github.com/aashidham/zild">https://github.com/aashidham/zild</a> <br/>
NPM: <a href="https://www.npmjs.com/package/zild">https://www.npmjs.com/package/zild</a> <br/>
Website: <a href="https://www.zild.io">https://www.zild.io</a>

## Prerequisites

You need <code>node</code> (<code>v6.9.2+</code>, untested for prior versions) and <code>npm</code> installed. For instructions on how to do this, <a href="//zild.io">checkout our guide for installing node and npm with and without admin privileges</a>.

Only tested on OSX 10 and Ubuntu 14.04. Probably won't work on Windows, because uses unix domain sockets.

#### This repo will add two commands to your shell: `z` and `zild`. `z` is only for launching jobs, while `zild` does everything else (inspecting jobs, deleting them, listing them, etc.). 

By default, zild sockets and logs are stored at `~/.zild/`. All stdout / stderr for a zild process also gets sent to the zild.io webservice.

(Note: If you already have `z` used for a different (popular) binary, let me know by filing an issue. I don't know of any popular tools that use `z` as the name for their projects, but I could be mistaken. You can change the name of both `zild` and `z` by altering `package.json`.)

## Getting started

Let's go:
```bash
$ npm install -g  zild 
$ zild register # you can also do zild login if you already have an account 
$ z python run_long_process.py
[['python run_long_process.py' (PID: 65053) in progress. It has zild id 'runlongprocesspy'. Press any key to detach.]]
```
(Note: `z` doesn't take any options (other than some environmental variables, see "Runtime options" below). Anything typed after `z` is taken as if you are typing it into the shell directly. If you do `z --help` or `z --version`, you will just be running `$ --help` directly, which is probably not what you want. Run `zild --help` instead.)

You can inspect the `runlongprocesspy` process by going to <a href="//zild.io/jobs">https://www.zild.io/jobs</a>. As zild tells you, you can press any keystroke to detach `runlongprocesspy` from the terminal.

## Managing `zild` processes

You can now manage `runlongprocesspy` through `zild`. In order to view all the logs of a process so far:
```bash
$ zild log runlongprocesspy
```
 To reattach to the process and view its STDOUT / STDERR in real time (basically the `tail -f` of the process):
```bash
$ zild attach runlongprocesspy
```
To get the PID of the process:
```bash
$ zild pid runlongprocesspy
```
To kill the process (like running `kill -9 $PID`):
```bash
$ zild kill runlongprocesspy
```

You dont need to remember that the process you ran has id `runlongprocesspy`. You can list your currently running processes:
```bash
$ zild ls # `zild list` works too
```
And you can also list all the zild processes you have ever run, including stopped / killed jobs:
```bash
$ zild ls -a
```

## Runtime `env` options

If you want your process to immediately detach from the controlling terminal:
```bash
$ ZILD_IMMEDIATE_DETACH=1 z python run_long_process.py
```
For this to be the default setup every time you run `z`:
```bash
$ echo "ZILD_IMMEDIATE_DETACH=1" >> ~/.bash_profile
$ source ~/.bash_profile
```
You can also set the `.zild/` project directory to be elsewhere on your computer (default is `~`):
```bash
$ echo "ZILD_ROOT=/home/aashidham/zild_logs/" >> ~/.bash_profile
$ source ~/.bash_profile


