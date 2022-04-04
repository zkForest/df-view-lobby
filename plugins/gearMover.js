// Big Looper.  Not to be released.  Danger if not uses correctly
// credit: https://twitter.com/ddy_mainland
import { html, render, useState,useLayoutEffect } from
	"https://unpkg.com/htm/preact/standalone.module.js";
import {ArtifactType as ARTIFACTTYPE, 
         PlanetType as PLANETTYPE} 
         from 'https://cdn.skypack.dev/@darkforest_eth/types';
import {
    isUnconfirmedMoveTx,
    isUnconfirmedProspectPlanetTx,
    isUnconfirmedFindArtifactTx,
  } from "https://cdn.skypack.dev/@darkforest_eth/serde";
  
let showToPlanets = [];
//let showCandidatePlanets = [];

///////// Edit Area
let genericTitle = "";
let genericInfo = "VIEW: see existing; GET: new list.";
let theater={};
let PIRATES = "0x0000000000000000000000000000000000000000";
if(window.theater) theater=window.theater;
else window.theater = {
        box: [{ xMin: -df.worldRadius, xMax: df.worldRadius, yMin: -df.worldRadius, yMax: df.worldRadius },
            { xMin: -df.worldRadius, xMax: df.worldRadius, yMin: -df.worldRadius, yMax: df.worldRadius },
            { xMin: -df.worldRadius, xMax: df.worldRadius, yMin: -df.worldRadius, yMax: df.worldRadius },
            { xMin: -df.worldRadius, xMax: df.worldRadius, yMin: -df.worldRadius, yMax: df.worldRadius }],
        gearDestList: [],
        followedPlanetList: [],
        weaponReserveList: {},
        SPACESHIP:[]
}
if(window.cfg) cfg = window.cfg;
else window.cfg = {
    doNotAbandonARTS: 0, //0=false, 1= true
    junkBuffer: 50, 
    OOMMaxThread: 3, // 
    exploreArtMinLvl: 2,
    proposed_energyCap: 10,
    proposed_energyCapLarge: 30,
    proposed_maxLvl: 6,
    junkBuffer:0,
};
let GEAR = df.getMyArtifacts().filter((a) => a.artifactType == ARTIFACTTYPE["ShipGear"])[0];
window.theater.SPACESHIP["ShipGear"]= GEAR.id;
theater = window.theater;
let recentTx = [];
let OOMMaxThread=window.cfg.OOMMaxThread;


////////////UTILITIES //////
function hasUnconfirmedMoveTx(p, to = "") {
    if (to == "") return p.transactions?.hasTransaction(isUnconfirmedMoveTx);

    return (getUnconfirmedMoves()
        .filter((m) => m.from == p.locationId && m.to == to)
        .length > 0
    )
}
function hasJunkForMove(target, buffer = window.cfg.junkBuffer) {
    if (target.spaceJunk == 0) return true;

    let junkLeft = df.getPlayerSpaceJunkLimit(df.account)
        - df.getPlayerSpaceJunk(df.account) - buffer - target.spaceJunk;

    let uncofirmedJunk = getUnconfirmedMoves()
        .map((m) => df.getPlanetWithId(m.to).spaceJunk)
        .reduce((acc, uncfm) => acc + uncfm, 0)


    console.log(junkLeft, uncofirmedJunk);

    return junkLeft - uncofirmedJunk > 0;

}
function hasUnconfirmedProspectPlanetTx(p) { return p.transactions?.hasTransaction(isUnconfirmedProspectPlanetTx) }
function hasUnconfirmedFindArtifactTx(p) { return p.transactions?.hasTransaction(isUnconfirmedFindArtifactTx) }

