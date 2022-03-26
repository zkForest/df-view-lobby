export function hasUncomfirmedUpgradeTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedUpgradeTx)};
export function hasUncomfirmedProspectPlanetTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedProspectPlanetTx)};
export function hasUncomfirmedFindArtifactTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedFindArtifactTx)};
export function hasUncomfirmedActivateArtifactTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedActivateArtifactTx)};
export function hasUncomfirmedDeactivateArtifactTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedDeactivateArtifactTx)};
export function hasUncomfirmedWithdrawArtifactTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedWithdrawArtifactTx)};
export function hasUncomfirmedInvadePlanetTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedInvadeTx)};
export function hasUncomfirmedCapturePlanetTx(p) {return p.transactions?.hasTransaction(window.serde.isUnconfirmedCapturePlanetTx)};

function ABC(){
    console.log("ABC");
    return;    
}
export {ABC};


