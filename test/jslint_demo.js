/**
 * A simple JSLint results reporting service.
 * Reports via WebSockets on 'jslint/result' (default) topic.
 **/

//JSLint static code analysis options
/*jslint node: false, maxerr: 1000, indent: 4, white:true */
/*global global:true, process:true, module:true, require:true, console:true, setInterval:true */


var jslintServer = module.exports.jslintServer = {
    //
    // Standard module specifications
    //
    name: 'jslintServer',    //should be the same as module.exports.<name>
    "version": "1.0",
    description: 'Generic JSLint results reporting service on WebSocket',
    dependencies: {
        "comms": "2.x"
    },

    // Standard module configuration

    //SPECIFY this flag to indicate whether this module needs to run in SIM thread.
    'runOnSIM': false,

    //SPECIFY this flag 'true' to tell manager to wrap this module in a JS-FSM instance. //TODO: for possible future implementation
    'isFSM': false,

    //module-specific (user-configurable) options
    configuration: {
        channelName: 'jslint'
    },

    //
    //Public data
    //
    JSLINT: require('jslint'),

    //
    //internal module data
    //
    channelRoom: undefined,
    io: false,
    clients: [],


    //standard startup/load routine
    startup: function() {
        //1. Establish comms
        var io = global.process.sim.manager.get('comms');
        if (io)
        {
            console.log('INF: JSLint Channel setting up...'.info);
            jslintServer.ws = jslintServer.JSLINT.createWsChannel(io);
            if (jslintServer.ws)
            {
                console.log('INF: JSLint Channel setting up...OK'.info);
            }
            else
            {
                console.log('ERR: Failed to setup "jslint" channel!'.error);
            }
            setTimeout(function() {
                console.log('INF: Starting JSLint on sim\/loop.js'.info);
                jslintServer.JSLINT.checkAsync(__dirname + '/../node_modules/sim/lib/',
                    jslintServer.JSLINT.sendReport);
                jslintServer.JSLINT.checkAsync(__dirname + '/../node_modules/jslint/wrapper.js',
                    jslintServer.JSLINT.sendReport);
            }, 10000);
        }
        else
        {
            console.log('ERR: Aborting as cannot get comms server'.error);
            return;
        }
    },

    //standard shutdown/unload routine
    shutdown: function() {
    }
};