function hasRecentTx(type, id1, id2) {
    /// DONT KNOW HOW TO GENERALIZE THIS; only use type and id1
    //  Implement for prospect and find first
    // this mechanism is independent of native game's tx tracking.
    // it is implemented because client often times lags way behind on updates
    // status = "submitted", "stale" (>5 min),   
    // LOGIC:
    //     before we attempt the same tx on same id1 and id2:
    //     -- if in uncomfirmedTx, we know it's not done
    //     -- if submitted but no longer in unconfirmedTX, we assume it's succesful; we consider tx was succesful and perhaps force an update.
    //     -- 
    recentTx = recentTx.filter((t) =>
        type !== "move" ||
        !IsXMinutesAgo(t.time, 2)       // remove moves after 2 minutes
    );

    let tx = recentTx
        .filter((t) => t.type == type &&
            t.id1 == id1 &&
            (id2 == undefined || id2 == t.id2));
    if (tx.length == 0) return false;
    if (IsXMinutesAgo(tx.time, 5)) df.hardRefreshPlanet(id1);  //
    return true;
}
function getUnconfirmedMoves() {
    let unconfirmedMoves = df.getUnconfirmedMoves();
    return (
        unconfirmedMoves.map((m) => m.intent)
    )
}
function planetNotInvolved(srcId, partialMineThreshold = 0.5) {
    // not under attack; no pending departure; no scheduled moves
    // should add also not in actionWIP
    // not a mine unless health > 90%
    // not a ruin still not discovered
    // 
//    let hasTitan = df.getPlanetWithId(srcId).energyGrowth ==0;
    let hasTitan = false;

    let isPartialMine = df.getPlanetWithId(srcId).silverGrowth > 0
        ? df.getPlanetWithId(srcId).energy < (partialMineThreshold * df.getPlanetWithId(srcId).energyCap)
        : false;

    let outsideRadius = distToCenter(df.getPlanetWithId(srcId)) > df.worldRadius;

    let hasRocket = getPlanetsWithRockets().includes(srcId)

    let attacks = df.getAllVoyages()
        .filter((v) => v.player !== df.getAccount())
        .filter((v) => v.arrivalTime > Date.now() / 1000)
        .filter((v) => v.to == srcId)

    let departs = getUnconfirmedMoves()
        .filter((v) => v.from == srcId)

    let foundryUnfound = df.getPlanetWithId(srcId).planetType == 2  //protect large RUIns
        ? (df.getPlanetWithId(srcId).planetLevel >= 4 && df.getPlanetWithId(srcId).hasTriedFindingArtifact)
        : false

    let reserved = (theater.weaponReserveList[srcId] !== undefined);

    let actionList = [];
    if (typeof window.oq !== "undefined") {
        actionList = window.oq.actions
            .filter((a) => a.type == "AID"
                || a.type == "DEPOT"
                || a.type == "DELAYED_MOVE"
            )
            .filter((a) => a.payload.srcId == srcId)
    }
    if (typeof oq !== "undefined") {
        actionList = oq.actions
            .filter((a) => a.type == "AID"
                || a.type == "DEPOT"
                || a.type == "DELAYED_MOVE"
            )
            .filter((a) => a.payload.srcId == srcId)
    }

    return (!isPartialMine && (attacks.length == 0)
        && (departs.length == 0) && (actionList.length == 0)
        && !reserved && !outsideRadius
        && !foundryUnfound && !hasRocket
        && !hasTitan
    );
}
function getSendingPct(planet, sendingPcts) {
    if (!planet) return sendingPcts[2];  // to be conservative
    if (planet.planetLevel == 1) return sendingPcts[0];
    if (planet.planetLevel >= 4) return sendingPcts[2];
    return sendingPcts[1];
}
function getAngle(a, b) {  //returns btw -180 and + 180
    const alpha = Math.atan2((b.y - a.y), (b.x - a.x)) * 180 / Math.PI;
    return alpha;
    //    return Math.round(alpha/5)*5;
}
function distToCenter(a) {
    if (!a.location) return -1;
    return Math.sqrt(a.location.coords.x * a.location.coords.x + a.location.coords.y * a.location.coords.y)
}
function planetPower(planet) {
    return (planet.energy * planet.defense) / 100;
}

