import {createHash} from 'node:crypto';
import {ErpError} from './adapter.mjs';
// Actor-isolated, in-memory staging. Process restart deliberately clears it.
export class MockErpConnector {
  #batches = new Map();
  constructor({maxBatches=1000}={}) { this.maxBatches=maxBatches; }
  stage(actorId,key,records) {
    if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(key))throw new ErpError(400,'Idempotency-Key must be 8..80 safe characters');
    const identity=JSON.stringify([actorId,key]);
    const digest=createHash('sha256').update(JSON.stringify(records)).digest('hex');
    const old=this.#batches.get(identity);
    if(old){if(old.digest!==digest)throw new ErpError(409,'Idempotency key reused with different records');return {...old.result,replayed:true};}
    if(this.#batches.size>=this.maxBatches)throw new ErpError(503,'Mock staging full; restart local demo to reset');
    const result={batch_id:createHash('sha256').update(identity).digest('hex').slice(0,24),mode:'mock',persisted:false,production_writes:0,staged_count:records.length,replayed:false};
    this.#batches.set(identity,{digest,result});return result;
  }
}
