

class Client {
    constructor(canvas, status){
        this.entities = {};
        this.playerEntities = {};
        this.keyLeft = false;
        this.keyRight = false;
        this.keyUp = false;
        this.keyDown = false;
        this.id = null; //Assigned by server

        //For rendering
        this.updateRate = 50;
        this.updateInterval = null;
        
        //For reconciliation
        this.inputSequenceNumber = 0;
        this.pendingInputs = [];
        this.lastTs = null;
        this.pendingInputs = [];

        this.serverUpdateRate = 10;

        this.canvas = canvas;
        this.status = status;
    }

    setUpdateRate(hz){
        this.updateRate = hz;
        clearInterval(this.updateInterval);
        this.updateInterval = setInterval(
            (function(self) { return function() { self.update(); }; })(this),
            1000 / this.updateRate);
    }

    updateState(){
        this.processServerMessages();
        if(this.id == null){
            return; // We haven't connected yet
        }

        //Process inputs
        this.processInputs();

        // Interpolate other entities
        this.interpolateEntities();

        renderWorld(this.canvas, this.entities);
    }

    processInputs(){
        // Compute delta time since last update
        let nowTs = new Date();
        let lastTs = this.lastTs || nowTs;
        let dtSec = (nowTs - lastTs)/ 1000.0;
        this.lastTs = nowTs;

        const input = {};
        let shouldUpdate = false;
        if(this.keyRight){
            input.x = dtSec;
            shouldUpdate = true;
        }
        if(this.keyLeft){
            input.x = -dtSec;
            shouldUpdate = true;
        }
        if(this.keyUp){
            input.y = dtSec;
            shouldUpdate = true;
        }
        if(this.keyDown){
            input.y = -dtSec;
            shouldUpdate = true;
        }

        //Nothing happened so don't send anything to the server
        if(!shouldUpdate){
            return;
        }

        input.sequenceNumber = this.inputSequenceNumber++;
        input.id = this.id;
        this.sendUpdate(input);

        //Do client-side prediction
        //TODO do client-side prediction

        this.pendingInputs.push(input)
    }

    //Process incoming server message
    processServerMessages(message){
        for(let i = 0; i < message.length; i++){
            let state = message[i];

            if(!this.entities[state.entityId]){
                let entity = new Entity();
                entity.setId(state.entityId);
                this.entities[state.entityId] = entity;
            }

            let entity = this.entities[state.entityId];

            if(state.entityId in this.playerEntities){
                // Server reconciliation. Re-apply all the not yet processed by the server
                let j = 0;
                while(j < this.pendingInputs.length){
                    let input = this.pendingInputs(j);
                    if(input.inputSequenceNumber <= state.lastProcessedInput){
                        //Already processed. Its effect is already taken into account into the world update
                        // we just got, so we can drop it
                        this.pendingInputs.splice(j, 1);
                    } else {
                        // Not processed by the server yet. Re-apply it
                        entity.applyInput(input);
                        j++
                    }
                }
            } else {
                // Received the position of an entity other then this player's entity
                const timestamp = new Date();
                entity.addToPositionBuffer(timestamp, state.x, state.y);
            }
        }
    }

    interpolateEntities(){
        const now = new Date();
        const renderTimestamp = now - (1000.0 / this.serverUpdateRate);

        this.entities.map(entity => {
            if(entity.id in this.playerEntities){
                // No point in interpolating this client's entity.
                continue;
            }

            //Find the two authoratative positions surrounding the rendering timestamp
            const buffer = entity.positionBuffer;
            
            //Drop older positions
            while (buffer.length >= 2 && buffer[])
        })
    }

}

class Entity{
    constructor(){
        this.x = 0;
        this.y = 0;
        this.speed = 2;
        this.positionBuffer = [];
        this.id = null;
    }

    setId(id){
        this.id = id;
    }

    applyInput(input){
        this.x = input.x*this.speed;
        this.y = input.y*this.speed;
    }

    addToPositionBuffer(timestamp, x, y){
        this.positionBuffer.push({timestamp: timestamp, x: x, y:y});
    }
}