function foundrayExpired(planet) {
    return foundrayProspeted(planet) &&
        (df.ethConnection.getCurrentBlockNumber() - planet.prospectedBlockNumber > 250)
}
function foundrayProspeted(planet) {
    return df.isPlanetMineable(planet) &&
        (planet.prospectedBlockNumber != undefined)
}
function prospectedNotFound(planet) {
    return foundrayProspeted(planet) &&
        (df.ethConnection.getCurrentBlockNumber() - planet.prospectedBlockNumber < 250) &&
        !planet.hasTriedFindingArtifact;
}
// this is in fact made into 10 minutes because xdai network is slow now
function IsXMinutesAgo(before, x) {
    let ret;
    let now = Date.now() / 1000;
    if ((now - before) > 60 * x) { return true }
    else { return false }
}
function isSpaceShip(id) {
    //    return df.getArtifactWithId(id).artifactType >=10 //10 to 14 are spaceShips
    //  sometimes a spaceship is gone missing
    return Object.values(theater.SPACESHIP).includes(id);
}
function checkForOOMThreat2() {
    //TODO: implements a timer for OOM;  if > 5 miutes have passed, increament threadhold by 1
    /* [ ] examine which queues are better to use to slowdown things
        let snarking = df.snarkHelper.snarkProverQueue.taskQueue.running();
        let snarkQueue = df.snarkHelper.snarkProverQueue.taskQueue.getQueue();
        let confirmingQueue = df.contractsAPI.txExecutor.queue.taskQueue;
        let callQueue = df.contractsAPI.contractCaller.queue.taskQueue;

        let unconfirmed = df.entityStore.transactions.transactions;


        */
        let ret = (getUnconfirmedMoves().length >= OOMMaxThread);
        return (ret);
}

function isPlanetRateLimiting(planetId) {

    let voyages = df.getAllVoyages()
        .filter((v) => v.toPlanet == planetId)
        .filter((v) => v.player == df.account)
        .filter((v) => v.arrivalTime > Date.now() / 1000);

        //        .filter((v) => !isSpaceShip(v.artifactId))
     
     return (
            ((voyages.length +
            getUnconfirmedMoves().filter((m) => m.to == planetId).length) >=6)
           )
 }


function checkNumInboundVoyages(planetId, mineOnly = true, from = "", excludeSpaceShips = false) {

    let voyages = df.getAllVoyages()
        .filter((v) => v.toPlanet == planetId)
        .filter((v) => !mineOnly || v.player == df.account)
        .filter((v) => !excludeSpaceShips || !isSpaceShip(v.artifactId))

    if (from == "") {
        return (
            voyages.filter((v) => v.toPlanet == planetId)
                .filter((v) => v.arrivalTime > Date.now() / 1000).length +
            getUnconfirmedMoves().filter((m) => m.to == planetId).length
        );
    } else {
        return (
            voyages
                .filter((v) => v.toPlanet == planetId)
                .filter((v) => v.arrivalTime > Date.now() / 1000)
                .filter((v) => v.fromPlanet == from).length +
            getUnconfirmedMoves().filter((m) => m.to == planetId && m.from == from)
                .length
        );
    }
}

////////////MOVES //////
function move(srcId, tgtId, energy, silver, ARTId = "", abandon = false, checkJunk = false, checkVoyages = false) {
    // safe move that checks for unconfirmed, junk, and DDOS
    //DEBUG
    //    console.log (`move on a planet updated: XXX`);
    if (hasUnconfirmedMoveTx(df.getPlanetWithId(srcId), tgtId)) {
        console.log(`move cancelled: unconfirmed Move ui.centerLocationId('${srcId}')`);
        df.terminal.current.println("move cancelled: there is already an unconfirmed move", 5);
        return "unconfirmed move pending"
    }

    if(isPlanetRateLimiting(tgtId)) {
        console.log("move: planet is rate limited; move canceled")
        return "skip"

    }


    if (checkForOOMThreat2()) {
        console.log("move: OOM threat; move canceled")
        return "skip"
    } else {
        df.move(srcId, tgtId, energy, silver, ARTId, abandon);
        return "SENT";
        maxTxThisLoop--;  //
    }
}

function capture2(tgtId,   //simpler version
// damn it, move junk up here!'.
    levelLimit = cfg.proposed_maxLvl,
    sendingPcts = [5, cfg.proposed_energyCap, cfg.proposed_energyCapLarge]
) {    //capture a single planet
    const target = df.getPlanetWithId(tgtId);
    if (!target) { return "Target is invalid!" };

    let weapons = df.getMyPlanets()
        .filter((p) => p.planetLevel <= levelLimit &&
            df.getLocationOfPlanet(p.locationId) &&
            planetNotInvolved(p.locationId)
        )
        .map((p) => {
            const energyArriving = 0.15 * target.energyCap + planetPower(target);
            const energyNeeded = Math.ceil(df.getEnergyNeededForMove(p.locationId, target.locationId, energyArriving));
            return {
                planet: p,
                energyNeeded
            };
        })
        .filter((p) => {
            //                    return p.energyNeeded < (100 - getSendingPct(p.planet, sendingPcts)) / 100 * p.planet.plenergyCap;
            //                    console.log(p.planet.energy, p.energyNeeded, getSendingPct(p.planet, sendingPcts), p.planet.energyCap )
            return (p.planet.energy - p.energyNeeded) >= (getSendingPct(p.planet, sendingPcts) / 100 * p.planet.energyCap);
        })
        .sort((p1, p2) => { return (p1.energyNeeded - p2.energyNeeded) });

    //            console.log (weapons);

    if (weapons.length == 0) {
        console.log("Capture: not a single weapon in range. Lvl:", levelLimit, ". pct:", sendingPcts[1], sendingPcts[2]);
        return "NO WEAPON";
    } else {
        console.log(`Capture1: ${weapons.length} weapons identified`);
        console.log(weapons[0].planet.locationId, weapons[0].energyNeeded);
        if (hasRecentTx("move", weapons[0].planet.locationId, tgtId)) {
            console.log("Moving again toon soon", weapons[0].planet.locationId, tgtId);
            return "Too Soon";
        } else {
            recentTx.push({ 'type': 'move', 'id1': weapons[0].planet.locationId, 'id2': tgtId, 'time': Date.now() / 1000 });
            if (hasJunkForMove(target, 0)) {
              move(weapons[0].planet.locationId, tgtId, weapons[0].energyNeeded, 0);
            return "SENT";
            } else {
                console.log ("no junk space for move");
            }
        }
     }

}

function captureGearPlanet() {
    let ship = df.getMyArtifacts().filter((a) => a.artifactType == ARTIFACTTYPE["ShipGear"])[0];
    let gearPlanetId = getShipPlanetId("ShipGear");
    let txt = '';

    if (!gearPlanetId) {
        //      console.log ("gearPlanteId is",gearPlanetId );
        let gearVoyage = df.getAllVoyages()
            .filter((a) => a.artifactId == ship.id);
        if (gearVoyage.length == 0) {
            txt = "captureGearPlanet cannot find Gear Ship"; console.log(txt); return (txt);
        } else {
            gearPlanetId = gearVoyage[0].toPlanet;
        }
    }
    //    console.log ("gearPlanteId is",gearPlanetId );

    if (!gearPlanetId) return ("Gear planet does not need capturing");

    let gearPlanet = df.getPlanetWithId(gearPlanetId);

    if (!hasJunkForMove(gearPlanet,0)) {
        console.log(`no junk for move`);
        return;
    }

    console.log(`Gear is on ${gearPlanet.locationId}`);
    //  console.log(gearPlanet.planetType==PLANETTYPE["RUINS"], gearPlanet.owner==PIRATES, checkNumInboundVoyages(gearPlanetId,false,"",true) );

    if (gearPlanet.planetType == PLANETTYPE["RUINS"] &&
        gearPlanet.owner == PIRATES &&
        checkNumInboundVoyages(gearPlanetId, false, "", true) == 0 //any voyages, exclude spaceShip
    ) {

        txt = `Tring to capture GearPlanet ${gearPlanetId}`;
        console.log(txt);
        df.terminal.current.println(txt, 6);

        let levelLimit = 5;
        let pctRange = 25;
        let pctEnergyCap = 50;

        console.log(`trying to capture gearPlanet ${gearPlanetId} w/ Level 3`);
        let ret = capture2(gearPlanetId);

        if (ret == "SENT")
            txt += " SENT";
        else
            txt += " FAILED";

        return (txt);
    } else {
        return ("Gear planet does not need capturing[2]");
    }
}

/////////////////// GEAR functions
function getPlanetsWithRockets() {
    let rockets = df.getMyArtifacts().filter((a) =>
        a.artifactType == 7 &&
        a.activations == 1
    );

    return (
        rockets.map((r) => r.onPlanetId)
    )
}

function getShipPlanetId(shipType, silent = false) {
    let shipIsOnplanet = false;
    let shipIsOnVoyage = false;

    let ship = df.getMyArtifacts().filter((a) => a.artifactType == ARTIFACTTYPE[shipType])[0];
    if (!ship) { df.terminal.current.println("cannot find ship", 5); return ""; }
    //    if(ship.onPlanetId) () => {df.hardRefreshPlanet (ship.onPlanetId)};

    if (ship.onPlanetId
        && df.getPlanetWithId(ship.onPlanetId).heldArtifactIds.includes(theater.SPACESHIP["ShipGear"])) shipIsOnplanet = true;

    if ((df.getAllVoyages().concat(getUnconfirmedMoves())
        .filter((a) => a.artifactId == ship.id)
        .length > 0
    )) shipIsOnVoyage = true;

    if (!shipIsOnplanet && shipIsOnVoyage) { if (!silent) console.log("Ship is on voyage"); return; }
    if (shipIsOnplanet && !shipIsOnVoyage) { return ship.onPlanetId; }

    df.hardRefreshPlanet(ship.onPlanetId);
    df.terminal.current.println(`Error: doing df.hardRefreshPlanet ('${ship.onPlanetId}')`, 5);
}

function autoMoveGear(nextPlanetId = "", maxTime = 90 * 60) {
    let shipId = theater.SPACESHIP["ShipGear"];
    let txt = "";
    //    () => {df.hardRefreshArtifact(shipId)};

    let shipPlanetId = getShipPlanetId("ShipGear");
    if (!shipPlanetId) { txt = `Gear is not on a planet`; console.log(txt); return (txt); }

    if (!shipId) { txt = "autoGearMove cannot find gear ship!"; console.log(txt); return (txt) }

    let gearPlanet = df.getPlanetWithId(shipPlanetId);
    if (df.isPlanetMineable(gearPlanet) && (!foundrayProspeted(gearPlanet) || prospectedNotFound(gearPlanet))) {
        txt = "Gear planet does not need to be moved";
        console.log(txt);
        return (txt);
    }

    if (!nextPlanetId) nextPlanetId = getNextGearTarget(shipPlanetId);

    if (!nextPlanetId) { txt = `Gear does not know where to go next`; console.log(txt); return (txt); };

    let flightTime = df.getTimeForMove(shipPlanetId, nextPlanetId);
    if (flightTime > maxTime) {
        if (flightTime == Infinity) df.hardRefreshPlanet(shipPlanetId);  // for NaN bug
        txt = `Gear NOT MOVED: Would take ${Math.round(flightTime / 60)} minutes`;
        console.log(txt);
        return (txt);
    }

    txt = (`Moving Gear: ${Math.round(flightTime / 60)} minutes: move(${shipPlanetId},${nextPlanetId}), ${shipId}`);
    console.log(txt);
    df.terminal.current.println(txt, 6);
    if(shipPlanetId == nextPlanetId) {
         txt = "Gear moving to same planet! hardfreshing"; 
         console.log(txt);
         df.hardRefreshPlanet(shipPlanetId) ;
         return (txt) ;
        };
    move(shipPlanetId, nextPlanetId, 0, 0, shipId);
    return (txt);
    //  cfg.exploreArtMinLvl
}

function speedBooster(srcId, tgtId) {
    //use for gear only for now
    let source = df.getPlanetWithId(srcId);
    let minBoostTime = 5 * 60;

    let flightTime = df.getDist(srcId, tgtId) / (source.speed / 100);

    let sorted = Array.from(df.getAllPlanets())
        .filter((p) => df.getLocationOfPlanet(p.locationId) &&
            !(p.heldArtifactIds && p.heldArtifactIds.length >= 5))
        .map((p) => {
            return {
                locationId: p.locationId,
                newTime: (df.getDist(srcId, p.locationId) / (source.speed / 100)
                    + df.getDist(p.locationId, tgtId) / (p.speed / 100)),
            }
        })
        .sort((p1, p2) => p1.newTime - p2.newTime);

    console.log(flightTime, sorted[0].newTime);

    if (sorted[0].newTime < flightTime - minBoostTime) {
        console.log(`new gear target saves ${Math.round((flightTime - sorted[0].newTime) / 60)}min`);
        return sorted[0].locationId;
    }
    else return tgtId;
}
function getNextGearTarget(shipPlanetId) {

    if (theater.gearDestList.length > 0) {
        for (let id of theater.gearDestList) {
            let planet = df.getPlanetWithId(id);
            if (df.isPlanetMineable(planet) && !foundrayProspeted(planet)) {
                return speedBooster(shipPlanetId, id);
            }
            else theater.gearDestList.shift();
        }
    }


    console.log("geaList is empty");
    df.terminal.current.println("geaList is empty", 5);

    return;  // suspend auto find targets

    targets = Array.from(df.getAllPlanets())
        .filter((p) => p.owner == PIRATES &&
            p.locationId != shipPlanetId.locationId &&
            p.planetType == PLANETTYPE["RUINS"] &&
            p.planetLevel >= cfg.exploreArtMinLvl &&
            p.prospectedBlockNumber == undefined
            //    &&  planetIsCapturable(p)  too expensive
        )
        .sort((a, b) => { return df.getDist(a.locationId, shipPlanetId) - df.getDist(b.locationId, shipPlanetId) })

    if (targets.length > 0) return targets[0].locationId;
    else return "";
}

function getRUINsList(srcId, range = 25, maxTime = 95 * 60) {
    let source = df.getPlanetWithId(srcId);
    if (!source) return;
    return (
        df.getPlanetsInRange(srcId, range)
            .filter((p) => p.owner == PIRATES &&
                p.planetLevel >= cfg.exploreArtMinLvl &&
                df.isPlanetMineable(p) &&
                !p.hasTriedFindingArtifact &&
                distToCenter(p) < df.worldRadius &&
                df.getEnergyNeededForMove(p.locationId, srcId, 1, true) < p.energyCap // can abandon back here  
                //          df.getTimeForMove(p.locationId, srcId) <maxTime
            )
            .sort((a, b) => getAngle(a.location.coords, source.location.coords) - getAngle(b.location.coords, source.location.coords))
            .map((p) => p.locationId)
    )
}
function doProspectIfClear(n = 1, minLvl = 1, maxLvl = 5) {

    //modified for round 5 gearship
    let gearPlanetId = getShipPlanetId("ShipGear");

    if (gearPlanetId) {
        //        console.log(`gear on planet${gearPlanetId}`);
        let p = df.getPlanetWithId(gearPlanetId);
        if (df.isPlanetMineable(p) &&
            p.prospectedBlockNumber == undefined &&
            p.owner == df.account &&
            !hasRecentTx("prospect", p.locationId) &&
            !hasUnconfirmedProspectPlanetTx(p) &&
            !checkForOOMThreat2()
        ) {
            df.prospectPlanet(gearPlanetId);
            recentTx.push({ 'type': 'prospect', 'id1': gearPlanetId, 'time': Date.now() / 1000 });
            df.terminal.current.println(`prospecting 1 ART`, 6);
            console.log(`prospecting 1 ART`);
        }
        console.log("prospecting");
        return "Pospecting";
    } else {
        console.log("not prospecting");
        return "Doing Nothing";
    }
}
function doFind1(showOnly = true, lvl = 1) {   //simplified doFind for round5

    let mPlanets =
        df.getMyPlanets()
            .filter((p) => prospectedNotFound(p) &&
                !hasRecentTx("find", p.locationId) &&
                !hasUnconfirmedFindArtifactTx(p))

    for (let i = 0; i < mPlanets.length; ++i) {
        let text = (`ui.centerLocationId("${mPlanets[i].locationId}")\n`);
        if (!showOnly && !checkForOOMThreat2()) {
            console.log("finding", text);
            //            () => {df.hardRefreshPlanet (ship.onPlanetId)};
            recentTx.push({ 'type': 'find', 'id1': mPlanets[i].locationId, 'time': Date.now() / 1000 });
            df.findArtifact(mPlanets[i].locationId);
            return (`finding ${text}`);
        } else
            console.log("can find", text, mPlanets[i].prospectedBlockNumber);
    }
    return ("Nothing to find");
}

///////
async function generiCommand1(viewOnly,setInfo,percentageEnergyCap,minLevel,maxLevel,maxNum,unOwnedOnly){

    let fromPlanet = ui.getSelectedPlanet();
    if(fromPlanet===undefined && !viewOnly){   
        let infoArray = [];
        let content = 'No Select Planet';
        let infoOne = infoWithColor(content,'lightgreen');
        infoArray.push(infoOne);
        setInfo(infoArray);
        return;
    }

    console.log(viewOnly,ui.selectedPlanetId);
    let toPlanets = viewOnly
               ? theater.gearDestList.map((id) => df.getPlanetWithId(id)) 
               :planetListForGear(ui.selectedPlanetId);

//    showCandidatePlanets = candidatePlanets;
    if (toPlanets == undefined) toPlanets = [];
    showToPlanets = toPlanets;

    let infoArray = [];
    let content = toPlanets.length+' planet(s)';
    let infoOne = infoWithColor(content,'pink');
    infoArray.push(infoOne);

    content = `pctCap: ${percentageEnergyCap}; minLvl=${minLevel}`;
    infoOne = infoWithColor(content,'pink');
    infoArray.push(infoOne);
  

    
if(viewOnly){
    content = 'This is the list Gear will visit';
    infoOne = infoWithColor(content,'green');
    infoArray.push(infoOne);

   }else {
    content = 'Gear will now visit these planets';
    infoOne = infoWithColor(content,'pink');
    infoArray.push(infoOne);
   }

   setInfo(infoArray);


}

function planetListForGear (srcId,range=15) {
//    if(!srcId || df.getPlanetWithId(srcId).owner!=df.account) {console.log("must select your own planet"); return}
    if (df.getPlanetWithId(srcId).planetLevel <=3) range=25;
     
    theater.gearDestList = getRUINsList(srcId,range)
    console.log(`${theater.gearDestList.length} planets added to the list for gear`)
    return theater.gearDestList.map ((id) => df.getPlanetWithId(id));
}



let loopOn = true;
let cnt = 1;
export const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

function generic3Buttons(){
    // generic 3 buttons to Preview, Action, and Clear
    //info是用来控制输出提示内容的
    const [info,setInfo] = useState(genericInfo);

    let [percentageEnergyCap, setPercentageEnergyCap] = useState(25);
    let [minLevel, setMinLevel] = useState(1);
    let [maxLevel, setMaxLevel] = useState(3);
    let [maxNum, setMaxNum] = useState(10);
    let [unOwnedOnly, setUnOwnedOnly] = useState(true);

    async function loop(){
        loopOn = true;
        cnt=0;
        while(true){
            if(loopOn===false){

                // 演示用
                let infoArray = [];
                let info=[];
                let content = 'loop is stopped';
                let infoOne = infoWithColor(content,'lightgreen');
                infoArray.push(infoOne);
                setInfo(infoArray);
                break;

            }

            cnt++;
            let infoArray = [];
            let content = `loop count: ${cnt}`;
            let infoOne = infoWithColor(content,'lightgreen');
            infoArray.push(infoOne);

            let ret = autoMoveGear();
            infoOne = infoWithColor(ret,'pink');
            infoArray.push(infoOne);

            ret = captureGearPlanet();
            infoOne = infoWithColor(ret,'pink');
            infoArray.push(infoOne);

            ret = doProspectIfClear();
            infoOne = infoWithColor(ret,'pink');
            infoArray.push(infoOne);

            ret = doFind1(false, info);
            infoOne = infoWithColor(ret,'pink');
            infoArray.push(infoOne);

            for (let i of info) {
                infoOne = infoWithColor(i,'pink');
                infoArray.push(infoOne);
              
            }
            setInfo(infoArray);
            await sleep(15000);
        }
        

    }
    async function loopStop(){
        loopOn = false;
    }

    // async function loopStop2(){
    //     setloopOn2(false);
    // }
    let loopComponent = html`
    <div> ${genericTitle} </div>
    <div>
    <button style=${buttonStyle} onClick=${loop}> Start</button>
    <button style=${buttonStyle} onClick=${loopStop}> Stop </button>
     </div>
    `;



    async function previewButton(){
        await generiCommand1(true,setInfo,percentageEnergyCap,minLevel,maxLevel,maxNum,unOwnedOnly);
    }

    async function actionButton(){
        await generiCommand1(false,setInfo,percentageEnergyCap,minLevel,maxLevel,maxNum,unOwnedOnly);
    }

    function clearPlanets(){
//        showCandidatePlanets = [];
        showToPlanets = [];

        // 这里用来展示setInfo的用法
        // infoArray可以用来存放多个info条目
        let infoArray = [];
        let content = 'Clear Planets';
        let infoOne = infoWithColor(content,'pink');
        infoArray.push(infoOne);
        setInfo(infoArray);
        return;
    }


    // 这是为了演示input 特地添加的
    const onChangeE = (e) => { setPercentageEnergyCap(parseInt(e.target.value)) };
    const onChangeL1 = (e) => { setMinLevel(parseInt(e.target.value)) };
    const onChangeL2 = (e) => { setMaxLevel(parseInt(e.target.value)) };
    const onChangeN = (e) => { setMaxNum(parseInt(e.target.value)) };
    const onChangeU = (e) => { setUnOwnedOnly((e.target.checked) ? true : false) };

    let inputComponent = html`
    <div>
    %Cap=<input value=${percentageEnergyCap} onChange=${onChangeE} style=${{ ...inputS, width: '25px' }}
        /> minLvl=<input value=${minLevel} onChange=${onChangeL1} style=${{ ...inputS, width: '15px' }}
        /> maxLvl=<input value=${maxLevel} onChange=${onChangeL2} style=${{ ...inputS, width: '15px' }}
        /> N=<input value=${maxNum} onChange=${onChangeN} style=${{ ...inputS, width: '25px' }}
        /> unOwnedOnly:<input type="checkbox" id="unOwnedOnly" checked=${unOwnedOnly} onChange=${onChangeU}/>
     </div>
    `;

//    <div>${inputComponent}</div>

    return html`<div>
    <div>${loopComponent}</div>
    <div style=${{ width:'400px', textAlign: 'left' }}> Gear Destinations: select a planet to initialize</div>
    <button style=${buttonStyle} onClick=${previewButton}> View </button>
    <button style=${buttonStyle} onClick=${actionButton}> Get New </button>
    <button style=${buttonStyle} onClick=${clearPlanets}> Clear Map </button>
    <div style=${{textAlign: 'center'}}>${info}</div>  
    </div>`;
}

// 在地图当中画圈的函数
function drawRound(ctx, p, color, width, alpha) {
	if (!p) return '(???,???)';
	const viewport = ui.getViewport();
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.globalAlpha = alpha;
	const { x, y } = viewport.worldToCanvasCoords(p.location.coords);
	const range = p.range * 0.01 * 20;
	const trueRange = viewport.worldToCanvasDist(range);
	ctx.beginPath();
	// ctx.setLineDash([10,10]);
	ctx.arc(x, y, trueRange, 0, 2 * Math.PI);
	ctx.stroke();
	return `(${p.location.coords.x},${p.location.coords.y})`
}

//用于展示info的
function infoWithColor(content,textColor) {
	return html`<div style=${{ color: textColor, textAlign: 'left' }}>${content}</div>`;
}

// css调整样式
const divStyle = {
    textAlign: 'center',
    justifyContent: "space-around",
    width: "100%",
    marginTop: "10px"
  };

const inputS = {
    height: '20px',
    padding: '2px',
    margin: 'auto 1px',
    outline: 'none',
    color: 'black',
};

const buttonStyle = {
    border: "1px solid #ffffff",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    width: "120px",
    height: "30px",
    margin: "5px",
    padding: "0 0.3em",
    color: "white",
    textAlign: "center",
    transition: "background-color 0.2s, color 0.2s",
    borderRadius: "3px",
};

class Plugin {
	constructor() {
		this.container = null;
	}
	draw(ctx) {
//        showCandidatePlanets.forEach(p=>drawRound(ctx,p,'yellow',1,0.5));
        showToPlanets.forEach(p=>drawRound(ctx,p,'red',3,1));
	}

	async render(container) {
		this.container = container;
		container.style.width = "400px";
		container.style.height = "300px";
		render(html`<${generic3Buttons} />`, container);
	}
	destroy() {
		render(null, this.container);
	}
}

export default Plugin;
